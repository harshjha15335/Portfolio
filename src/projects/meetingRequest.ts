/**
 * POST /api/meetings through meeting-intelligence-service @ ea732a9, hop by hop:
 * src/app.ts (helmet, cors, express.json 2mb, traceId, requestLogger, /api router, errorHandler),
 * src/routes/meeting.routes.ts (authenticate, validate(createMeetingSchema), asyncHandler(create)),
 * then MeetingController.create, MeetingService.createMeeting and MeetingRepository.create.
 *
 * Tested against real responses recorded by scripts/projects/meeting_request_reference.mjs,
 * which runs the repository's own modules on the locked Express, Zod and jsonwebtoken versions.
 * Two behaviours the recording surfaced, kept here because they are what the service does:
 * - A missing header answers "Invalid or expired token", not "Missing or invalid authorization
 *   header": AppError's constructor resets the prototype to AppError.prototype, so the
 *   `instanceof UnauthorizedError` check in authenticate() never matches and the catch replaces it.
 * - Malformed JSON fails inside express.json(), before traceIdMiddleware, and errorHandler only
 *   knows AppError and ZodError: the reply is 500 INTERNAL_ERROR with no traceId.
 */
import { meetingSource } from './meeting';

export type Auth = 'valid' | 'missing' | 'invalid' | 'expired';
export interface Detail { field: string; message: string }
export type HopState = 'pass' | 'stop' | 'skipped';
export interface Hop { name: string; file: string; href: string; state: HopState; note: string }
export const STUB_MEETING_ID = '00000000-0000-4000-8000-000000000001';

const zodType = (v: unknown) => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;

/** createMeetingSchema.safeParse(body) with Zod 3's messages and issue order. */
export function validateCreateMeeting(body: unknown): { details: Detail[]; data?: Record<string, unknown> } {
  const details: Detail[] = [];
  const add = (path: (string | number)[], message: string) => details.push({ field: path.join('.') || 'body', message });
  if (zodType(body) !== 'object') { add([], `Expected object, received ${zodType(body)}`); return { details }; }
  const b = body as Record<string, unknown>;
  const string = (v: unknown, path: (string | number)[], minMessage: string, max?: number) => {
    if (v === undefined) return add(path, 'Required'), undefined;
    if (typeof v !== 'string') return add(path, `Expected string, received ${zodType(v)}`), undefined;
    if (v.length < 1) add(path, minMessage);
    if (max !== undefined && v.length > max) add(path, `String must contain at most ${max} character(s)`);
    return v;
  };
  const array = (v: unknown, path: string[], minMessage: string, item: (x: unknown, i: number) => unknown) => {
    if (v === undefined) return add(path, 'Required'), undefined;
    if (!Array.isArray(v)) return add(path, `Expected array, received ${zodType(v)}`), undefined;
    if (v.length < 1) add(path, minMessage);
    return v.map(item);
  };
  const title = string(b.title, ['title'], 'Title is required', 500);
  const participants = array(b.participants, ['participants'], 'At least one participant is required', (p, i) => string(p, ['participants', i], 'String must contain at least 1 character(s)'));
  const date = new Date(b.meetingDate as string);
  if (Number.isNaN(date.getTime())) add(['meetingDate'], 'Invalid date');
  const transcript = array(b.transcript, ['transcript'], 'Transcript must have at least one entry', (e, i) => {
    if (zodType(e) !== 'object') return add(['transcript', i], `Expected object, received ${zodType(e)}`), undefined;
    const entry = e as Record<string, unknown>;
    return {
      timestamp: string(entry.timestamp, ['transcript', i, 'timestamp'], 'Timestamp is required'),
      speaker: string(entry.speaker, ['transcript', i, 'speaker'], 'Speaker is required'),
      text: string(entry.text, ['transcript', i, 'text'], 'Text is required'),
    };
  });
  // Zod drops keys the schema doesn't declare.
  return details.length ? { details } : { details, data: { title, participants, meetingDate: date.toISOString(), transcript } };
}

const HOPS: [string, string, string][] = [
  ['helmet()', 'src/app.ts', 'Sets security headers such as Content-Security-Policy.'],
  ['cors()', 'src/app.ts', 'Allows cross-origin callers.'],
  ["express.json({ limit: '2mb' })", 'src/app.ts', 'Parses the JSON body.'],
  ['traceIdMiddleware', 'src/middleware/traceId.ts', 'Reuses x-trace-id or creates a UUID, and echoes it.'],
  ['requestLoggerMiddleware', 'src/middleware/requestLogger.ts', 'Logs method, URL, status and duration when the response finishes.'],
  ['authenticate', 'src/middleware/auth.ts', 'Verifies the Bearer JWT.'],
  ['validate(createMeetingSchema)', 'src/validators/meeting.validator.ts', 'Zod-checks the body and replaces it with the parsed data.'],
  ['MeetingController.create', 'src/controllers/meeting.controller.ts', 'Takes userId from the token.'],
  ['MeetingService.createMeeting', 'src/services/meeting.service.ts', 'Maps the input to repository fields.'],
  ['MeetingRepository.create', 'src/repositories/meeting.repository.ts', 'prisma.meeting.create in PostgreSQL.'],
  ['sendSuccess / errorHandler', 'src/utils/apiResponse.ts', 'Wraps the result in { traceId, success, data | error }.'],
];

export function traceMeetingRequest({ auth, traceId, body }: { auth: Auth; traceId: string; body: string }, newId: () => string = () => crypto.randomUUID()) {
  const notes: string[] = HOPS.map(h => h[2]);
  let stopAt = -1, status = 201, header: string | null = null;
  let response: Record<string, unknown>;
  const trimmed = body.trim();
  let parsed: unknown = {};
  let parseError = false;
  if (trimmed) {
    // body-parser's strict mode only accepts an object or array at the top level.
    if (trimmed[0] !== '{' && trimmed[0] !== '[') parseError = true;
    else try { parsed = JSON.parse(trimmed); } catch { parseError = true; }
  }
  if (parseError) {
    stopAt = 2; status = 500;
    notes[2] = 'Throws a SyntaxError (status 400). errorHandler only recognises AppError and ZodError, so it answers 500.';
    response = { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } };
  } else {
    header = traceId.trim() || newId();
    const envelope = (rest: Record<string, unknown>) => ({ traceId: header, ...rest });
    if (auth !== 'valid') {
      stopAt = 5; status = 401;
      notes[5] = auth === 'missing'
        ? 'Throws "Missing or invalid authorization header", but the instanceof check fails (AppError resets the prototype), so the catch replaces it.'
        : auth === 'expired' ? 'jwt.verify throws TokenExpiredError.' : 'jwt.verify throws "invalid signature".';
      response = envelope({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    } else {
      const { details, data } = validateCreateMeeting(parsed);
      if (!data) {
        stopAt = 6; status = 400;
        notes[6] = `${details.length} issue${details.length === 1 ? '' : 's'}; passes a ValidationError to errorHandler.`;
        response = envelope({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details } });
      } else {
        response = envelope({ success: true, data: { id: STUB_MEETING_ID, ...data, userId: 'user-demo' } });
      }
    }
  }
  const hops: Hop[] = HOPS.map(([name, file], i) => ({
    name, file, href: meetingSource(file), note: notes[i],
    state: i === HOPS.length - 1 ? 'pass' : stopAt < 0 || i < stopAt ? 'pass' : i === stopAt ? 'stop' : 'skipped',
  }));
  return { hops, status, traceHeader: header, response };
}
