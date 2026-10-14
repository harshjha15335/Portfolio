/**
 * Build the Andheri Backend Workshop fixtures by sending real HTTP requests through
 * meeting-intelligence-service's own request path.
 *
 * Usage: node scripts/projects/meeting_request_reference.mjs <meeting-checkout> <deps-dir> <out.json>
 *
 * <deps-dir> holds node_modules with the versions in the service's package-lock.json
 * (express 4.22.2, zod 3.25.76, jsonwebtoken 9.0.3, uuid 11.1.1, helmet 8.2.0, cors 2.8.6).
 * The script bundles the repository's middleware, validator, controller, service, error and
 * response modules unchanged with esbuild, and rebuilds the app.ts / meeting.routes.ts chain
 * for POST /api/meetings. Only three things are stubbed: config (a fixed JWT secret), the
 * Winston logger (silent) and the Prisma repository (an in-memory create). The portfolio's
 * port (src/projects/meetingRequest.ts) is tested against the recorded responses.
 */
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [repo, deps, out] = process.argv.slice(2).map(p => resolve(p));
const src = join(repo, 'src');
const work = mkdtempSync(join(tmpdir(), 'meeting-ref-'));
const SECRET = 'reference-secret-not-used-anywhere';

writeFileSync(join(work, 'config.ts'), `export const config = { JWT_SECRET: '${SECRET}' };`);
writeFileSync(join(work, 'logger.ts'), 'export const logWithTrace = () => {}; export const logRequest = () => {}; export const logger = { info() {}, warn() {}, error() {} };');
writeFileSync(join(work, 'prisma.ts'), "export const ActionItemStatus = { PENDING: 'PENDING', IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED' };");
writeFileSync(join(work, 'entry.ts'), `
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Router } from 'express';
import { errorHandler } from '${src}/middleware/errorHandler';
import { requestLoggerMiddleware } from '${src}/middleware/requestLogger';
import { traceIdMiddleware } from '${src}/middleware/traceId';
import { authenticate } from '${src}/middleware/auth';
import { validate } from '${src}/middleware/validate';
import { asyncHandler } from '${src}/utils/asyncHandler';
import { createMeetingSchema } from '${src}/validators/meeting.validator';
import { MeetingController } from '${src}/controllers/meeting.controller';
import { MeetingService } from '${src}/services/meeting.service';

const repository = { create: async (data: any) => ({ id: '00000000-0000-4000-8000-000000000001', ...data }) };
const controller = new MeetingController(new MeetingService(repository as any, {} as any, {} as any, {} as any));
const meetings = Router();
meetings.use(authenticate);
meetings.post('/', validate(createMeetingSchema), asyncHandler(controller.create));
const api = Router();
api.use('/meetings', meetings);
export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(traceIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
`);

const alias = { [join(src, 'config')]: join(work, 'config.ts'), [join(src, 'utils/logger')]: join(work, 'logger.ts') };
await build({
  entryPoints: [join(work, 'entry.ts')], bundle: true, platform: 'node', format: 'esm', outfile: join(work, 'app.mjs'),
  nodePaths: [join(deps, 'node_modules')], logLevel: 'error',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  plugins: [{ name: 'stubs', setup(b) {
    b.onResolve({ filter: /^@prisma\/client$/ }, () => ({ path: join(work, 'prisma.ts') }));
    b.onResolve({ filter: /(config|logger)$/ }, args => {
      const target = alias[resolve(args.resolveDir, args.path)];
      return target ? { path: target } : undefined;
    });
  } }],
});

const jwt = createRequire(join(deps, 'node_modules/'))('jsonwebtoken');
const { createApp } = await import(pathToFileURL(join(work, 'app.mjs')).href);
const server = createApp().listen(0);
await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}/api/meetings`;

const valid = { title: 'Campus Cart release planning', participants: ['Asha', 'Rohan'], meetingDate: '2026-10-12T10:00:00Z', transcript: [{ timestamp: '00:01', speaker: 'Asha', text: 'Ship the cart fix on Friday.' }] };
const TOKEN = jwt.sign({ userId: 'user-demo', email: 'demo@example.com' }, SECRET);
const BAD = jwt.sign({ userId: 'user-demo' }, 'some-other-secret');
const EXPIRED = jwt.sign({ userId: 'user-demo', exp: 1 }, SECRET);
const J = o => JSON.stringify(o);
const CASES = [
  ['valid', 'Valid request', 'valid', '', J(valid)],
  ['trace', 'Valid, with your own x-trace-id', 'valid', 'my-trace-42', J(valid)],
  ['no-token', 'No Authorization header', 'missing', '', J(valid)],
  ['bad-token', 'Token signed with another secret', 'invalid', '', J(valid)],
  ['expired', 'Expired token', 'expired', '', J(valid)],
  ['auth-first', 'No token and an empty body', 'missing', '', '{}'],
  ['empty', 'Empty object', 'valid', '', '{}'],
  ['blank-fields', 'Blank title, no participants, empty transcript', 'valid', '', J({ ...valid, title: '', participants: [], transcript: [] })],
  ['bad-entry', 'Transcript entry missing speaker and text', 'valid', '', J({ ...valid, transcript: [{ timestamp: '00:01', speaker: '', text: '' }] })],
  ['bad-date', 'Unparseable meeting date', 'valid', '', J({ ...valid, meetingDate: 'next Tuesday' })],
  ['wrong-types', 'Wrong types', 'valid', '', J({ ...valid, title: 7, participants: 'Asha' })],
  ['long-title', 'Title over 500 characters', 'valid', '', J({ ...valid, title: 'x'.repeat(501) })],
  ['malformed', 'Malformed JSON body', 'valid', 'my-trace-42', '{"title": "Campus Cart",'],
  ['extra', 'Unknown extra field', 'valid', '', J({ ...valid, priority: 'high' })],
];
const results = [];
for (const [id, label, auth, traceId, body] of CASES) {
  const headers = { 'content-type': 'application/json' };
  if (auth === 'valid') headers.authorization = `Bearer ${TOKEN}`;
  if (auth === 'invalid') headers.authorization = `Bearer ${BAD}`;
  if (auth === 'expired') headers.authorization = `Bearer ${EXPIRED}`;
  if (traceId) headers['x-trace-id'] = traceId;
  const res = await fetch(base, { method: 'POST', headers, body });
  const json = await res.json();
  results.push({ id, label, auth, traceId, body, status: res.status, traceHeader: res.headers.get('x-trace-id'), csp: !!res.headers.get('content-security-policy'), response: json });
}
server.close();
const lock = JSON.parse((await import('node:fs')).readFileSync(join(repo, 'package-lock.json'), 'utf8')).packages;
writeFileSync(out, JSON.stringify({
  source: 'harshjha15335/meeting-intelligence-service', commit: 'ea732a9418be7c2377be0018362f851b003b43de',
  versions: Object.fromEntries(['express', 'zod', 'jsonwebtoken', 'body-parser'].map(k => [k, createRequire(join(deps, 'node_modules/'))(`${k}/package.json`).version + ` (lock: ${lock['node_modules/' + k]?.version})`])),
  cases: results,
}, null, 1) + '\n');
for (const r of results) console.log(r.id, r.status, r.traceHeader, JSON.stringify(r.response).slice(0, 160));
