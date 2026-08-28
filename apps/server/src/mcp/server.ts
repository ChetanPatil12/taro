import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TaroTools } from './tools.js';

const MESSAGE_TYPES = ['chat', 'decision', 'system_event', 'sandbox_output', 'file'] as const;
const STEP_STATUSES = ['pending', 'active', 'complete', 'blocked'] as const;
const CONFLICT_TYPES = ['schedule', 'budget', 'scope', 'cross_job_resource'] as const;
const CONFLICT_STATUSES = ['open', 'resolving', 'resolved'] as const;
const ARTIFACT_KINDS = ['ics', 'pdf', 'md', 'csv'] as const;

/**
 * Wraps the plain tool functions into an MCP server. A fresh instance is
 * created per request (stateless streamable HTTP).
 */
export function buildMcpServer(tools: TaroTools): McpServer {
  const server = new McpServer({ name: 'taro', version: '0.1.0' });

  /** Register one tool: JSON result both as text and structured content. */
  function register<A>(
    name: keyof TaroTools,
    description: string,
    inputSchema: Record<string, z.ZodType>,
    handler: (args: A) => unknown,
  ) {
    server.registerTool(name, { description, inputSchema }, (args: unknown) => {
      const result = handler(args as A) as Record<string, unknown>;
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        structuredContent: result,
      };
    });
  }

  register(
    'get_job_state',
    'Full shared state of a job: definition, parties, steps, last 20 log entries, open conflicts, pending approvals. Call this before acting on any event.',
    { job_id: z.string() },
    tools.get_job_state,
  );

  register(
    'get_party_context',
    'Deep context for ONE party: their full conversation history, role instructions, currently active steps, and decisions other parties have made. Subagents call this before composing any message.',
    { job_id: z.string(), party_id: z.string() },
    tools.get_party_context,
  );

  register(
    'post_party_message',
    "Record and deliver a message on a party's channel. direction='outbound' for messages TO the party (this sends it to their chat), 'inbound' when relaying something they said.",
    {
      job_id: z.string(),
      party_id: z.string(),
      direction: z.enum(['inbound', 'outbound']),
      message: z.string(),
      message_type: z.enum(MESSAGE_TYPES).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    },
    tools.post_party_message,
  );

  register(
    'update_step_status',
    "Change a step's status (pending|active|complete|blocked) and push the live DAG update. Completing the final step completes the job.",
    {
      job_id: z.string(),
      step_id: z.string(),
      status: z.enum(STEP_STATUSES),
      notes: z.string().optional(),
    },
    tools.update_step_status,
  );

  register(
    'flag_conflict',
    'Create a conflict record (omit conflict_id; conflict_type + description required), or update one (pass conflict_id) with the sandbox script, its output, the resolution, and status. Use for schedule/budget/scope/cross-job-resource conflicts.',
    {
      job_id: z.string(),
      conflict_id: z.string().optional(),
      conflict_type: z.enum(CONFLICT_TYPES).optional(),
      description: z.string().optional(),
      affected_parties: z.array(z.string()).optional(),
      raw_data: z.record(z.string(), z.unknown()).optional(),
      sandbox_script: z.string().optional(),
      sandbox_output: z.string().optional(),
      resolution: z.string().optional(),
      status: z.enum(CONFLICT_STATUSES).optional(),
    },
    tools.flag_conflict,
  );

  register(
    'commit_decision',
    'IRREVERSIBLE. Commit a binding action on behalf of a party or the job: confirm a date, accept a quote, place an order, adopt extracted file data, revise a budget. Requires human approval — the run pauses until the human decides. Never announce an action as final before this tool has succeeded.',
    {
      job_id: z.string(),
      action_type: z.string(),
      description: z.string(),
      payload: z.record(z.string(), z.unknown()).optional(),
    },
    tools.commit_decision,
  );

  register(
    'check_resource_availability',
    'Check whether a named party has commitments in OTHER jobs overlapping a proposed date range (ISO dates). Returns overlapping commitments and the next free date.',
    {
      party_name: z.string(),
      proposed_start_date: z.string(),
      proposed_end_date: z.string(),
      requesting_job_id: z.string().optional(),
    },
    tools.check_resource_availability,
  );

  register(
    'save_execution_plan',
    'Persist the generated execution plan for user review. Sets the job to awaiting_approval. One entry per step: what you will do, with which parties, and what decisions you need.',
    {
      job_id: z.string(),
      plan: z.array(
        z.object({
          step_title: z.string(),
          actions: z.string(),
          parties: z.array(z.string()),
          decisions_needed: z.array(z.string()),
        }),
      ),
    },
    tools.save_execution_plan,
  );

  register(
    'store_artifact',
    'Register a file you produced in the sandbox (schedule.ics, quote.md, ledger.csv, …) so the platform downloads and serves it to the user. Pass the absolute path inside the sandbox.',
    {
      job_id: z.string(),
      name: z.string(),
      kind: z.enum(ARTIFACT_KINDS),
      sandbox_path: z.string(),
    },
    tools.store_artifact,
  );

  return server;
}
