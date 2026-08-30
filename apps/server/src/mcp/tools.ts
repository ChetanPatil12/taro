import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import type { ConflictStatus, ConflictType, MessageDirection, MessageType } from '@taro/shared';
import type { TaroDb } from '../db/index.js';
import { schema } from '../db/index.js';
import type { WsHub } from '../ws/hub.js';

/**
 * The nine tools the orchestrator agent uses to read and write job state.
 * Implemented as plain functions so they are unit-testable without the MCP
 * transport; src/mcp/server.ts wraps them into MCP tool registrations.
 *
 * Every write broadcasts its WebSocket event here, in-process — this is the
 * single path through which agent activity reaches the UI.
 */
export function createTools(db: TaroDb, hub: WsHub) {
  const nowIso = () => new Date().toISOString();

  function requireJob(jobId: string) {
    const job = db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).get();
    if (!job) throw new Error(`Unknown job_id: ${jobId}`);
    return job;
  }

  function partyName(partyId: string | null): string | null {
    if (!partyId) return null;
    return (
      db.select().from(schema.parties).where(eq(schema.parties.id, partyId)).get()?.name ?? null
    );
  }

  function appendLog(entry: {
    jobId: string;
    partyId?: string | null;
    direction: MessageDirection;
    message: string;
    messageType?: MessageType;
    metadata?: Record<string, unknown> | null;
  }) {
    const row = {
      id: randomUUID(),
      jobId: entry.jobId,
      partyId: entry.partyId ?? null,
      direction: entry.direction,
      message: entry.message,
      messageType: entry.messageType ?? 'chat',
      metadata: entry.metadata ?? null,
      createdAt: nowIso(),
    } as const;
    db.insert(schema.jobLog).values(row).run();
    hub.broadcast({
      event: 'new_message',
      jobId: entry.jobId,
      entry: row,
      partyName: partyName(row.partyId),
    });
    return row;
  }

  return {
    /** Full shared-state snapshot; the orchestrator calls this every turn. */
    get_job_state(args: { job_id: string }) {
      const job = requireJob(args.job_id);
      const parties = db
        .select()
        .from(schema.parties)
        .where(eq(schema.parties.jobId, job.id))
        .all();
      const steps = db
        .select()
        .from(schema.steps)
        .where(eq(schema.steps.jobId, job.id))
        .orderBy(asc(schema.steps.sequenceNum))
        .all();
      const recentLog = db
        .select()
        .from(schema.jobLog)
        .where(eq(schema.jobLog.jobId, job.id))
        .orderBy(desc(schema.jobLog.createdAt))
        .limit(20)
        .all()
        .reverse();
      const openConflicts = db
        .select()
        .from(schema.conflicts)
        .where(and(eq(schema.conflicts.jobId, job.id), ne(schema.conflicts.status, 'resolved')))
        .all();
      const pendingApprovals = db
        .select()
        .from(schema.approvals)
        .where(and(eq(schema.approvals.jobId, job.id), isNull(schema.approvals.decision)))
        .all();
      const names = new Map(parties.map((p) => [p.id, p.name]));
      return {
        job: {
          id: job.id,
          title: job.title,
          description: job.description,
          status: job.status,
          execution_plan: job.executionPlan,
        },
        parties,
        steps,
        recent_log: recentLog.map((e) => ({
          ...e,
          partyName: e.partyId ? (names.get(e.partyId) ?? null) : null,
        })),
        open_conflicts: openConflicts,
        pending_approvals: pendingApprovals,
      };
    },

    /** Deep per-party context; each party subagent calls this first. */
    get_party_context(args: { job_id: string; party_id: string }) {
      requireJob(args.job_id);
      const party = db
        .select()
        .from(schema.parties)
        .where(and(eq(schema.parties.id, args.party_id), eq(schema.parties.jobId, args.job_id)))
        .get();
      if (!party) throw new Error(`Unknown party_id ${args.party_id} for job ${args.job_id}`);

      const history = db
        .select()
        .from(schema.jobLog)
        .where(and(eq(schema.jobLog.jobId, args.job_id), eq(schema.jobLog.partyId, party.id)))
        .orderBy(asc(schema.jobLog.createdAt))
        .all();
      const activeSteps = db
        .select()
        .from(schema.steps)
        .where(and(eq(schema.steps.jobId, args.job_id), eq(schema.steps.status, 'active')))
        .orderBy(asc(schema.steps.sequenceNum))
        .all();
      const decisions = db
        .select()
        .from(schema.jobLog)
        .where(and(eq(schema.jobLog.jobId, args.job_id), eq(schema.jobLog.messageType, 'decision')))
        .orderBy(asc(schema.jobLog.createdAt))
        .all()
        .filter((d) => d.partyId !== party.id);

      return {
        party,
        conversation_history: history,
        active_steps: activeSteps,
        decisions_from_other_parties: decisions,
      };
    },

    /** Record + broadcast a message to/from a party. */
    post_party_message(args: {
      job_id: string;
      party_id: string;
      direction: 'inbound' | 'outbound';
      message: string;
      message_type?: MessageType;
      metadata?: Record<string, unknown>;
      artifact_id?: string;
    }) {
      requireJob(args.job_id);
      const party = db
        .select()
        .from(schema.parties)
        .where(and(eq(schema.parties.id, args.party_id), eq(schema.parties.jobId, args.job_id)))
        .get();
      if (!party) throw new Error(`Unknown party_id ${args.party_id} for job ${args.job_id}`);

      // Attaching an artifact renders it as a document card in the chat.
      let metadata = args.metadata ?? null;
      let messageType = args.message_type ?? 'chat';
      if (args.artifact_id) {
        const artifact = db
          .select()
          .from(schema.artifacts)
          .where(
            and(eq(schema.artifacts.id, args.artifact_id), eq(schema.artifacts.jobId, args.job_id)),
          )
          .get();
        if (!artifact) throw new Error(`Unknown artifact_id ${args.artifact_id}`);
        metadata = {
          ...(metadata ?? {}),
          artifactId: artifact.id,
          artifactName: artifact.name,
          artifactKind: artifact.kind,
        };
        messageType = 'file';
      }

      const row = appendLog({
        jobId: args.job_id,
        partyId: args.party_id,
        direction: args.direction,
        message: args.message,
        messageType,
        metadata,
      });
      return { log_id: row.id, status: 'recorded' };
    },

    /** Move a step through its lifecycle and push the DAG update. */
    update_step_status(args: {
      job_id: string;
      step_id: string;
      status: 'pending' | 'active' | 'complete' | 'blocked';
      notes?: string;
    }) {
      requireJob(args.job_id);
      const step = db
        .select()
        .from(schema.steps)
        .where(and(eq(schema.steps.id, args.step_id), eq(schema.steps.jobId, args.job_id)))
        .get();
      if (!step) throw new Error(`Unknown step_id ${args.step_id} for job ${args.job_id}`);

      db.update(schema.steps)
        .set({
          status: args.status,
          notes: args.notes ?? step.notes,
          // A step moved out of 'complete' must not keep a stale timestamp.
          completedAt: args.status === 'complete' ? nowIso() : null,
        })
        .where(eq(schema.steps.id, step.id))
        .run();

      // Reopen a completed job if one of its steps regresses.
      const jobRow = requireJob(args.job_id);
      if (jobRow.status === 'completed' && args.status !== 'complete') {
        db.update(schema.jobs)
          .set({ status: 'active' })
          .where(eq(schema.jobs.id, args.job_id))
          .run();
        hub.broadcast({ event: 'job_status', jobId: args.job_id, status: 'active' });
      }

      appendLog({
        jobId: args.job_id,
        direction: 'system',
        message: `Step "${step.title}" → ${args.status}${args.notes ? ` (${args.notes})` : ''}`,
        messageType: 'system_event',
      });
      hub.broadcast({
        event: 'dag_update',
        jobId: args.job_id,
        stepId: step.id,
        stepTitle: step.title,
        status: args.status,
        notes: args.notes ?? null,
      });

      const remaining = db
        .select()
        .from(schema.steps)
        .where(and(eq(schema.steps.jobId, args.job_id), ne(schema.steps.status, 'complete')))
        .all();
      let jobCompleted = false;
      if (remaining.length === 0) {
        db.update(schema.jobs)
          .set({ status: 'completed' })
          .where(eq(schema.jobs.id, args.job_id))
          .run();
        hub.broadcast({ event: 'job_status', jobId: args.job_id, status: 'completed' });
        jobCompleted = true;
      }
      return { success: true, step_title: step.title, new_status: args.status, jobCompleted };
    },

    /** Create or update a conflict record (open → resolving → resolved). */
    flag_conflict(args: {
      job_id: string;
      conflict_id?: string;
      conflict_type?: ConflictType;
      description?: string;
      affected_parties?: string[];
      raw_data?: Record<string, unknown>;
      sandbox_script?: string;
      sandbox_output?: string;
      resolution?: string;
      status?: ConflictStatus;
    }) {
      requireJob(args.job_id);
      let conflictId = args.conflict_id;
      if (conflictId) {
        const existing = db
          .select()
          .from(schema.conflicts)
          .where(and(eq(schema.conflicts.id, conflictId), eq(schema.conflicts.jobId, args.job_id)))
          .get();
        if (!existing) throw new Error(`Unknown conflict_id ${conflictId} for job ${args.job_id}`);
        db.update(schema.conflicts)
          .set({
            description: args.description ?? existing.description,
            affectedParties: args.affected_parties ?? existing.affectedParties,
            rawData: args.raw_data ?? existing.rawData,
            sandboxScript: args.sandbox_script ?? existing.sandboxScript,
            sandboxOutput: args.sandbox_output ?? existing.sandboxOutput,
            resolution: args.resolution ?? existing.resolution,
            status: args.status ?? existing.status,
          })
          .where(eq(schema.conflicts.id, conflictId))
          .run();
      } else {
        if (!args.conflict_type || !args.description) {
          throw new Error('conflict_type and description are required when creating a conflict');
        }
        conflictId = randomUUID();
        db.insert(schema.conflicts)
          .values({
            id: conflictId,
            jobId: args.job_id,
            conflictType: args.conflict_type,
            description: args.description,
            affectedParties: args.affected_parties ?? [],
            rawData: args.raw_data ?? null,
            sandboxScript: args.sandbox_script ?? null,
            sandboxOutput: args.sandbox_output ?? null,
            resolution: args.resolution ?? null,
            status: args.status ?? 'open',
            createdAt: nowIso(),
          })
          .run();
      }
      const conflict = db
        .select()
        .from(schema.conflicts)
        .where(eq(schema.conflicts.id, conflictId))
        .get();
      if (!conflict) throw new Error('conflict upsert failed');
      hub.broadcast({ event: 'conflict', jobId: args.job_id, conflict });
      return { conflict_id: conflictId, status: conflict.status };
    },

    /**
     * THE GATED TOOL. TrueForge pauses the turn for human approval before
     * this executes; by the time this body runs, the human has said yes.
     * It records the binding decision in the job log.
     */
    commit_decision(args: {
      job_id: string;
      action_type: string;
      description: string;
      payload?: Record<string, unknown>;
    }) {
      requireJob(args.job_id);
      const row = appendLog({
        jobId: args.job_id,
        direction: 'system',
        message: `COMMITTED [${args.action_type}]: ${args.description}`,
        messageType: 'decision',
        metadata: args.payload ?? null,
      });
      return { committed: true, log_id: row.id, action_type: args.action_type };
    },

    /** Cross-job availability lookup against the party registry. */
    check_resource_availability(args: {
      party_name: string;
      proposed_start_date: string;
      proposed_end_date: string;
      requesting_job_id?: string;
    }) {
      const normalized = args.party_name.trim().toLowerCase();
      const rows = db
        .select()
        .from(schema.partyRegistry)
        .where(eq(schema.partyRegistry.partyNameNormalized, normalized))
        .all()
        .filter((r) => r.status === 'active' && r.jobId !== args.requesting_job_id);

      // ISO dates compare lexicographically: overlap = start <= otherEnd && end >= otherStart
      const overlaps = (start: string, end: string) =>
        rows.filter((r) => start <= r.endDate && end >= r.startDate);
      const addDays = (iso: string, days: number) => {
        const d = new Date(`${iso}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
      };
      const conflicts = overlaps(args.proposed_start_date, args.proposed_end_date);

      // Walk forward past EVERY commitment (not only those overlapping the
      // original proposal) until a window of the same duration is free.
      let nextAvailable: string | null = null;
      if (conflicts.length > 0) {
        const durationDays = Math.max(
          0,
          Math.round(
            (Date.parse(`${args.proposed_end_date}T00:00:00Z`) -
              Date.parse(`${args.proposed_start_date}T00:00:00Z`)) /
              86_400_000,
          ),
        );
        let candidate = args.proposed_start_date;
        for (let i = 0; i < 365; i++) {
          const clash = overlaps(candidate, addDays(candidate, durationDays));
          if (clash.length === 0) {
            nextAvailable = candidate;
            break;
          }
          const latestEnd = clash
            .map((c) => c.endDate)
            .sort()
            .at(-1)!;
          candidate = addDays(latestEnd, 1);
        }
      }
      return {
        available: conflicts.length === 0,
        party_found_in_registry: rows.length > 0,
        conflicts: conflicts.map((c) => ({
          job_id: c.jobId,
          job_title: c.jobTitle,
          start_date: c.startDate,
          end_date: c.endDate,
        })),
        next_available_date: nextAvailable,
      };
    },

    /** Persist the generated execution plan; job → awaiting_approval. */
    save_execution_plan(args: {
      job_id: string;
      plan: Array<{
        step_title: string;
        actions: string;
        parties: string[];
        decisions_needed: string[];
        depends_on?: string[];
      }>;
    }) {
      requireJob(args.job_id);
      if (args.plan.length === 0) throw new Error('plan must contain at least one item');
      const plan = args.plan.map((p) => ({
        stepTitle: p.step_title,
        actions: p.actions,
        parties: p.parties,
        decisionsNeeded: p.decisions_needed,
        dependsOn: p.depends_on ?? [],
      }));

      // The plan DEFINES the job's step DAG: replace steps with plan items.
      db.delete(schema.steps).where(eq(schema.steps.jobId, args.job_id)).run();
      plan.forEach((item, i) => {
        db.insert(schema.steps)
          .values({
            id: randomUUID(),
            jobId: args.job_id,
            sequenceNum: i + 1,
            title: item.stepTitle,
            description: item.actions,
            requiredParties: item.parties,
            dependsOn: item.dependsOn,
          })
          .run();
      });

      db.update(schema.jobs)
        .set({ executionPlan: plan, status: 'awaiting_approval' })
        .where(eq(schema.jobs.id, args.job_id))
        .run();
      hub.broadcast({ event: 'plan_ready', jobId: args.job_id, executionPlan: plan });
      hub.broadcast({ event: 'job_status', jobId: args.job_id, status: 'awaiting_approval' });
      return { saved: true, steps_defined: plan.length };
    },

    /**
     * Register a file the agent produced in the sandbox. The path is stored
     * with a pending: prefix; the TrueForge event router downloads the bytes
     * at turn end (it knows the session/turn ids) and finalizes the row.
     */
    store_artifact(args: {
      job_id: string;
      name: string;
      kind: 'ics' | 'pdf' | 'md' | 'csv';
      sandbox_path: string;
    }) {
      requireJob(args.job_id);
      const existing = db
        .select()
        .from(schema.artifacts)
        .where(and(eq(schema.artifacts.jobId, args.job_id), eq(schema.artifacts.name, args.name)))
        .all();
      const version = existing.reduce((m, a) => Math.max(m, a.version), 0) + 1;
      const id = randomUUID();
      db.insert(schema.artifacts)
        .values({
          id,
          jobId: args.job_id,
          name: args.name,
          kind: args.kind,
          path: `pending:${args.sandbox_path}`,
          version,
          createdAt: nowIso(),
        })
        .run();
      return { artifact_id: id, version, status: 'pending_download' };
    },
  };
}

export type TaroTools = ReturnType<typeof createTools>;
