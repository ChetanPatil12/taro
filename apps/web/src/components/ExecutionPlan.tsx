import { useState } from 'react';
import type { ExecutionPlanItem } from '@taro/shared';
import { api } from '../lib/api.js';
import { Button, Meta, SectionHeader } from './ui.js';

const nn = (i: number) => String(i + 1).padStart(2, '0');

export function ExecutionPlan({ jobId, plan }: { jobId: string; plan: ExecutionPlanItem[] }) {
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setApproving(true);
    setError(null);
    try {
      await api.approvePlan(jobId);
    } catch (e) {
      setError((e as Error).message);
      setApproving(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl pt-8">
      <SectionHeader label="For your review" title="The execution plan" />
      <p className="mt-4 font-body text-sm italic text-neutral-600">
        The agent proposes to run the job as follows. Nothing is sent to any party until you
        approve.
      </p>
      <ol className="mt-6">
        {plan.map((item, i) => (
          <li key={i} className="flex gap-4 border-b border-muted py-4">
            <span className="font-mono text-sm text-neutral-500">{nn(i)}</span>
            <div>
              <h3 className="font-serif text-xl font-bold">{item.stepTitle}</h3>
              <p className="mt-1 font-body text-sm leading-relaxed text-neutral-700">
                {item.actions}
              </p>
              <p className="mt-2">
                <Meta>Parties: {item.parties.join(', ') || '—'}</Meta>
              </p>
              {item.decisionsNeeded.length > 0 && (
                <p>
                  <Meta className="text-accent">
                    Decisions gated: {item.decisionsNeeded.join('; ')}
                  </Meta>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {error && (
        <p className="mt-4 border border-accent p-3 font-mono text-xs text-accent">{error}</p>
      )}
      <Button kind="primary" className="mt-8 w-full" onClick={approve} disabled={approving}>
        {approving ? 'Dispatching…' : 'Approve plan & start agent'}
      </Button>
    </section>
  );
}
