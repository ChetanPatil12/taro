import { useState } from 'react';
import type { JobDefinition } from '@taro/shared';
import { api } from '../lib/api.js';
import { useWindowManager } from '../desktop/windowing.js';

interface PartyRow {
  name: string;
  role: string;
  instructions: string;
}

const input =
  'w-full rounded-md border border-[#d2d2d7] bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[#0071e3]';
const label = 'text-[11px] font-bold uppercase tracking-wide text-[#6e6e73]';

/**
 * Job intake: a coordinator (mandatory approval authority), the other
 * parties, and one freeform brief. No step editor — the agent derives the
 * step DAG from the brief, and the user iterates on the drafted plan.
 */
export function NewJobWindow({ onCreated }: { onCreated: () => void }) {
  const wm = useWindowManager();
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [coordinator, setCoordinator] = useState<PartyRow>({
    name: '',
    role: '',
    instructions: '',
  });
  const [parties, setParties] = useState<PartyRow[]>([{ name: '', role: '', instructions: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patchParty = (i: number, p: Partial<PartyRow>) =>
    setParties((rows) => rows.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const ready = title.trim() && brief.trim() && coordinator.name.trim();

  async function submit() {
    setBusy(true);
    setError(null);
    const def: JobDefinition = {
      title,
      description: brief,
      parties: [
        {
          name: coordinator.name,
          role: coordinator.role || 'coordinator',
          channel: 'chat',
          instructions: coordinator.instructions,
          isCoordinator: true,
        },
        ...parties
          .filter((p) => p.name.trim())
          .map((p) => ({
            ...p,
            channel: 'chat',
            role: p.role || 'participant',
            isCoordinator: false,
          })),
      ],
    };
    try {
      const { job_id } = await api.createJob(def);
      onCreated();
      wm.close('new-job');
      wm.openJob(job_id, title);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        <div className="space-y-2">
          <p className={label}>Job</p>
          <input
            className={input}
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <p className={label}>The brief — just dump your thoughts</p>
          <textarea
            className={`${input} min-h-32 resize-y`}
            placeholder={
              'Everything the agent should know, in your own words: what needs to happen, ' +
              'who does what, budgets, deadlines, constraints, quirks of the people involved… ' +
              'The agent turns this into a step-by-step plan you can revise before anything starts.'
            }
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#5e5ce6]">
            Coordinator — required
          </p>
          <div className="space-y-1.5 rounded-lg border-2 border-[#5e5ce6] bg-[#5e5ce6]/10 p-2.5">
            <p className="text-[11px] leading-snug text-[#3d3c8f]">
              The human authority for this job. Every binding action the agent wants to take is
              routed to them for approval — without a coordinator the job cannot be drafted.
            </p>
            <div className="flex gap-2">
              <input
                className={input}
                placeholder="Name"
                value={coordinator.name}
                onChange={(e) => setCoordinator((c) => ({ ...c, name: e.target.value }))}
              />
              <input
                className={input}
                placeholder="Role in this job (e.g. project manager)"
                value={coordinator.role}
                onChange={(e) => setCoordinator((c) => ({ ...c, role: e.target.value }))}
              />
            </div>
            <textarea
              className={`${input} min-h-12 resize-y`}
              placeholder="Their part in this job — what they own, when they must be consulted…"
              value={coordinator.instructions}
              onChange={(e) => setCoordinator((c) => ({ ...c, instructions: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className={label}>Other parties</p>
          {parties.map((p, i) => (
            <div
              key={i}
              className="space-y-1.5 rounded-lg border border-black/10 bg-white/70 p-2.5"
            >
              <div className="flex gap-2">
                <input
                  className={input}
                  placeholder="Name"
                  value={p.name}
                  onChange={(e) => patchParty(i, { name: e.target.value })}
                />
                <input
                  className={input}
                  placeholder="Role"
                  value={p.role}
                  onChange={(e) => patchParty(i, { role: e.target.value })}
                />
                <button
                  aria-label="Remove party"
                  className="flex-none rounded-md px-2 text-[13px] text-[#6e6e73] hover:bg-black/5"
                  onClick={() => setParties((rows) => rows.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
              <textarea
                className={`${input} min-h-12 resize-y`}
                placeholder="Availability, constraints, what they must approve…"
                value={p.instructions}
                onChange={(e) => patchParty(i, { instructions: e.target.value })}
              />
            </div>
          ))}
          <button
            className="text-[12px] font-semibold text-[#0071e3]"
            onClick={() => setParties((p) => [...p, { name: '', role: '', instructions: '' }])}
          >
            + Add party
          </button>
        </div>
        {error && <p className="text-[12px] text-[#ff3b30]">{error}</p>}
      </div>
      <div className="flex-none border-t border-black/10 p-3">
        <button
          disabled={busy || !ready}
          onClick={submit}
          className="h-9 w-full rounded-lg bg-[#0071e3] text-[13px] font-semibold text-white hover:bg-[#0077ed] disabled:opacity-40"
        >
          {busy ? 'Filing…' : 'Create Job & Draft the Plan'}
        </button>
        {!coordinator.name.trim() && (
          <p className="mt-1.5 text-center text-[10.5px] text-[#5e5ce6]">
            A coordinator is required before the plan can be drafted.
          </p>
        )}
      </div>
    </div>
  );
}
