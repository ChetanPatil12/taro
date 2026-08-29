import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Conflict, LogEntry, TaroWsEvent } from '@taro/shared';
import type { ArtifactItem, JobState } from './api.js';
import { api } from './api.js';

export interface ActivityEntry {
  kind: string;
  label: string;
  at: string;
}

export interface LiveJobState extends JobState {
  /** Full message log (not just the last 20). */
  log: Array<LogEntry & { partyName?: string | null }>;
  artifacts: ArtifactItem[];
  activity: ActivityEntry[];
  connected: boolean;
}

type Action =
  | { type: 'snapshot'; state: JobState; log: LogEntry[]; artifacts: ArtifactItem[] }
  | { type: 'ws'; event: TaroWsEvent }
  | { type: 'connected'; connected: boolean };

function upsertConflict(list: Conflict[], conflict: Conflict): Conflict[] {
  const i = list.findIndex((c) => c.id === conflict.id);
  if (i === -1) return [...list, conflict];
  const next = [...list];
  next[i] = conflict;
  return next;
}

function reduce(state: LiveJobState | null, action: Action): LiveJobState | null {
  if (action.type === 'snapshot') {
    return {
      ...action.state,
      log: action.log,
      artifacts: action.artifacts,
      activity: state?.activity ?? [],
      connected: state?.connected ?? false,
    };
  }
  if (!state) return state;
  if (action.type === 'connected') return { ...state, connected: action.connected };

  const ev = action.event;
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
          ...state.activity.slice(-30),
          { kind: ev.kind, label: ev.label, at: new Date().toISOString() },
        ],
      };
    default:
      return state;
  }
}

/**
 * Live job state: one REST snapshot + a WebSocket stream applied on top.
 * Reconnects (and re-snapshots, to heal any gap) if the socket drops.
 */
export function useJobState(jobId: string) {
  const [state, dispatch] = useReducer(reduce, null);
  const socketRef = useRef<WebSocket | null>(null);

  const refresh = useCallback(async () => {
    const [snapshot, log, artifacts] = await Promise.all([
      api.getJob(jobId),
      api.getLog(jobId),
      api.listArtifacts(jobId),
    ]);
    dispatch({ type: 'snapshot', state: snapshot, log: log.log, artifacts: artifacts.artifacts });
  }, [jobId]);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const socket = new WebSocket(`${proto}://${location.host}/ws/${jobId}`);
      socketRef.current = socket;
      socket.onopen = () => {
        dispatch({ type: 'connected', connected: true });
        void refresh();
      };
      socket.onmessage = (msg) => {
        try {
          dispatch({ type: 'ws', event: JSON.parse(msg.data as string) as TaroWsEvent });
        } catch {
          // ignore malformed frames
        }
      };
      socket.onclose = () => {
        dispatch({ type: 'connected', connected: false });
        if (!closed) retry = setTimeout(connect, 1500);
      };
    }

    void refresh();
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socketRef.current?.close();
    };
  }, [jobId, refresh]);

  return { state, refresh };
}
