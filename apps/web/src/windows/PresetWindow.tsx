import { useEffect, useState } from 'react';
import type { JobDefinition } from '@taro/shared';
import { api } from '../lib/api.js';
import { useWindowManager } from '../desktop/windowing.js';

interface Preview {
  definition: JobDefinition;
  seeded_conflict: { party: string; job_title: string; note: string };
}

/**
 * The Roofing Demo app: shows the pre-filled job definition first, so the
 * user sees exactly what runtime data the agent gets — nothing starts until
 * they click the button.
 */
export function PresetWindow({ onCreated }: { onCreated: () => void }) {
  const wm = useWindowManager();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getRoofingPreset()
      .then(setPreview)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { job_id } = await api.loadPreset();
      onCreated();
      wm.close('preset');
      wm.openJob(job_id, preview?.definition.title ?? 'Roofing Demo');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!preview) {
    return (
      <p className="p-6 text-center text-[13px] text-[#6e6e73]">{error ?? 'Loading preset…'}</p>
    );
  }
  const def = preview.definition;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <h3 className="text-[16px] font-bold">{def.title}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-[#3a3a3c]">{def.description}</p>
        </div>

        <div className="rounded-lg border border-[#ff9f0a]/60 bg-[#fff8ec] p-2.5 text-[11.5px] leading-snug">
          <b>Seeded twist:</b> {preview.seeded_conflict.party} is already booked on “
          {preview.seeded_conflict.job_title}”. {preview.seeded_conflict.note}
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6e6e73]">
            Parties ({def.parties.length})
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {def.parties.map((p) => (
              <li
                key={p.name}
                className={`rounded-lg border p-2 ${
                  p.isCoordinator
                    ? 'border-[#5e5ce6] bg-[#5e5ce6]/10'
                    : 'border-black/10 bg-white/70'
                }`}
              >
                <p className="text-[12.5px] font-semibold">
                  {p.name} <span className="font-normal text-[#6e6e73]">— {p.role}</span>
                  {p.isCoordinator && (
                    <span className="ml-1.5 rounded bg-[#5e5ce6] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      Coordinator
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-[#3a3a3c]">{p.instructions}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className={def.steps?.length ? '' : 'hidden'}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6e6e73]">
            Suggested steps ({def.steps?.length ?? 0}) — the agent derives the final plan
          </p>
          <ol className="mt-1.5 space-y-1">
            {(def.steps ?? []).map((s, i) => (
              <li key={s.title} className="flex gap-2 text-[12px] leading-snug">
                <span className="flex-none font-semibold text-[#6e6e73]">{i + 1}.</span>
                <span>
                  <b>{s.title}</b>
                  {s.dependsOn.length > 0 && (
                    <span className="text-[#98989d]"> · after: {s.dependsOn.join(', ')}</span>
                  )}
                  <span className="block text-[#3a3a3c]">{s.description}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        {!def.steps?.length && (
          <p className="rounded-lg border border-black/10 bg-white/70 p-2.5 text-[11.5px] leading-snug text-[#3a3a3c]">
            <b>No predefined steps.</b> The brief above is all the agent gets — it derives the
            step-by-step plan itself, and you review it before anything starts.
          </p>
        )}
        {error && <p className="text-[12px] text-[#ff3b30]">{error}</p>}
      </div>
      <div className="flex-none border-t border-black/10 p-3">
        <button
          disabled={busy}
          onClick={start}
          className="h-10 w-full rounded-lg bg-[#0071e3] text-[13px] font-semibold text-white hover:bg-[#0077ed] disabled:opacity-40"
        >
          {busy ? 'Creating job…' : 'Create Job & Draft the Plan'}
        </button>
        <p className="mt-1.5 text-center text-[10.5px] text-[#98989d]">
          Nothing is sent to any party until you approve the drafted plan.
        </p>
      </div>
    </div>
  );
}
