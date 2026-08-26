/**
 * Real-time events broadcast by the Taro server to the web client over
 * WebSocket. One connection per job; every event carries its jobId.
 */

import type {
  Approval,
  ApprovalDecision,
  Artifact,
  Conflict,
  ExecutionPlanItem,
  JobStatus,
  LogEntry,
  StepStatus,
} from './types.js';

export interface PlanReadyEvent {
  event: 'plan_ready';
  jobId: string;
  executionPlan: ExecutionPlanItem[];
}

export interface NewMessageEvent {
  event: 'new_message';
  jobId: string;
  entry: LogEntry;
  partyName: string | null;
}

export interface DagUpdateEvent {
  event: 'dag_update';
  jobId: string;
  stepId: string;
  stepTitle: string;
  status: StepStatus;
  notes: string | null;
}

export interface ConflictEvent {
  event: 'conflict';
  jobId: string;
  conflict: Conflict;
}

export interface ApprovalRequiredEvent {
  event: 'approval_required';
  jobId: string;
  approval: Approval;
}

export interface ApprovalDecidedEvent {
  event: 'approval_decided';
  jobId: string;
  approvalId: string;
  decision: ApprovalDecision;
  rejectionReason: string | null;
}

export interface ArtifactAddedEvent {
  event: 'artifact_added';
  jobId: string;
  artifact: Artifact;
}

/** Live view of harness work: subagent threads and sandbox activity. */
export interface AgentActivityEvent {
  event: 'agent_activity';
  jobId: string;
  kind: 'thread_started' | 'thread_done' | 'sandbox' | 'tool_call' | 'status';
  label: string;
  threadId?: string;
}

export interface JobStatusEvent {
  event: 'job_status';
  jobId: string;
  status: JobStatus;
}

export type TaroWsEvent =
  | PlanReadyEvent
  | NewMessageEvent
  | DagUpdateEvent
  | ConflictEvent
  | ApprovalRequiredEvent
  | ApprovalDecidedEvent
  | ArtifactAddedEvent
  | AgentActivityEvent
  | JobStatusEvent;
