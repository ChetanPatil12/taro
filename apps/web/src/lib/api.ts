import type {
  Approval,
  Conflict,
  ExecutionPlanItem,
  JobDefinition,
  JobStatus,
  LogEntry,
  Party,
  Step,
} from '@taro/shared';

/** Shape returned by GET /api/jobs/:id (the get_job_state snapshot). */
export interface JobState {
  job: {
    id: string;
    title: string;
    description: string;
    status: JobStatus;
    execution_plan: ExecutionPlanItem[] | null;
  };
  parties: Party[];
  steps: Step[];
  recent_log: Array<LogEntry & { partyName: string | null }>;
  open_conflicts: Conflict[];
  pending_approvals: Approval[];
}

export interface JobListItem {
  id: string;
  title: string;
  status: JobStatus;
  createdAt: string;
}

export interface ArtifactItem {
  id: string;
  name: string;
  kind: string;
  version: number;
  ready: boolean;
  createdAt: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listJobs: () => request<{ jobs: JobListItem[] }>('/api/jobs'),
  createJob: (def: JobDefinition) =>
    request<{ job_id: string }>('/api/jobs', { method: 'POST', body: JSON.stringify(def) }),
  loadPreset: () => request<{ job_id: string }>('/api/jobs/preset', { method: 'POST' }),
  getJob: (jobId: string) => request<JobState>(`/api/jobs/${jobId}`),
  getLog: (jobId: string) => request<{ log: LogEntry[] }>(`/api/jobs/${jobId}/log`),
  approvePlan: (jobId: string) =>
    request<{ status: string }>(`/api/jobs/${jobId}/approve-plan`, { method: 'PATCH' }),
  sendMessage: (
    jobId: string,
    partyId: string,
    message: string,
    file?: { name: string; mime: string; data_base64: string },
  ) =>
    request<{ status: string }>(`/api/jobs/${jobId}/message`, {
      method: 'POST',
      body: JSON.stringify({ party_id: partyId, message, file }),
    }),
  decideApproval: (
    jobId: string,
    approvalId: string,
    decision: 'approved' | 'rejected',
    reason?: string,
  ) =>
    request<{ status: string }>(`/api/jobs/${jobId}/approvals/${approvalId}`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    }),
  listArtifacts: (jobId: string) =>
    request<{ artifacts: ArtifactItem[] }>(`/api/jobs/${jobId}/artifacts`),
};
