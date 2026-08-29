import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import type { JobDefinition } from '@taro/shared';
import { api } from '../lib/api.js';
import { Button, inputClass, Meta } from '../components/ui.js';

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

const emptyParty = (): PartyRow => ({ name: '', role: '', instructions: '' });
const emptyStep = (): StepRow => ({
  title: '',
  description: '',
  requiredParties: [],
  dependsOn: [],
  conditions: '',
});

const nn = (i: number) => String(i + 1).padStart(2, '0');

export default function NewJob() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [parties, setParties] = useState<PartyRow[]>([emptyParty()]);
  const [steps, setSteps] = useState<StepRow[]>([emptyStep()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function patchParty(i: number, patch: Partial<PartyRow>) {
    setParties((p) => p.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }
  function patchStep(i: number, patch: Partial<StepRow>) {
    setSteps((s) => s.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }
  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function submit() {
    setSubmitting(true);
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
      navigate(`/jobs/${job_id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  const partyNames = parties.map((p) => p.name).filter(Boolean);
  const stepTitles = steps.map((s) => s.title).filter(Boolean);

  return (
    <main className="mx-auto max-w-3xl pt-8">
      <Meta>Intake sheet</Meta>
      <h2 className="font-serif text-4xl font-black lg:text-5xl">Define a job</h2>

      <div className="mt-8 border-b-4 border-foreground pb-1">
        <Meta>Job</Meta>
      </div>
      <div className="mt-4 space-y-4">
        <input
          className={inputClass}
          placeholder="Job title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className={`${inputClass} min-h-24 resize-y border`}
          placeholder="Description — context, constraints, budget, target dates. The agent reads this verbatim."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="mt-10 border-b-4 border-foreground pb-1">
        <Meta>Parties</Meta>
      </div>
      {parties.map((p, i) => (
        <div key={i} className="mt-4 border border-foreground p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-neutral-500">{nn(i)}</span>
            <button
              aria-label={`Remove party ${nn(i)}`}
              className="flex h-10 w-10 items-center justify-center border border-foreground transition-all hover:bg-foreground hover:text-background"
              onClick={() => setParties((rows) => rows.filter((_, j) => j !== i))}
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              className={inputClass}
              placeholder="Name (e.g. Sarah Chen)"
              value={p.name}
              onChange={(e) => patchParty(i, { name: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Role (e.g. homeowner)"
              value={p.role}
              onChange={(e) => patchParty(i, { role: e.target.value })}
            />
          </div>
          <textarea
            className={`${inputClass} mt-4 min-h-20 resize-y border`}
            placeholder="Instructions — availability, constraints, what they must approve…"
            value={p.instructions}
            onChange={(e) => patchParty(i, { instructions: e.target.value })}
          />
        </div>
      ))}
      <Button className="mt-4" onClick={() => setParties((p) => [...p, emptyParty()])}>
        + Add party
      </Button>

      <div className="mt-10 border-b-4 border-foreground pb-1">
        <Meta>Steps</Meta>
      </div>
      {steps.map((s, i) => (
        <div key={i} className="mt-4 border border-foreground p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-neutral-500">{nn(i)}</span>
            <button
              aria-label={`Remove step ${nn(i)}`}
              className="flex h-10 w-10 items-center justify-center border border-foreground transition-all hover:bg-foreground hover:text-background"
              onClick={() => setSteps((rows) => rows.filter((_, j) => j !== i))}
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>
          <input
            className={`${inputClass} mt-2`}
            placeholder="Step title"
            value={s.title}
            onChange={(e) => patchStep(i, { title: e.target.value })}
          />
          <textarea
            className={`${inputClass} mt-4 min-h-16 resize-y border`}
            placeholder="What must happen in this step"
            value={s.description}
            onChange={(e) => patchStep(i, { description: e.target.value })}
          />
          <input
            className={`${inputClass} mt-4`}
            placeholder="Conditions (e.g. 'after inspection completed')"
            value={s.conditions}
            onChange={(e) => patchStep(i, { conditions: e.target.value })}
          />
          {partyNames.length > 0 && (
            <fieldset className="mt-4">
              <legend className="font-mono text-xs uppercase tracking-widest text-neutral-500">
                Required parties
              </legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {partyNames.map((name) => (
                  <button
                    key={name}
                    className={`border border-foreground px-3 py-1 font-mono text-xs uppercase tracking-widest transition-all ${
                      s.requiredParties.includes(name)
                        ? 'bg-foreground text-background'
                        : 'hover:bg-neutral-100'
                    }`}
                    onClick={() =>
                      patchStep(i, { requiredParties: toggle(s.requiredParties, name) })
                    }
                  >
                    {name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {stepTitles.filter((t) => t !== s.title).length > 0 && (
            <fieldset className="mt-4">
              <legend className="font-mono text-xs uppercase tracking-widest text-neutral-500">
                Depends on
              </legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {stepTitles
                  .filter((t) => t !== s.title)
                  .map((t) => (
                    <button
                      key={t}
                      className={`border border-foreground px-3 py-1 font-mono text-xs uppercase tracking-widest transition-all ${
                        s.dependsOn.includes(t)
                          ? 'bg-foreground text-background'
                          : 'hover:bg-neutral-100'
                      }`}
                      onClick={() => patchStep(i, { dependsOn: toggle(s.dependsOn, t) })}
                    >
                      {t}
                    </button>
                  ))}
              </div>
            </fieldset>
          )}
        </div>
      ))}
      <Button className="mt-4" onClick={() => setSteps((s) => [...s, emptyStep()])}>
        + Add step
      </Button>

      {error && (
        <p className="mt-6 border border-accent p-3 font-mono text-xs text-accent">{error}</p>
      )}

      <Button
        kind="primary"
        className="mt-10 w-full"
        disabled={submitting || !title.trim() || partyNames.length === 0 || stepTitles.length === 0}
        onClick={submit}
      >
        {submitting ? 'Filing…' : 'Generate execution plan'}
      </Button>
    </main>
  );
}
