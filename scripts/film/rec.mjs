// Film shot recorder: virtual-time rAF + fixed world step + scripted camera override.
// Usage (dev server on :5173): node scripts/film/rec.mjs scripts/film/shots.mjs <work>/shots-out [shotId,...]
// PREVIEW=1 renders only the first and last frame of each shot; FORCE=1 re-renders shots already on disk.
import { chromium } from '@playwright/test';
import { mkdir, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const [shotsFile, outDir, only] = process.argv.slice(2);
const { shots, time = '17:40', W = 1280, H = 544 } = await import(pathToFileURL(shotsFile).href);
const list = shots.filter(s => !only || only.split(',').includes(s.id)).map(s => process.env.PREVIEW ? { ...s, frames: 2 } : s);
const base = 'http://127.0.0.1:5173/';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(300000);
page.on('pageerror', e => console.log('ERROR', e.message)); page.on('console', m => { if (m.text().startsWith('follow')) console.log(m.text()); });
await page.addInitScript(() => {
  const realRAF = window.requestAnimationFrame.bind(window), pn = performance.now.bind(performance);
  let virtual = false, now = 0, queue = [];
  window.requestAnimationFrame = cb => { if (virtual) { queue.push(cb); return 1; } return realRAF(cb); };
  performance.now = () => virtual ? now : pn();
  window.__vt = {
    on() { now = pn(); virtual = true; },
    step(ms) { now += ms; const q = queue; queue = []; for (const cb of q) cb(now); },
    off() { virtual = false; const q = queue; queue = []; for (const cb of q) realRAF(cb); },
  };
});
await page.emulateMedia({ reducedMotion: 'no-preference' });
await page.goto(`${base}?debug&review=1&time=${time}#world`);
await page.waitForFunction(() => document.querySelector('canvas')?.dataset.eyeHeight, {}, { timeout: 300000 });
await page.waitForFunction(() => document.querySelector('canvas')?.dataset.surfaceMaps !== 'loading');
await page.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' });
// Camera override, applied just before the engine renders.
await page.evaluate(() => {
  const w = window.__world, orig = w.rendering.render.bind(w.rendering);
  w.rendering.render = d => { if (window.__cam) window.__cam(w); return orig(d); };
});

for (const shot of list) {
  const dir = `${outDir}/${shot.id}`; await mkdir(dir, { recursive: true });
  if ((await readdir(dir)).length >= shot.frames && !process.env.FORCE) { console.log('skip', shot.id); continue; }
  const t0 = Date.now();
  await page.evaluate(() => { window.__cam = null; });
  await page.evaluate(v => window.dispatchEvent(new CustomEvent('street-review-view', { detail: v })), shot.view);
  if (shot.place) await page.evaluate(([x, z, yaw]) => { const w = window.__world, o = Math.round(w.visitor.position.x / 600) * 600; w.placeVisitor(o + x, z, yaw); }, shot.place);
  if (shot.ride) await page.evaluate(k => window.__world.board(k), shot.ride);
  await page.waitForTimeout(shot.settle ?? 9000);
  // Let the district finish building in real time, then freeze the clock.
  await page.waitForFunction(() => { const w = window.__world; return w.city.isReady(Math.round(w.visitor.position.x / 600)); }, {}, { timeout: 300000 }).catch(() => console.log('not ready', shot.id));
  if (shot.prerollSeconds) await page.waitForTimeout(shot.prerollSeconds * 1000);
  await page.evaluate(shot => {
    const w = window.__world, origin = Math.round((w.ride?.phase && w.ride.phase !== 'idle' ? w.transit.position.x : w.visitor.position.x) / 600) * 600;
    const ease = { linear: t => t, inout: t => t * t * (3 - 2 * t), out: t => 1 - (1 - t) ** 3, in: t => t * t * t }[shot.ease ?? 'inout'];
    const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    let frame = 0; const n = shot.frames; let followed = null;
    if (shot.follow) {
      const [nx, nz, dir] = shot.follow.near, agents = w.district.traffic.agents.filter(a => a.active && a.mesh.visible && (dir === undefined || Math.cos(a.mesh.rotation.y - dir) > .7));
      agents.sort((a, b) => Math.hypot(a.mesh.position.x - nx, a.mesh.position.z - nz) - Math.hypot(b.mesh.position.x - nx, b.mesh.position.z - nz));
      followed = agents[0].mesh; console.log('follow', followed.position.x.toFixed(1), followed.position.z.toFixed(1), followed.rotation.y.toFixed(2));
    }
    const target = new w.camera.position.constructor();
    window.__cam = w => {
      const cam = w.camera, u = ease(Math.min(1, frame / Math.max(1, n - 1)));
      if (shot.keys) {
        const k = shot.keys; let i = 0; while (i < k.length - 2 && u > k[i + 1].t) i++;
        const a = k[i], b = k[i + 1], s = Math.min(1, Math.max(0, (u - a.t) / (b.t - a.t)));
        const p = lerp(a.pos, b.pos, s), l = lerp(a.look, b.look, s);
        cam.position.set(origin + p[0], p[1], p[2]); target.set(origin + l[0], l[1], l[2]);
        cam.up.set(0, 1, 0); cam.lookAt(target);
        const roll = (a.roll ?? 0) + ((b.roll ?? 0) - (a.roll ?? 0)) * s; if (roll) cam.rotateZ(roll);
        const fov = (a.fov ?? 68) + ((b.fov ?? 68) - (a.fov ?? 68)) * s; if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
      } else if (shot.follow) {
        const f = shot.follow, v = followed;
        const yaw = v.rotation.y, c = Math.cos(yaw), sn = Math.sin(yaw), [ox, oy, oz] = lerp(f.from, f.to, u);
        const pos = { x: v.position.x + origin, z: v.position.z }; cam.position.set(pos.x + ox * c + oz * sn, oy, pos.z - ox * sn + oz * c);
        target.set(pos.x + f.look[0] * c + f.look[2] * sn, f.look[1], pos.z - f.look[0] * sn + f.look[2] * c); cam.lookAt(target);
        if (f.fov && cam.fov !== f.fov) { cam.fov = f.fov; cam.updateProjectionMatrix(); }
      }
      frame++;
    };
    w.setFixedStep(1 / 24); window.__vt.on();
  }, shot);
  for (let i = 0; i < shot.frames; i++) {
    await page.evaluate(() => window.__vt.step(1000 / 24));
    await page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  await page.evaluate(() => { window.__cam = null; const w = window.__world; w.camera.fov = 68; w.camera.updateProjectionMatrix(); w.setFixedStep(0); window.__vt.off(); w.endRide?.(); });
  console.log(shot.id, shot.frames, 'frames', ((Date.now() - t0) / 1000).toFixed(0), 's');
}
await browser.close();
