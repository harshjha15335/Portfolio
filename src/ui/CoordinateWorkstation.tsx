import { useState } from 'react';
import { ConventionError, SPHERICAL_SOURCE, cartesianDipolePotential, cartesianQuadrupolePotential, dipoleToSpherical, quadrupoleToCartesian, quadrupoleToSpherical, sphericalDipolePotential, sphericalQuadrupolePotential, type Tensor, type Vec3 } from '../research/stone';

const SLIDERS = [['Θxx', -1.5, 1.5], ['Θyy', -1.5, 1.5], ['Θxy', -1, 1], ['Θxz', -1, 1], ['Θyz', -1, 1]] as const;
const Q_LABELS = [['Q₂₀', 'Θzz'], ['Q₂₁c', '(2/√3) Θxz'], ['Q₂₁s', '(2/√3) Θyz'], ['Q₂₂c', '(Θxx − Θyy)/√3'], ['Q₂₂s', '(2/√3) Θxy']];
const fmt = (n: number) => (Math.abs(n) < 5e-13 ? 0 : n).toFixed(4);

/** Fort coordinate workstation: the Stone-convention conversions Harsh wrote for FFprime, live. */
export function CoordinateWorkstation() {
  const [t, setT] = useState([.4, -1.1, .25, -.3, .15]);
  const [freeTrace, setFreeTrace] = useState(false);
  const [zz, setZz] = useState(.7);
  const [p, setP] = useState<Vec3>([.3, -.5, .8]);
  const [r, setR] = useState<Vec3>([1.2, .4, -.7]);
  const [xx, yy, xy, xz, yz] = t;
  const theta: Tensor = [[xx, xy, xz], [xy, yy, yz], [xz, yz, freeTrace ? zz : -xx - yy]];
  let q: number[] | null = null, error = '';
  try { q = quadrupoleToSpherical(theta); } catch (e) { if (e instanceof ConventionError) error = e.message; else throw e; }
  const back = q && quadrupoleToCartesian(q);
  const roundTrip = back ? Math.max(...back.flatMap((row, a) => row.map((v, b) => Math.abs(v - theta[a][b])))) : NaN;
  const vCart = cartesianQuadrupolePotential(theta, r), vSph = q ? sphericalQuadrupolePotential(q, r) : NaN;
  const dCart = cartesianDipolePotential(p, r), dSph = sphericalDipolePotential(dipoleToSpherical(p), r);
  // Angular pattern of the quadrupole potential on the unit circle in the xz-plane, from the spherical formula.
  const pattern = q ? Array.from({ length: 121 }, (_, i) => { const a = i / 120 * Math.PI * 2; return sphericalQuadrupolePotential(q!, [Math.sin(a), 0, Math.cos(a)]); }) : [];
  const peak = Math.max(1e-9, ...pattern.map(Math.abs));
  const lobe = (sign: 1 | -1) => pattern.map((v, i) => { const a = i / 120 * Math.PI * 2, rad = 18 + 62 * Math.max(0, sign * v) / peak; return `${i ? 'L' : 'M'}${(100 + rad * Math.sin(a)).toFixed(1)} ${(100 - rad * Math.cos(a)).toFixed(1)}`; }).join('') + 'Z';
  const slider = (label: string, value: number, min: number, max: number, set: (v: number) => void) => <label key={label}>{label}<output>{value.toFixed(2)}</output><input type="range" min={min} max={max} step={.05} value={value} onChange={e => set(+e.target.value)} /></label>;
  return <section className="coordinate-workstation" aria-label="Coordinate workstation: Cartesian to spherical multipoles">
    <header><span className="eyebrow">FORT / COORDINATE WORKSTATION</span><h3>Cartesian ↔ spherical, Stone convention.</h3>
      <p>Edit a traceless Cartesian quadrupole and a dipole. The workstation converts them with the same equations as FFprime's <code>spherical.py</code>, converts back, and evaluates the potential both ways at a point you choose. The two columns must agree; that agreement is what the upstream tests check.</p></header>
    <div className="lab-grid">
      <div className="lab-controls">
        <span className="eyebrow">QUADRUPOLE Θ (A.U.)</span>
        {SLIDERS.map(([label, min, max], i) => slider(label, t[i], min, max, v => setT(s => s.map((x, j) => j === i ? v : x))))}
        {freeTrace ? slider('Θzz (free)', zz, -2, 2, setZz) : <p className="caption">Θzz = −Θxx − Θyy = {fmt(theta[2][2])} keeps the tensor traceless.</p>}
        <label className="lab-toggle"><input type="checkbox" checked={freeTrace} onChange={e => { setFreeTrace(e.target.checked); setZz(theta[2][2] + .3); }} /> Let me set Θzz (break tracelessness)</label>
        <span className="eyebrow">DIPOLE p</span>
        {(['px', 'py', 'pz'] as const).map((l, i) => slider(l, p[i], -1, 1, v => setP(s => s.map((x, j) => j === i ? v : x) as Vec3)))}
        <span className="eyebrow">EVALUATION POINT r</span>
        {(['x', 'y', 'z'] as const).map((l, i) => slider(l, r[i], -2, 2, v => setR(s => s.map((x, j) => j === i ? v : x) as Vec3)))}
      </div>
      <div aria-live="polite">
        {error ? <p className="lab-verdict fail" role="alert">ValueError: {error}. FFprime refuses this tensor instead of silently projecting it, and so does the workstation.</p> : <>
          <table className="lab-table"><caption className="caption">REAL SPHERICAL COMPONENTS · quadrupole_cartesian_to_spherical</caption><tbody>
            {Q_LABELS.map(([name, formula], i) => <tr key={name}><th>{name}</th><td><code>{formula}</code></td><td>{fmt(q![i])}</td></tr>)}
            {(['Q₁₀ = pz', 'Q₁₁c = px', 'Q₁₁s = py']).map((name, i) => <tr key={name}><th>{name.split(' ')[0]}</th><td><code>{name.split('= ')[1]}</code></td><td>{fmt(dipoleToSpherical(p)[i])}</td></tr>)}
          </tbody></table>
          <div className="workstation-split">
            <figure className="lab-chart"><svg viewBox="0 0 200 200" role="img" aria-label="Angular pattern of the quadrupole potential in the xz-plane; teal lobes positive, rust lobes negative"><circle cx="100" cy="100" r="18" className="unit" /><path d={lobe(1)} className="lobe-pos" /><path d={lobe(-1)} className="lobe-neg" /><path d="M100 8V192M8 100H192" className="axis" /><text x="104" y="16">z</text><text x="184" y="96">x</text></svg>
              <figcaption className="caption">V(θ) ON THE UNIT CIRCLE, XZ-PLANE · TEAL + · RUST −</figcaption></figure>
            <table className="lab-table"><caption className="caption">POTENTIAL AT r = ({r.map(v => v.toFixed(2)).join(', ')})</caption>
              <thead><tr><th /><th>Cartesian</th><th>Spherical</th><th>|Δ|</th></tr></thead><tbody>
                <tr><th>Quadrupole</th><td>{fmt(vCart)}</td><td>{fmt(vSph)}</td><td>{Math.abs(vCart - vSph).toExponential(1)}</td></tr>
                <tr><th>Dipole</th><td>{fmt(dCart)}</td><td>{fmt(dSph)}</td><td>{Math.abs(dCart - dSph).toExponential(1)}</td></tr>
                <tr><th>Round trip</th><td colSpan={3}>max |Θ − Θ′| = {roundTrip.toExponential(1)}</td></tr>
              </tbody></table>
          </div>
        </>}
        <p className="caption">ARBITRARY TEACHING INPUTS IN ATOMIC UNITS · NOT MOLECULAR DATA · <a href={SPHERICAL_SOURCE} target="_blank" rel="noopener noreferrer">SPHERICAL.PY AT THE PINNED COMMIT ↗</a></p>
      </div>
    </div>
  </section>;
}
