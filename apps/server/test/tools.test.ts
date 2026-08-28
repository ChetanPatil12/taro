import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TaroWsEvent } from '@taro/shared';
import { createDb, schema } from '../src/db/index.js';
import type { TaroDb } from '../src/db/index.js';
import { createTools } from '../src/mcp/tools.js';
import type { TaroTools } from '../src/mcp/tools.js';
import type { WsHub } from '../src/ws/hub.js';

class StubHub {
  events: TaroWsEvent[] = [];
  broadcast(event: TaroWsEvent) {
    this.events.push(event);
  }
  ofType(type: TaroWsEvent['event']) {
    return this.events.filter((e) => e.event === type);
  }
}

describe('MCP tools', () => {
  let db: TaroDb;
  let hub: StubHub;
  let tools: TaroTools;
  let jobId: string;
  let sarahId: string;
  let bobId: string;
  let step1: string;
  let step2: string;

  beforeEach(() => {
    db = createDb(':memory:');
    hub = new StubHub();
    tools = createTools(db, hub as unknown as WsHub);

    jobId = randomUUID();
    sarahId = randomUUID();
    bobId = randomUUID();
    step1 = randomUUID();
    step2 = randomUUID();
    db.insert(schema.jobs).values({ id: jobId, title: 'Roof', description: 'Fix roof' }).run();
    db.insert(schema.parties)
      .values([
        { id: sarahId, jobId, name: 'Sarah', role: 'homeowner' },
        { id: bobId, jobId, name: 'Bob', role: 'subcontractor' },
      ])
      .run();
    db.insert(schema.steps)
      .values([
        { id: step1, jobId, sequenceNum: 1, title: 'Contact homeowner' },
        { id: step2, jobId, sequenceNum: 2, title: 'Inspection' },
      ])
      .run();
  });

  it('post_party_message logs and broadcasts with party name', () => {
    const res = tools.post_party_message({
      job_id: jobId,
      party_id: sarahId,
      direction: 'outbound',
      message: 'Hello Sarah',
    });
    expect(res.status).toBe('recorded');
    const events = hub.ofType('new_message');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ partyName: 'Sarah', jobId });
  });

  it('post_party_message rejects a party from another job', () => {
    const otherJob = randomUUID();
    db.insert(schema.jobs).values({ id: otherJob, title: 'X', description: 'Y' }).run();
    expect(() =>
      tools.post_party_message({
        job_id: otherJob,
        party_id: sarahId,
        direction: 'outbound',
        message: 'hi',
      }),
    ).toThrow(/Unknown party_id/);
  });

  it('update_step_status broadcasts dag_update and completes the job on final step', () => {
    tools.update_step_status({ job_id: jobId, step_id: step1, status: 'complete' });
    expect(hub.ofType('dag_update')).toHaveLength(1);
    expect(hub.ofType('job_status')).toHaveLength(0);

    const res = tools.update_step_status({ job_id: jobId, step_id: step2, status: 'complete' });
    expect(res.jobCompleted).toBe(true);
    expect(hub.ofType('job_status')[0]).toMatchObject({ status: 'completed' });
  });

  it('flag_conflict creates then resolves a conflict', () => {
    const created = tools.flag_conflict({
      job_id: jobId,
      conflict_type: 'cross_job_resource',
      description: 'Bob double-booked',
      affected_parties: [bobId],
    });
    expect(created.status).toBe('open');

    const resolved = tools.flag_conflict({
      job_id: jobId,
      conflict_id: created.conflict_id,
      sandbox_script: 'print(1)',
      sandbox_output: '{"window": "Aug 28-29"}',
      resolution: 'Moved to Aug 28-29',
      status: 'resolved',
    });
    expect(resolved.status).toBe('resolved');
    expect(hub.ofType('conflict')).toHaveLength(2);
  });

  it('flag_conflict requires type and description on create', () => {
    expect(() => tools.flag_conflict({ job_id: jobId, description: 'no type' })).toThrow(
      /conflict_type and description/,
    );
  });

  it('check_resource_availability detects overlaps and next free date', () => {
    db.insert(schema.partyRegistry)
      .values({
        id: randomUUID(),
        partyNameNormalized: "bob's roofing",
        partyType: 'subcontractor',
        jobId: 'other-job',
        jobTitle: 'Johnson Gutters',
        startDate: '2026-08-26',
        endDate: '2026-08-27',
      })
      .run();

    const clash = tools.check_resource_availability({
      party_name: "Bob's Roofing",
      proposed_start_date: '2026-08-27',
      proposed_end_date: '2026-08-28',
    });
    expect(clash.available).toBe(false);
    expect(clash.conflicts).toHaveLength(1);
    expect(clash.next_available_date).toBe('2026-08-28');

    const free = tools.check_resource_availability({
      party_name: "Bob's Roofing",
      proposed_start_date: '2026-08-28',
      proposed_end_date: '2026-08-29',
    });
    expect(free.available).toBe(true);

    const excluded = tools.check_resource_availability({
      party_name: "Bob's Roofing",
      proposed_start_date: '2026-08-26',
      proposed_end_date: '2026-08-27',
      requesting_job_id: 'other-job',
    });
    expect(excluded.available).toBe(true);
  });

  it('clears completedAt and reopens the job when a step regresses', () => {
    tools.update_step_status({ job_id: jobId, step_id: step1, status: 'complete' });
    tools.update_step_status({ job_id: jobId, step_id: step2, status: 'complete' });
    expect(tools.get_job_state({ job_id: jobId }).job.status).toBe('completed');

    tools.update_step_status({ job_id: jobId, step_id: step2, status: 'blocked' });
    const state = tools.get_job_state({ job_id: jobId });
    expect(state.job.status).toBe('active');
    const step = state.steps.find((s) => s.id === step2);
    expect(step?.completedAt).toBeNull();
    expect(step?.status).toBe('blocked');
  });

  it('next_available_date skips adjacent later bookings', () => {
    const seed = (start: string, end: string) =>
      db
        .insert(schema.partyRegistry)
        .values({
          id: randomUUID(),
          partyNameNormalized: 'crew',
          partyType: 'subcontractor',
          jobId: 'other',
          jobTitle: 'Other',
          startDate: start,
          endDate: end,
        })
        .run();
    seed('2027-01-01', '2027-01-10');
    seed('2027-01-11', '2027-01-15');

    const res = tools.check_resource_availability({
      party_name: 'Crew',
      proposed_start_date: '2027-01-02',
      proposed_end_date: '2027-01-04',
    });
    expect(res.available).toBe(false);
    // Jan 11 (day after first booking) is itself booked — must land after both.
    expect(res.next_available_date).toBe('2027-01-16');
  });

  it('save_execution_plan stores the plan and moves the job to awaiting_approval', () => {
    const res = tools.save_execution_plan({
      job_id: jobId,
      plan: [
        {
          step_title: 'Contact homeowner',
          actions: 'Send intro',
          parties: ['Sarah'],
          decisions_needed: [],
        },
      ],
    });
    expect(res.saved).toBe(true);
    expect(tools.get_job_state({ job_id: jobId }).job.status).toBe('awaiting_approval');
    expect(hub.ofType('plan_ready')).toHaveLength(1);
  });

  it('commit_decision records a decision log entry', () => {
    tools.commit_decision({
      job_id: jobId,
      action_type: 'confirm_date',
      description: 'Inspection on Aug 28',
      payload: { date: '2026-08-28' },
    });
    const state = tools.get_job_state({ job_id: jobId });
    const decision = state.recent_log.find((e) => e.messageType === 'decision');
    expect(decision?.message).toContain('confirm_date');
  });

  it('store_artifact versions repeated names and marks pending download', () => {
    const v1 = tools.store_artifact({
      job_id: jobId,
      name: 'schedule.ics',
      kind: 'ics',
      sandbox_path: '/tmp/schedule.ics',
    });
    const v2 = tools.store_artifact({
      job_id: jobId,
      name: 'schedule.ics',
      kind: 'ics',
      sandbox_path: '/tmp/schedule.ics',
    });
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(v2.status).toBe('pending_download');
  });

  it('get_party_context returns history, active steps, and cross-party decisions', () => {
    tools.update_step_status({ job_id: jobId, step_id: step1, status: 'active' });
    tools.post_party_message({
      job_id: jobId,
      party_id: sarahId,
      direction: 'outbound',
      message: 'Hi Sarah',
    });
    tools.post_party_message({
      job_id: jobId,
      party_id: bobId,
      direction: 'inbound',
      message: 'I can do Thursday',
      message_type: 'decision',
    });

    const ctx = tools.get_party_context({ job_id: jobId, party_id: sarahId });
    expect(ctx.party.name).toBe('Sarah');
    expect(ctx.conversation_history).toHaveLength(1);
    expect(ctx.active_steps.map((s) => s.title)).toEqual(['Contact homeowner']);
    expect(ctx.decisions_from_other_parties).toHaveLength(1);
    expect(ctx.decisions_from_other_parties[0]?.message).toContain('Thursday');
  });

  it('get_job_state aggregates the full picture', () => {
    tools.flag_conflict({
      job_id: jobId,
      conflict_type: 'schedule',
      description: 'clash',
    });
    const state = tools.get_job_state({ job_id: jobId });
    expect(state.parties).toHaveLength(2);
    expect(state.steps).toHaveLength(2);
    expect(state.open_conflicts).toHaveLength(1);
    expect(state.pending_approvals).toHaveLength(0);
  });
});
