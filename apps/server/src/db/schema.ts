import {
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type {
  ApprovalDecision,
  ArtifactKind,
  ConflictStatus,
  ConflictType,
  ExecutionPlanItem,
  JobStatus,
  MessageDirection,
  MessageType,
  StepStatus,
} from '@taro/shared';

const id = () => text('id').primaryKey();
const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const jobs = sqliteTable('jobs', {
  id: id(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').$type<JobStatus>().notNull().default('planning'),
  executionPlan: text('execution_plan', { mode: 'json' }).$type<ExecutionPlanItem[]>(),
  trueforgeSessionId: text('trueforge_session_id'),
  createdAt: createdAt(),
});

export const parties = sqliteTable(
  'parties',
  {
    id: id(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role').notNull(),
    channel: text('channel').notNull().default('chat'),
    instructions: text('instructions').notNull().default(''),
    status: text('status').notNull().default('idle'),
    isCoordinator: integer('is_coordinator').notNull().default(0),
  },
  (t) => [
    index('parties_job_idx').on(t.jobId),
    // Composite FK target: lets child tables prove a party belongs to a job.
    uniqueIndex('parties_job_id_id_uidx').on(t.jobId, t.id),
  ],
);

export const steps = sqliteTable(
  'steps',
  {
    id: id(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    sequenceNum: integer('sequence_num').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    requiredParties: text('required_parties', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    dependsOn: text('depends_on', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    conditions: text('conditions').notNull().default(''),
    status: text('status').$type<StepStatus>().notNull().default('pending'),
    notes: text('notes'),
    completedAt: text('completed_at'),
  },
  (t) => [index('steps_job_idx').on(t.jobId)],
);

export const jobLog = sqliteTable(
  'job_log',
  {
    id: id(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    partyId: text('party_id'),
    direction: text('direction').$type<MessageDirection>().notNull(),
    message: text('message').notNull(),
    messageType: text('message_type').$type<MessageType>().notNull().default('chat'),
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index('job_log_job_idx').on(t.jobId),
    index('job_log_party_idx').on(t.partyId),
    // (jobId, partyId) must match the party's owning job, so a log row can
    // never attribute a message to a party from a different job. SQLite
    // skips the check when partyId is NULL (system entries).
    foreignKey({
      columns: [t.jobId, t.partyId],
      foreignColumns: [parties.jobId, parties.id],
      name: 'job_log_party_owned_by_job_fk',
    }),
  ],
);

export const conflicts = sqliteTable(
  'conflicts',
  {
    id: id(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    conflictType: text('conflict_type').$type<ConflictType>().notNull(),
    description: text('description').notNull(),
    affectedParties: text('affected_parties', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    rawData: text('raw_data', { mode: 'json' }).$type<Record<string, unknown>>(),
    sandboxScript: text('sandbox_script'),
    sandboxOutput: text('sandbox_output'),
    resolution: text('resolution'),
    status: text('status').$type<ConflictStatus>().notNull().default('open'),
    createdAt: createdAt(),
  },
  (t) => [index('conflicts_job_idx').on(t.jobId)],
);

export const approvals = sqliteTable(
  'approvals',
  {
    id: id(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    toolCallId: text('tool_call_id').notNull(),
    threadId: text('thread_id'),
    actionType: text('action_type').notNull(),
    description: text('description').notNull(),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
    decision: text('decision').$type<ApprovalDecision>(),
    rejectionReason: text('rejection_reason'),
    decidedAt: text('decided_at'),
    /** 1 once this decision has been sent back to the harness in a resume turn. */
    resumed: integer('resumed').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('approvals_job_idx').on(t.jobId)],
);

export const artifacts = sqliteTable(
  'artifacts',
  {
    id: id(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind').$type<ArtifactKind>().notNull(),
    path: text('path').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [index('artifacts_job_idx').on(t.jobId)],
);

export const files = sqliteTable(
  'files',
  {
    id: id(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    partyId: text('party_id').notNull(),
    name: text('name').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    path: text('path').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('files_job_idx').on(t.jobId),
    // Uploads are always attributed to a party of the same job.
    foreignKey({
      columns: [t.jobId, t.partyId],
      foreignColumns: [parties.jobId, parties.id],
      name: 'files_party_owned_by_job_fk',
    }),
  ],
);

export const partyRegistry = sqliteTable(
  'party_registry',
  {
    id: id(),
    partyNameNormalized: text('party_name_normalized').notNull(),
    partyType: text('party_type').notNull(),
    jobId: text('job_id').notNull(),
    jobTitle: text('job_title').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    status: text('status').notNull().default('active'),
  },
  (t) => [index('party_registry_name_idx').on(t.partyNameNormalized)],
);
