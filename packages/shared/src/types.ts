/**
 * Core domain types shared between the Taro server and the web client.
 *
 * The database is the source of truth for all coordination state; these
 * types describe its rows as they appear over the REST and WebSocket APIs.
 */

export type JobStatus =
  'planning' | 'awaiting_approval' | 'active' | 'paused' | 'completed' | 'failed';

export type StepStatus = 'pending' | 'active' | 'complete' | 'blocked';

export type MessageDirection = 'inbound' | 'outbound' | 'system';

export type MessageType = 'chat' | 'decision' | 'system_event' | 'sandbox_output' | 'file';

export type ConflictType = 'schedule' | 'budget' | 'scope' | 'cross_job_resource';

export type ConflictStatus = 'open' | 'resolving' | 'resolved';

export type ApprovalDecision = 'approved' | 'rejected';

export type ArtifactKind = 'ics' | 'pdf' | 'md' | 'csv';

export interface Job {
  id: string;
  title: string;
  description: string;
  status: JobStatus;
  /** Agent-generated plan, present once status reaches awaiting_approval. */
  executionPlan: ExecutionPlanItem[] | null;
  trueforgeSessionId: string | null;
  createdAt: string;
}

export interface ExecutionPlanItem {
  stepTitle: string;
  actions: string;
  parties: string[];
  decisionsNeeded: string[];
}

export interface Party {
  id: string;
  jobId: string;
  name: string;
  role: string;
  channel: string;
  instructions: string;
  status: string;
}

export interface Step {
  id: string;
  jobId: string;
  sequenceNum: number;
  title: string;
  description: string;
  requiredParties: string[];
  dependsOn: string[];
  conditions: string;
  status: StepStatus;
  notes: string | null;
  completedAt: string | null;
}

export interface LogEntry {
  id: string;
  jobId: string;
  partyId: string | null;
  direction: MessageDirection;
  message: string;
  messageType: MessageType;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface Conflict {
  id: string;
  jobId: string;
  conflictType: ConflictType;
  description: string;
  affectedParties: string[];
  rawData: Record<string, unknown> | null;
  sandboxScript: string | null;
  sandboxOutput: string | null;
  resolution: string | null;
  status: ConflictStatus;
  createdAt: string;
}

export interface Approval {
  id: string;
  jobId: string;
  toolCallId: string;
  threadId: string | null;
  actionType: string;
  description: string;
  payload: Record<string, unknown> | null;
  decision: ApprovalDecision | null;
  rejectionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface Artifact {
  id: string;
  jobId: string;
  name: string;
  kind: ArtifactKind;
  version: number;
  createdAt: string;
}

export interface PartyFile {
  id: string;
  jobId: string;
  partyId: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
}

export interface RegistryCommitment {
  id: string;
  partyNameNormalized: string;
  partyType: string;
  jobId: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  status: string;
}

/** Input shape for creating a job from the form or a preset. */
export interface JobDefinition {
  title: string;
  description: string;
  parties: Array<Pick<Party, 'name' | 'role' | 'channel' | 'instructions'>>;
  steps: Array<
    Pick<Step, 'title' | 'description' | 'requiredParties' | 'dependsOn' | 'conditions'>
  >;
}
