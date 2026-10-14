/**
 * Meeting Intelligence, ported from harshjha15335/meeting-intelligence-service @ ea732a9:
 * - createMeetingSchema rules: src/validators/meeting.validator.ts
 * - validate() error envelope: src/middleware/validate.ts + src/utils/errors.ts
 * - MeetingAnalysisResult shape and citation rule: src/types/index.ts, AI_APPROACH.md
 * - overdue query + reminder outcomes: src/repositories/actionItem.repository.ts, src/services/reminder.service.ts
 * The service calls Gemini for analysis. The exhibit never calls a model: its analysis is a
 * hand-written example in the service's output shape, and is labelled as such.
 */
export const MEETING_COMMIT = 'ea732a9418be7c2377be0018362f851b003b43de';
export const meetingSource = (path: string) => `https://github.com/harshjha15335/meeting-intelligence-service/blob/${MEETING_COMMIT}/${path}`;

export interface TranscriptEntry { timestamp: string; speaker: string; text: string }
export interface MeetingInput { title: string; participants: string[]; meetingDate: string; transcript: TranscriptEntry[] }
export interface Cited { text: string; citations: { timestamp: string }[] }
export interface CitedAction { task: string; assignee?: string; dueDate?: string; citations: { timestamp: string }[] }
export interface MeetingAnalysisResult { summary: Cited[]; actionItems: CitedAction[]; decisions: Cited[]; followUps: Cited[] }
export type Status = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

/** createMeetingSchema + validate(): returns the 400 envelope the API would send. */
export function validateMeeting(input: MeetingInput) {
  const details: { field: string; message: string }[] = [];
  if (!input.title) details.push({ field: 'title', message: 'Title is required' });
  else if (input.title.length > 500) details.push({ field: 'title', message: 'String must contain at most 500 character(s)' });
  if (input.participants.length < 1) details.push({ field: 'participants', message: 'At least one participant is required' });
  input.participants.forEach((p, i) => { if (!p) details.push({ field: `participants.${i}`, message: 'String must contain at least 1 character(s)' }); });
  if (Number.isNaN(Date.parse(input.meetingDate))) details.push({ field: 'meetingDate', message: 'Invalid meeting date' });
  if (input.transcript.length < 1) details.push({ field: 'transcript', message: 'Transcript must have at least one entry' });
  input.transcript.forEach((e, i) => {
    if (!e.timestamp) details.push({ field: `transcript.${i}.timestamp`, message: 'Timestamp is required' });
    if (!e.speaker) details.push({ field: `transcript.${i}.speaker`, message: 'Speaker is required' });
    if (!e.text) details.push({ field: `transcript.${i}.text`, message: 'Text is required' });
  });
  return details.length ? { status: 400, body: { success: false as const, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details } } } : { status: 201, body: { success: true as const } };
}

/** AI_APPROACH.md: every item must cite a timestamp that exists in the transcript. */
export function uncitedItems(result: MeetingAnalysisResult, transcript: TranscriptEntry[]) {
  const stamps = new Set(transcript.map(e => e.timestamp));
  return [...result.summary, ...result.decisions, ...result.followUps, ...result.actionItems]
    .filter(item => !item.citations.length || item.citations.some(c => !stamps.has(c.timestamp)));
}

/** findAllOverdue + ReminderService.sendReminderForItem outcomes. */
export function reminderOutcome(item: { status: Status; dueDate?: string }, now: Date, telegramConfigured: boolean) {
  const overdue = item.status !== 'COMPLETED' && !!item.dueDate && new Date(item.dueDate) < now;
  if (!overdue) return { overdue, sent: false, history: null };
  if (!telegramConfigured) return { overdue, sent: false, history: 'success: false · error: "Telegram not configured"' };
  return { overdue, sent: true, history: 'success: true · Telegram reminder sent' };
}

/** Synthetic meeting used by the exhibit. */
export const SAMPLE_MEETING: MeetingInput = {
  title: 'Campus Cart release planning (synthetic)',
  participants: ['Asha', 'Rohan', 'Meera'],
  meetingDate: '2026-10-05T10:00:00+05:30',
  transcript: [
    { timestamp: '00:04', speaker: 'Asha', text: 'Goal for today: decide whether the order-tracking page ships this sprint.' },
    { timestamp: '00:41', speaker: 'Rohan', text: 'The API is ready, but pagination on the orders endpoint still returns duplicates.' },
    { timestamp: '01:15', speaker: 'Meera', text: 'Then we ship tracking on Friday and keep pagination behind a flag.' },
    { timestamp: '01:32', speaker: 'Asha', text: 'Agreed. Rohan, can you fix the duplicate rows by Wednesday?' },
    { timestamp: '01:40', speaker: 'Rohan', text: 'Yes, I will fix the duplicate pagination rows by Wednesday.' },
    { timestamp: '02:10', speaker: 'Meera', text: 'I will write the release notes before Friday.' },
    { timestamp: '02:36', speaker: 'Asha', text: 'Let us check load-test numbers again next week before removing the flag.' },
  ],
};

/** Example output in MeetingAnalysisResult shape. Written for the exhibit, not produced by Gemini. */
export const SAMPLE_ANALYSIS: MeetingAnalysisResult = {
  summary: [
    { text: 'The team reviewed whether order tracking can ship this sprint.', citations: [{ timestamp: '00:04' }] },
    { text: 'The orders endpoint still returns duplicate rows when paginating.', citations: [{ timestamp: '00:41' }] },
  ],
  decisions: [{ text: 'Ship order tracking on Friday with pagination behind a feature flag.', citations: [{ timestamp: '01:15' }, { timestamp: '01:32' }] }],
  actionItems: [
    { task: 'Fix duplicate pagination rows on the orders endpoint', assignee: 'Rohan', dueDate: '2026-10-08', citations: [{ timestamp: '01:32' }, { timestamp: '01:40' }] },
    { task: 'Write the release notes', assignee: 'Meera', dueDate: '2026-10-10', citations: [{ timestamp: '02:10' }] },
  ],
  followUps: [{ text: 'Re-check load-test numbers next week before removing the flag.', citations: [{ timestamp: '02:36' }] }],
};
