import { useEffect, useSyncExternalStore } from 'react';
import type { Conflict, LogEntry, TaroWsEvent } from '@taro/shared';
import type { ArtifactItem, JobState } from './api.js';
import { api } from './api.js';

export interface ActivityEntry {
  kind: string;
  label: string;
  at: string;
}

export interface LiveJobState extends JobState {
  log: Array<LogEntry & { partyName?: string | null }>;
  artifacts: ArtifactItem[];
  activity: ActivityEntry[];
  connected: boolean;
}

function upsertConflict(list: Conflict[], conflict: Conflict): Conflict[] {
  const i = list.findIndex((c) => c.id === conflict.id);
  if (i === -1) return [...list, conflict];
  const next = [...list];
  next[i] = conflict;
  return next;
}

function applyEvent(state: LiveJobState, ev: TaroWsEvent): LiveJobState {
  switch (ev.event) {
    case 'new_message':
      return { ...state, log: [...state.log, { ...ev.entry, partyName: ev.partyName }] };
    case 'dag_update':
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.id === ev.stepId ? { ...s, status: ev.status, notes: ev.notes ?? s.notes } : s,
        ),
      };
    case 'job_status':
      return { ...state, job: { ...state.job, status: ev.status } };
    case 'plan_ready':
      return {
        ...state,
        job: { ...state.job, status: 'awaiting_approval', execution_plan: ev.executionPlan },
      };
    case 'conflict':
      return { ...state, open_conflicts: upsertConflict(state.open_conflicts, ev.conflict) };
    case 'approval_required':
      return { ...state, pending_approvals: [...state.pending_approvals, ev.approval] };
    case 'approval_decided':
      return {
        ...state,
        pending_approvals: state.pending_approvals.filter((a) => a.id !== ev.approvalId),
      };
    case 'artifact_added':
      return {
        ...state,
        artifacts: [
          { ...ev.artifact, kind: ev.artifact.kind as string, ready: true },
          ...state.artifacts.filter((a) => a.id !== ev.artifact.id),
        ],
      };
    case 'agent_activity':
      return {
        ...state,
        activity: [
          ...state.activity.slice(-120),
          { kind: ev.kind, label: ev.label, at: new Date().toISOString() },
        ],
      };
    default:
      return state;
  }
}

interface Entry {
  state: LiveJobState | null;
  listeners: Set<() => void>;
  socket: WebSocket | null;
  refs: number;
  retry: ReturnType<typeof setTimeout> | null;
  closed: boolean;
}

/**
 * One live subscription per job, shared by every window that shows the job
 * (job window, its terminal, approval alerts). REST snapshot on (re)connect
 * heals any missed events.
 */
const entries = new Map<string, Entry>();

function notify(entry: Entry) {
  for (const l of entry.listeners) l();
}

async function snapshot(jobId: string, entry: Entry) {
  try {
    const [snap, log, artifacts] = await Promise.all([
      api.getJob(jobId),
      api.getLog(jobId),
      api.listArtifacts(jobId),
    ]);
    entry.state = {
      ...snap,
      log: log.log,
      artifacts: artifacts.artifacts,
      activity: entry.state?.activity ?? [],
      connected: entry.socket?.readyState === WebSocket.OPEN,
    };
    notify(entry);
  } catch {
    // job may not exist yet; a later reconnect will retry
  }
}

function connect(jobId: string, entry: Entry) {
  if (entry.closed) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${proto}://${location.host}/ws/${jobId}`);
  entry.socket = socket;
  socket.onopen = () => {
    if (entry.state) {
      entry.state = { ...entry.state, connected: true };
      notify(entry);
    }
    void snapshot(jobId, entry);
  };
  socket.onmessage = (msg) => {
    if (!entry.state) return;
    try {
      entry.state = applyEvent(entry.state, JSON.parse(msg.data as string) as TaroWsEvent);
      notify(entry);
    } catch {
      /* ignore malformed frames */
    }
  };
  socket.onclose = () => {
    if (entry.state) {
      entry.state = { ...entry.state, connected: false };
      notify(entry);
    }
    if (!entry.closed) entry.retry = setTimeout(() => connect(jobId, entry), 1500);
  };
}

function ensure(jobId: string): Entry {
  let entry = entries.get(jobId);
  if (!entry) {
    entry = {
      state: null,
      listeners: new Set(),
      socket: null,
      refs: 0,
      retry: null,
      closed: false,
    };
    entries.set(jobId, entry);
    void snapshot(jobId, entry);
    connect(jobId, entry);
  }
  return entry;
}

function acquire(jobId: string): Entry {
  const entry = ensure(jobId);
  entry.refs += 1;
  return entry;
}

function release(jobId: string) {
  const entry = entries.get(jobId);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    entry.closed = true;
    if (entry.retry) clearTimeout(entry.retry);
    entry.socket?.close();
    entries.delete(jobId);
  }
}

/** Live state for one job; windows sharing a job share the subscription. */
export function useJob(jobId: string): LiveJobState | null {
  useEffect(() => {
    acquire(jobId);
    return () => release(jobId);
  }, [jobId]);

  return useSyncExternalStore(
    (onChange) => {
      const entry = ensure(jobId);
      entry.listeners.add(onChange);
      return () => entry.listeners.delete(onChange);
    },
    () => entries.get(jobId)?.state ?? null,
  );
}
