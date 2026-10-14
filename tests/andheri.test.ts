import { describe, expect, it } from 'vitest';
import guard from '../src/projects/data/northstar-guard.json';
import requests from '../src/projects/data/meeting-requests.json';
import { meetingGuard, northstarGuard, stripFences, type Evidence } from '../src/projects/aiguard';
import { STUB_MEETING_ID, traceMeetingRequest, type Auth } from '../src/projects/meetingRequest';
import { PIPELINES, simulate } from '../src/projects/pipelines';
import { SHOPS } from '../src/data/shops';
import { projects } from '../src/data/projects';

describe('AI Integration Lab: NORTHSTAR guard matches the real Pydantic model and DecisionAgent', () => {
  for (const c of guard.cases) it(`${c.id}: ${c.label}`, () => {
    const result = northstarGuard(c.raw, guard.evidence as Evidence);
    expect(result.stage).toBe(c.stage);
    if (result.stage === 'decision') expect(result.message).toBe(c.message);
    if (result.stage === 'schema') {
      const expected = c.errors!;
      expect(result.errors.map(e => [e.loc, e.type])).toEqual(expected.map(e => [e.loc, e.type]));
      // Pydantic's JSON and datetime parser messages carry positions; every other message must match exactly.
      result.errors.forEach((e, i) => { if (!['json_invalid', 'datetime_from_date_parsing'].includes(e.type)) expect(e.msg).toBe(expected[i].msg); });
    }
  });
  it('strips fences exactly like XAIProvider.propose', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFences('```{"a":1}```')).toBe('{"a":1}');
    expect(stripFences('  {"a":1} ')).toBe('{"a":1}');
  });
});

describe('AI Integration Lab: Meeting Intelligence repairs instead of rejecting', () => {
  it('fills missing categories and citations with empty arrays', () => {
    const r = meetingGuard('{"summary":[{"text":"Ship Friday"}],"decisions":"none"}');
    expect(r.ok && r.result).toEqual({ summary: [{ text: 'Ship Friday', citations: [] }], actionItems: [], decisions: [], followUps: [] });
    expect(r.ok && r.repairs).toEqual(['summary[0].citations was missing, replaced with []', 'actionItems was missing, replaced with []', 'decisions was not an array, replaced with []', 'followUps was missing, replaced with []']);
  });
  it('turns unparseable or null replies into a 502', () => {
    expect(meetingGuard('```json\n{}\n```')).toMatchObject({ ok: false, status: 502, code: 'EXTERNAL_SERVICE_ERROR' });
    expect(meetingGuard('null')).toMatchObject({ ok: false, status: 502 });
  });
});

describe('Backend Workshop: POST /api/meetings matches responses recorded from the real service code', () => {
  for (const c of requests.cases) it(`${c.id}: ${c.label}`, () => {
    const r = traceMeetingRequest({ auth: c.auth as Auth, traceId: c.traceId, body: c.body }, () => 'generated');
    expect(r.status).toBe(c.status);
    const traceId = (c.response as { traceId?: string }).traceId;
    expect(r.traceHeader === null).toBe(c.traceHeader === null);
    if (c.traceId && c.traceHeader) expect(r.traceHeader).toBe(c.traceId);
    // Generated trace ids differ run to run; everything else must be identical.
    expect({ ...r.response, traceId: traceId && 'x' }).toEqual({ ...c.response, traceId: traceId && 'x' });
  });
  it('stops at the hop that answered', () => {
    const at = (auth: Auth, body: string) => traceMeetingRequest({ auth, traceId: '', body }).hops.find(h => h.state === 'stop')?.name;
    expect(at('valid', '{')).toBe("express.json({ limit: '2mb' })");
    expect(at('missing', '{}')).toBe('authenticate');
    expect(at('valid', '{}')).toBe('validate(createMeetingSchema)');
    expect(at('valid', requests.cases[0].body)).toBeUndefined();
    expect(requests.cases[0].response).toMatchObject({ data: { id: STUB_MEETING_ID } });
  });
});

describe('DevOps Garage pipelines', () => {
  const rootcause = PIPELINES.find(p => p.id === 'rootcause')!;
  it('passes everything and runs the gated deploy when nothing fails', () => {
    const run = simulate(rootcause, null);
    expect(run.success).toBe(true);
    expect(run.gated).toBe('runs');
  });
  it('skips the rest of a failing job, leaves parallel jobs alone and blocks the deploy', () => {
    const run = simulate(rootcause, { job: 'backend', step: 5 });
    expect(run.jobs[0].states.slice(4, 8)).toEqual(['pass', 'fail', 'skipped', 'skipped']);
    expect(run.jobs[1].conclusion).toBe('pass');
    expect(run.gated).toBe('skipped');
  });
  it('stops a multi-stage Docker build at the failing stage', () => {
    const run = simulate(PIPELINES.find(p => p.id === 'meeting')!, { job: 'builder', step: 1 });
    expect(run.jobs[0].states).toEqual(['pass', 'fail', 'skipped']);
    expect(run.jobs[1].conclusion).toBe('skipped');
  });
});

describe('Andheri shops', () => {
  it('has the five shops from the brief, each with skills and evidence', () => {
    expect(SHOPS.map(s => s.name)).toEqual(['Language Lane', 'Frontend Studio', 'Backend Workshop', 'DevOps Garage', 'AI Integration Lab']);
    const ids = new Set(projects.map(p => p.id));
    for (const shop of SHOPS) for (const skill of shop.skills) {
      expect(skill.what.length).toBeGreaterThan(10);
      if (skill.evidence === 'source') expect(skill.where.length).toBeGreaterThan(0);
      else expect(skill.where).toEqual([]);
      skill.where.forEach(w => { expect(w.href).toMatch(/^https:\/\/github\.com\//); if (w.project) expect(ids.has(w.project)).toBe(true); });
    }
  });
  it('marks résumé-only skills instead of inventing evidence', () => {
    const lane = SHOPS[0].skills;
    expect(lane.filter(s => s.evidence === 'resume').map(s => s.name)).toEqual(['Java', 'C++']);
  });
});
