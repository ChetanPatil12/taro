import { useState } from 'react';
import type { JobDefinition } from '@taro/shared';
import { api } from '../lib/api.js';
import { useWindowManager } from '../desktop/windowing.js';

interface PartyRow {
  name: string;
  role: string;
  instructions: string;
}
interface StepRow {
  title: string;
  description: string;
  requiredParties: string[];
  dependsOn: string[];
  conditions: string;
}

const input =
  'w-full rounded-md border border-[#d2d2d7] bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[#0071e3]';
const label = 'text-[11px] font-bold uppercase tracking-wide text-[#6e6e73]';

export function NewJobWindow({ onCreated }: { onCreated: () => void }) {
  const wm = useWindowManager();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [parties, setParties] = useState<PartyRow[]>([{ name: '', role: '', instructions: '' }]);
  const [steps, setSteps] = useState<StepRow[]>([
    { title: '', description: '', requiredParties: [], dependsOn: [], conditions: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patchParty = (i: number, p: Partial<PartyRow>) =>
    setParties((rows) => rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const patchStep = (i: number, p: Partial<StepRow>) =>
    setSteps((rows) => rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const partyNames = parties.map((p) => p.name).filter(Boolean);

  async function submit() {
    setBusy(true);
    setError(null);
    const def: JobDefinition = {
      title,
      description,
      parties: parties
        .filter((p) => p.name.trim())
        .map((p) => ({ ...p, channel: 'chat', role: p.role || 'participant' })),
      steps: steps
        .filter((s) => s.title.trim())
        .map((s) => ({ ...s, description: s.description || s.title })),
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
          <textarea
            className={`${input} min-h-16 resize-y`}
            placeholder="Description — context, constraints, budget, target dates. The agent reads this verbatim."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <p className={label}>Parties</p>
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
                placeholder="Instructions — availability, constraints, what they must approve…"
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

        <div className="space-y-2">
          <p className={label}>Steps</p>
          {steps.map((s, i) => (
            <div
              key={i}
              className="space-y-1.5 rounded-lg border border-black/10 bg-white/70 p-2.5"
            >
              <div className="flex gap-2">
                <input
                  className={input}
                  placeholder="Step title"
                  value={s.title}
                  onChange={(e) => patchStep(i, { title: e.target.value })}
                />
                <button
                  aria-label="Remove step"
                  className="flex-none rounded-md px-2 text-[13px] text-[#6e6e73] hover:bg-black/5"
                  onClick={() => setSteps((rows) => rows.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
              <textarea
                className={`${input} min-h-12 resize-y`}
                placeholder="What must happen; conditions"
                value={s.description}
                onChange={(e) => patchStep(i, { description: e.target.value })}
              />
              {partyNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {partyNames.map((name) => (
                    <button
                      key={name}
                      onClick={() =>
                        patchStep(i, { requiredParties: toggle(s.requiredParties, name) })
                      }
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                        s.requiredParties.includes(name)
                          ? 'border-[#0071e3] bg-[#0071e3] text-white'
                          : 'border-[#d2d2d7] text-[#3a3a3c] hover:border-[#0071e3]'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button
            className="text-[12px] font-semibold text-[#0071e3]"
            onClick={() =>
              setSteps((s) => [
                ...s,
                { title: '', description: '', requiredParties: [], dependsOn: [], conditions: '' },
              ])
            }
          >
            + Add step
          </button>
        </div>
        {error && <p className="text-[12px] text-[#ff3b30]">{error}</p>}
      </div>
      <div className="flex-none border-t border-black/10 p-3">
        <button
          disabled={
            busy || !title.trim() || partyNames.length === 0 || steps.every((s) => !s.title.trim())
          }
          onClick={submit}
          className="h-9 w-full rounded-lg bg-[#0071e3] text-[13px] font-semibold text-white hover:bg-[#0077ed] disabled:opacity-40"
        >
          {busy ? 'Filing…' : 'Create Job & Generate Plan'}
        </button>
      </div>
    </div>
  );
}
