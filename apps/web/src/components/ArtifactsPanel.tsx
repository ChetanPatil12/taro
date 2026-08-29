import type { ArtifactItem } from '../lib/api.js';
import { Meta } from './ui.js';

export function ArtifactsPanel({ artifacts }: { artifacts: ArtifactItem[] }) {
  return (
    <section className="border border-foreground bg-background p-6">
      <div className="border-b-4 border-foreground pb-2">
        <Meta>Filed documents</Meta>
        <h2 className="font-serif text-2xl font-black">Artifacts</h2>
      </div>
      {artifacts.length === 0 ? (
        <p className="mt-4 font-body text-sm italic text-neutral-500">
          Nothing filed yet. The agent compiles schedules, quotes, and ledgers here as the job
          progresses.
        </p>
      ) : (
        <ul className="mt-2">
          {artifacts.map((a) => (
            <li
              key={a.id}
              className="flex items-baseline justify-between gap-3 border-b border-muted py-3"
            >
              <span className="font-mono text-xs text-neutral-500">
                v{a.version} · {a.kind}
              </span>
              <span
                className={`flex-1 font-serif text-base font-bold ${a.ready ? '' : 'text-neutral-400'}`}
              >
                {a.name}
              </span>
              {a.ready ? (
                <a
                  className="font-sans text-xs font-semibold uppercase tracking-widest underline-offset-4 decoration-accent decoration-2 hover:underline"
                  href={`/api/artifacts/${a.id}/download`}
                >
                  Download
                </a>
              ) : (
                <Meta>pending</Meta>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
