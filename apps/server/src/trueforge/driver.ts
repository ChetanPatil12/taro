import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { and, eq, isNull, like } from 'drizzle-orm';
import type { TrueForge } from '@truefoundry/trueforge-sdk';
import type { TaroDb } from '../db/index.js';
import { schema } from '../db/index.js';
import type { WsHub } from '../ws/hub.js';
import { ORCHESTRATOR_AGENT_NAME } from './orchestrator.js';

/** One item of turn input, in TrueForge wire shape. */
type TurnInputItem = Record<string, unknown>;

interface JobRuntime {
  queue: TurnInputItem[][];
  running: boolean;
}

/**
 * The event router: translates world events (job created, plan approved,
 * party message, approval decision) into TrueForge turns, consumes each
 * turn's SSE stream, and mirrors harness activity into SQLite + WebSocket.
 *
 * TrueForge owns cognition; this class owns events and state. It never
 * decides anything.
 */
export class JobDriver {
  private readonly runtimes = new Map<string, JobRuntime>();

  constructor(
    private readonly db: TaroDb,
    private readonly hub: WsHub,
    private readonly client: TrueForge,
    private readonly trueforgeUrl: string,
    private readonly artifactsDir: string,
  ) {}

  /** Create the TrueForge session for a new job and request the plan. */
  async startJob(jobId: string): Promise<void> {
    const created = (await this.client.sessions.create({
      agent: { name: ORCHESTRATOR_AGENT_NAME },
    })) as unknown as { data?: { id: string }; id?: string };
    const session = created.data ?? { id: created.id! };
    this.db
      .update(schema.jobs)
      .set({ trueforgeSessionId: session.id })
      .where(eq(schema.jobs.id, jobId))
      .run();
    this.enqueue(jobId, [
      {
        type: 'user.message',
        content: `PLAN_REQUEST job_id=${jobId}\nGenerate the execution plan per your contract.`,
      },
    ]);
  }

  /** User approved the plan → kickoff burst. */
  approvePlan(jobId: string): void {
    this.db.update(schema.jobs).set({ status: 'active' }).where(eq(schema.jobs.id, jobId)).run();
    this.hub.broadcast({ event: 'job_status', jobId, status: 'active' });
    this.enqueue(jobId, [
      {
        type: 'user.message',
        content: `PLAN_APPROVED job_id=${jobId}\nThe user approved the execution plan. Begin coordination per your contract.`,
      },
    ]);
  }

  /** User declined the draft plan with feedback → agent redrafts. */
  requestPlanRevision(jobId: string, feedback: string): void {
    this.db.update(schema.jobs).set({ status: 'planning' }).where(eq(schema.jobs.id, jobId)).run();
    this.hub.broadcast({ event: 'job_status', jobId, status: 'planning' });
    this.enqueue(jobId, [
      {
        type: 'user.message',
        content:
          `PLAN_REVISION job_id=${jobId}\n` +
          `The user did NOT approve the draft plan and gave this feedback:\n"${feedback}"\n` +
          `Revise the execution plan accordingly and call save_execution_plan again. ` +
          `Do not contact any party.`,
      },
    ]);
  }

  /** User rejected the draft outright → job is cancelled, agent not resumed. */
  rejectPlan(jobId: string): void {
    this.db.update(schema.jobs).set({ status: 'cancelled' }).where(eq(schema.jobs.id, jobId)).run();
    this.hub.broadcast({ event: 'job_status', jobId, status: 'cancelled' });
  }

  /** A party (human in the UI) sent a message, optionally with a file. */
  notifyPartyMessage(
    jobId: string,
    partyId: string,
    partyName: string,
    message: string,
    file?: { name: string; mime: string; dataBase64: string },
  ): void {
    const content: unknown[] = [
      {
        type: 'text',
        text: `PARTY_MESSAGE job_id=${jobId} from party_id=${partyId} (${partyName}):\n${message}`,
      },
    ];
    if (file) {
      content.push({
        type: 'file',
        name: file.name,
        data: `data:${file.mime};base64,${file.dataBase64}`,
      });
    }
    this.enqueue(jobId, [{ type: 'user.message', content }]);
  }

