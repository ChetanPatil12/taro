import { useState } from 'react';
import type { Approval } from '@taro/shared';
import { api } from '../lib/api.js';
import { Button } from './ui.js';

export function ApprovalGate({ jobId, approval }: { jobId: string; approval: Approval }) {
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
    <aside
      role="alertdialog"
      aria-label="Approval required"
      className="border-4 border-accent bg-background"
    >
      <p className="bg-accent px-3 py-1 font-mono text-xs uppercase tracking-widest text-background">
        Approval required — agent paused
      </p>
      <div className="p-5">
        <h3 className="font-serif text-2xl font-bold">{approval.actionType.replace(/_/g, ' ')}</h3>
        <p className="mt-2 font-body text-sm leading-relaxed">{approval.description}</p>
        {approval.payload && (
          <pre className="mt-3 max-h-40 overflow-auto border border-foreground bg-neutral-100 p-3 font-mono text-xs">
            {JSON.stringify(approval.payload, null, 2)}
          </pre>
        )}
        {rejecting && (
          <input
            autoFocus
            className="mt-4 w-full border-b-2 border-foreground bg-transparent px-3 py-2 font-mono text-sm focus-visible:bg-[#F0F0F0] focus-visible:outline-none"
            placeholder="Reason — the agent reads this and adapts"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
        {error && <p className="mt-3 font-mono text-xs text-accent">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          {!rejecting ? (
            <>
              <Button kind="primary" disabled={busy} onClick={() => decide('approved')}>
                Approve
              </Button>
              <Button kind="destructive" disabled={busy} onClick={() => setRejecting(true)}>
                Reject…
              </Button>
            </>
          ) : (
            <>
              <Button
                kind="destructive"
                disabled={busy || !reason.trim()}
                onClick={() => decide('rejected')}
              >
                Confirm rejection
              </Button>
              <Button disabled={busy} onClick={() => setRejecting(false)}>
                Back
              </Button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
