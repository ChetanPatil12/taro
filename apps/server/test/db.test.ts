import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, schema } from '../src/db/index.js';
import type { TaroDb } from '../src/db/index.js';

describe('database schema', () => {
  let db: TaroDb;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  function insertJob() {
    const jobId = randomUUID();
    db.insert(schema.jobs)
      .values({ id: jobId, title: 'Roof repair', description: 'Fix the west face' })
      .run();
    return jobId;
  }

  it('creates a job with defaults applied', () => {
    const jobId = insertJob();
    const job = db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).get();
    expect(job).toBeDefined();
    expect(job?.status).toBe('planning');
    expect(job?.executionPlan).toBeNull();
    expect(job?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('round-trips JSON columns on steps', () => {
    const jobId = insertJob();
    const stepId = randomUUID();
    db.insert(schema.steps)
      .values({
        id: stepId,
        jobId,
        sequenceNum: 1,
        title: 'Coordinate inspection',
        requiredParties: ['pm', 'subcontractor'],
        dependsOn: ['Initial contact'],
      })
      .run();

    const step = db.select().from(schema.steps).where(eq(schema.steps.id, stepId)).get();
    expect(step?.requiredParties).toEqual(['pm', 'subcontractor']);
    expect(step?.dependsOn).toEqual(['Initial contact']);
    expect(step?.status).toBe('pending');
  });

  it('enforces foreign keys', () => {
    expect(() =>
      db
        .insert(schema.parties)
        .values({ id: randomUUID(), jobId: 'missing-job', name: 'Sarah', role: 'homeowner' })
        .run(),
    ).toThrow(/FOREIGN KEY/i);
  });

  it('cascades deletes from jobs to child rows', () => {
    const jobId = insertJob();
    const partyId = randomUUID();
    db.insert(schema.parties)
      .values({ id: partyId, jobId, name: 'Sarah Chen', role: 'homeowner' })
      .run();
    db.insert(schema.jobLog)
      .values({ id: randomUUID(), jobId, partyId, direction: 'inbound', message: 'hello' })
      .run();

    db.delete(schema.jobs).where(eq(schema.jobs.id, jobId)).run();

    expect(db.select().from(schema.parties).all()).toHaveLength(0);
    expect(db.select().from(schema.jobLog).all()).toHaveLength(0);
  });

  it('stores registry commitments queryable by normalized name', () => {
    db.insert(schema.partyRegistry)
      .values({
        id: randomUUID(),
        partyNameNormalized: "bob's roofing",
        partyType: 'subcontractor',
        jobId: 'preset-conflict-job-001',
        jobTitle: 'Johnson Gutters Replacement',
        startDate: '2026-08-26',
        endDate: '2026-08-27',
      })
      .run();

    const rows = db
      .select()
      .from(schema.partyRegistry)
      .where(eq(schema.partyRegistry.partyNameNormalized, "bob's roofing"))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('active');
  });

  it('records approvals with nullable decision until decided', () => {
    const jobId = insertJob();
    const approvalId = randomUUID();
    db.insert(schema.approvals)
      .values({
        id: approvalId,
        jobId,
        toolCallId: 'call_123',
        actionType: 'confirm_date',
        description: 'Confirm inspection on Aug 28',
        payload: { date: '2026-08-28' },
      })
      .run();

    const approval = db
      .select()
      .from(schema.approvals)
      .where(eq(schema.approvals.id, approvalId))
      .get();
    expect(approval?.decision).toBeNull();
    expect(approval?.payload).toEqual({ date: '2026-08-28' });
  });
});
