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

const TOKEN_KEY = 'taro-unlock-token';

export function getUnlockToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setUnlockToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode — session-only unlock */
  }
}

/** Fired when a write is rejected because the demo is locked. */
export const LOCKED_EVENT = 'taro-locked';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  // Only claim a JSON body when there is one — Fastify 400s on an empty
  // body paired with a JSON content-type.
  const token = getUnlockToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { 'x-taro-token': token } : {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 401 && body.error === 'locked') {
      window.dispatchEvent(new CustomEvent(LOCKED_EVENT));
      throw new Error('Unlock with your OpenAI API key to interact with the demo.');
    }
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
  getRoofingPreset: () =>
    request<{
      definition: JobDefinition;
      seeded_conflict: { party: string; job_title: string; note: string };
    }>('/api/presets/roofing'),
  planFeedback: (jobId: string, feedback: string) =>
    request<{ status: string }>(`/api/jobs/${jobId}/plan-feedback`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),
  rejectPlan: (jobId: string) =>
    request<{ status: string }>(`/api/jobs/${jobId}/reject-plan`, { method: 'POST' }),
  unlockStatus: () => request<{ required: boolean; unlocked: boolean }>('/api/unlock/status'),
  unlock: (apiKey: string) =>
    request<{ token: string }>('/api/unlock', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey }),
    }),
  listArtifacts: (jobId: string) =>
    request<{ artifacts: ArtifactItem[] }>(`/api/jobs/${jobId}/artifacts`),
};