  /** Human decided a pending approval → resume the paused run. */
  decideApproval(
    jobId: string,
    approvalId: string,
    decision: 'approved' | 'rejected',
    reason?: string,
  ): void {
    const approval = this.db
      .select()
      .from(schema.approvals)
      .where(and(eq(schema.approvals.id, approvalId), eq(schema.approvals.jobId, jobId)))
      .get();
    if (!approval) throw new Error(`Unknown approval ${approvalId} for job ${jobId}`);
    if (approval.decision) throw new Error(`Approval ${approvalId} already decided`);

    this.db
      .update(schema.approvals)
      .set({
        decision,
        rejectionReason: reason ?? null,
        decidedAt: new Date().toISOString(),
      })
      .where(eq(schema.approvals.id, approvalId))
      .run();
    this.hub.broadcast({
      event: 'approval_decided',
      jobId,
      approvalId,
      decision,
      rejectionReason: reason ?? null,
    });

    // A paused turn may hold SEVERAL gated tool calls; TrueForge requires
    // every pending approval in ONE resume turn. So: wait until nothing is
    // undecided, then send all not-yet-resumed decisions together.
    const stillPending = this.db
      .select()
      .from(schema.approvals)
      .where(and(eq(schema.approvals.jobId, jobId), isNull(schema.approvals.decision)))
      .all();
    if (stillPending.length > 0) return;

    this.db.update(schema.jobs).set({ status: 'active' }).where(eq(schema.jobs.id, jobId)).run();
    this.hub.broadcast({ event: 'job_status', jobId, status: 'active' });

    const unsent = this.db
      .select()
      .from(schema.approvals)
      .where(and(eq(schema.approvals.jobId, jobId), eq(schema.approvals.resumed, 0)))
      .all()
      .filter((a) => a.decision !== null);
    if (unsent.length === 0) return;
    for (const a of unsent) {
      this.db
        .update(schema.approvals)
        .set({ resumed: 1 })
        .where(eq(schema.approvals.id, a.id))
        .run();
    }
    this.enqueue(
      jobId,
      unsent.map((a) => ({
        type: 'user.tool_approval',
        threadId: a.threadId,
        toolCallId: a.toolCallId,
        approval:
          a.decision === 'approved'
            ? { status: 'allow' }
            : { status: 'deny', reason: a.rejectionReason ?? 'Rejected by the user.' },
      })),
    );
  }

  /**
   * One running turn per job; anything arriving meanwhile queues as its own
   * later turn (a turn's input cannot mix messages with approvals).
   */
  private enqueue(jobId: string, input: TurnInputItem[]): void {
    let rt = this.runtimes.get(jobId);
    if (!rt) {
      rt = { queue: [], running: false };
      this.runtimes.set(jobId, rt);
    }
    rt.queue.push(input);
    if (!rt.running) void this.drain(jobId, rt);
  }

  private async drain(jobId: string, rt: JobRuntime): Promise<void> {
    rt.running = true;
    try {
      while (rt.queue.length > 0) {
        const input = rt.queue.shift()!;
        try {
          await this.runTurn(jobId, input);
        } catch (err) {
          this.activity(jobId, 'status', `turn failed: ${(err as Error).message}`);
        }
      }
    } finally {
      rt.running = false;
    }
  }

