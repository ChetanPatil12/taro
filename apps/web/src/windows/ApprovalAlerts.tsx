import { useState } from 'react';
import type { Approval } from '@taro/shared';
import { api } from '../lib/api.js';
import { useJob } from '../lib/jobStore.js';

function Alert({
  jobId,
  jobTitle,
  approval,
}: {
  jobId: string;
  jobTitle: string;
  approval: Approval;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'approved' | 'rejected') {
    setBusy(true);
    setError(null);
    try {
      await api.decideApproval(jobId, approval.id, decision, reason.trim() || undefined);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      role="alertdialog"
      aria-label="Approval required"
      className="window-in w-[380px] overflow-hidden rounded-xl bg-[#f6f6f8]/95 text-center backdrop-blur-2xl window-shadow-focused"
    >
      <div className="px-6 pb-4 pt-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#ffb02e] to-[#f2542d] text-[26px] text-white shadow-lg">
          ⏸
        </div>
        <h3 className="mt-3 text-[14px] font-bold">
          {approval.actionType.replace(/_/g, ' ')} — approval required
        </h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[#6e6e73]">{approval.description}</p>
        <p className="mt-1 text-[11px] text-[#98989d]">
          {jobTitle} · agent paused until you decide
        </p>
        {approval.payload && (
          <pre className="mono mt-3 max-h-28 overflow-auto rounded-lg border border-black/10 bg-white p-2 text-left text-[10.5px] text-[#3a3a3c]">
            {JSON.stringify(approval.payload, null, 2)}
          </pre>
        )}
        {rejecting && (
          <input
            autoFocus
            className="mt-3 w-full rounded-md border border-[#d2d2d7] bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[#0071e3]"
            placeholder="Reason — the agent reads this and adapts"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
        {error && <p className="mt-2 text-[11px] text-[#ff3b30]">{error}</p>}
      </div>
      <div className="flex gap-2.5 px-6 pb-5">
        {!rejecting ? (
          <>
            <button
              disabled={busy}
              onClick={() => setRejecting(true)}
              className="h-9 flex-1 rounded-lg border border-[#d2d2d7] bg-white text-[13px] font-semibold hover:bg-[#f0f0f2] disabled:opacity-40"
            >
              Reject…
            </button>
            <button
              disabled={busy}
              onClick={() => decide('approved')}
              className="h-9 flex-1 rounded-lg bg-[#0071e3] text-[13px] font-semibold text-white hover:bg-[#0077ed] disabled:opacity-40"
            >
              Approve
            </button>
          </>
        ) : (
          <>
            <button
              disabled={busy}
              onClick={() => setRejecting(false)}
              className="h-9 flex-1 rounded-lg border border-[#d2d2d7] bg-white text-[13px] font-semibold hover:bg-[#f0f0f2]"
            >
              Back
            </button>
            <button
              disabled={busy || !reason.trim()}
              onClick={() => decide('rejected')}
              className="h-9 flex-1 rounded-lg bg-[#ff3b30] text-[13px] font-semibold text-white hover:bg-[#ff4d42] disabled:opacity-40"
            >
              Confirm Rejection
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** All pending gates for one open job, stacked as system dialogs. */
export function JobApprovalAlerts({ jobId }: { jobId: string }) {
  const state = useJob(jobId);
  if (!state || state.pending_approvals.length === 0) return null;
  return (
    <>
      {state.pending_approvals.map((a, i) => (
        <div
          key={a.id}
          className="absolute left-1/2 z-[950]"
          style={{ top: 120 + i * 40, transform: `translateX(calc(-50% + ${i * 28}px))` }}
        >
          <Alert jobId={jobId} jobTitle={state.job.title} approval={a} />
        </div>
      ))}
    </>
  );
}