  private sessionId(jobId: string): string {
    const job = this.db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).get();
    if (!job?.trueforgeSessionId) throw new Error(`Job ${jobId} has no TrueForge session`);
    return job.trueforgeSessionId;
  }

  private activity(
    jobId: string,
    kind: 'thread_started' | 'thread_done' | 'sandbox' | 'tool_call' | 'status',
    label: string,
    threadId?: string,
  ): void {
    this.hub.broadcast({ event: 'agent_activity', jobId, kind, label, threadId });
  }

  private async runTurn(jobId: string, input: TurnInputItem[]): Promise<void> {
    const sessionId = this.sessionId(jobId);
    const stream = await this.client.sessions.createTurnStream(sessionId, {
      input: input as never,
    });

    let turnId: string | null = null;
    // Accumulate streamed tool-call arguments so approval gates can show
    // what the agent wants to do: messageId:index -> {name, id, argsJson}
    const toolCalls = new Map<string, { name: string; id: string; args: string }>();

    for await (const ev of stream as AsyncIterable<Record<string, never>>) {
      const e = ev as {
        type?: string;
        id?: string;
        turnId?: string;
        threadId?: string | null;
        sandboxId?: string;
        toolCalls?: Array<{
          index?: number;
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
      switch (e.type) {
        case 'turn.created':
          turnId = e.turnId ?? null;
          break;
        case 'model.message.delta':
          for (const tc of e.toolCalls ?? []) {
            const key = `${e.id}:${tc.index ?? 0}`;
            const entry = toolCalls.get(key) ?? { name: '', id: '', args: '' };
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name = tc.function.name;
            if (tc.function?.arguments) entry.args += tc.function.arguments;
            toolCalls.set(key, entry);
          }
          break;
        case 'thread.created':
          this.activity(jobId, 'thread_started', 'subagent started', e.threadId ?? undefined);
          break;
        case 'thread.done':
          this.activity(jobId, 'thread_done', 'subagent finished', e.threadId ?? undefined);
          break;
        case 'sandbox.created':
          this.activity(jobId, 'sandbox', `sandbox provisioned (${e.sandboxId ?? 'unknown'})`);
          break;
        case 'tool.approval_required':
          this.recordApprovals(jobId, e, toolCalls);
          break;
        default:
          break;
      }
    }

    if (turnId) await this.finalizeArtifacts(jobId, sessionId, turnId);
    this.activity(jobId, 'status', 'turn finished');
  }

  /** Persist tool.approval_required as pending approvals + notify the UI. */
  private recordApprovals(
    jobId: string,
    event: {
      threadId?: string | null;
      toolCalls?: Array<{ id?: string; sourceEventId?: string }>;
    },
    toolCalls: Map<string, { name: string; id: string; args: string }>,
  ): void {
    for (const tc of event.toolCalls ?? []) {
      if (!tc.id) continue;
      const known = [...toolCalls.values()].find((c) => c.id === tc.id);
      let actionType = known?.name ?? 'unknown_action';
      let description = 'The agent requests approval for a binding action.';
      let payload: Record<string, unknown> | null = null;
      if (known?.args) {
        try {
          let parsed = JSON.parse(known.args) as Record<string, unknown>;
          // TrueForge wraps MCP calls in a meta tool:
          // {mcp_server, tool_name, input: <actual args>} — unwrap it.
          if (typeof parsed.tool_name === 'string' && parsed.input) {
            actionType = parsed.tool_name;
            parsed = parsed.input as Record<string, unknown>;
          }
          actionType = (parsed.action_type as string) ?? actionType;
          description = (parsed.description as string) ?? description;
          payload = (parsed.payload as Record<string, unknown>) ?? parsed;
        } catch {
          payload = { raw_arguments: known.args };
        }
      }
      const approval = {
        id: randomUUID(),
        jobId,
        toolCallId: tc.id,
        threadId: event.threadId ?? null,
        actionType,
        description,
        payload,
        decision: null,
        rejectionReason: null,
        decidedAt: null,
        createdAt: new Date().toISOString(),
      };
      this.db.insert(schema.approvals).values(approval).run();
      this.db.update(schema.jobs).set({ status: 'paused' }).where(eq(schema.jobs.id, jobId)).run();
      this.hub.broadcast({ event: 'approval_required', jobId, approval });
      this.hub.broadcast({ event: 'job_status', jobId, status: 'paused' });
    }
  }

  /** Download files registered via store_artifact during this turn. */
  private async finalizeArtifacts(jobId: string, sessionId: string, turnId: string): Promise<void> {
    const pending = this.db
      .select()
      .from(schema.artifacts)
      .where(and(eq(schema.artifacts.jobId, jobId), like(schema.artifacts.path, 'pending:%')))
      .all();
    for (const artifact of pending) {
      const sandboxPath = artifact.path.slice('pending:'.length);
      try {
        const url =
          `${this.trueforgeUrl}/api/v1/sessions/${sessionId}/turns/${turnId}` +
          `/download-sandbox-file?path=${encodeURIComponent(sandboxPath)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
        const bytes = Buffer.from(await res.arrayBuffer());
        mkdirSync(this.artifactsDir, { recursive: true });
        const safeName = basename(artifact.name).replace(/[^\w.\- ]/g, '_') || 'artifact';
        const localPath = join(this.artifactsDir, `${artifact.id}-${safeName}`);
        writeFileSync(localPath, bytes);
        this.db
          .update(schema.artifacts)
          .set({ path: localPath })
          .where(eq(schema.artifacts.id, artifact.id))
          .run();
        this.hub.broadcast({
          event: 'artifact_added',
          jobId,
          artifact: {
            id: artifact.id,
            jobId,
            name: artifact.name,
            kind: artifact.kind,
            version: artifact.version,
            createdAt: artifact.createdAt,
          },
        });
      } catch (err) {
        // Mark failed instead of leaving it pending: a later turn's sandbox
        // would not contain this file, so retrying with a new turn id can
        // never succeed and would mask the real failure.
        this.db
          .update(schema.artifacts)
          .set({ path: `failed:${sandboxPath}` })
          .where(eq(schema.artifacts.id, artifact.id))
          .run();
        this.activity(
          jobId,
          'status',
          `artifact ${artifact.name} download failed: ${(err as Error).message}`,
        );
      }
    }
  }
}
