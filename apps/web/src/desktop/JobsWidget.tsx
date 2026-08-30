import { useEffect, useState } from 'react';
import type { JobListItem } from '../lib/api.js';
import { api } from '../lib/api.js';
import { useWindowManager } from './windowing.js';

const BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: 'LIVE', cls: 'bg-[#2e7d32] text-white' },
  paused: { label: 'GATE', cls: 'bg-[#e65100] text-white' },
  awaiting_approval: { label: 'PLAN', cls: 'bg-[#0058d0] text-white' },
  planning: { label: 'DRAFT', cls: 'bg-[#616161] text-white' },
  completed: { label: 'DONE', cls: 'bg-[#9e9e9e] text-white' },
  failed: { label: 'FAIL', cls: 'bg-[#b3261e] text-white' },
  cancelled: { label: 'CANC', cls: 'bg-[#8e8e93] text-white' },
};

/**
 * Desktop widget, styled like a classic dashboard panel: the docket of jobs.
 * Clicking a job opens its window + terminal.
 */
export function JobsWidget({ refreshKey }: { refreshKey: number }) {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [error, setError] = useState(false);
  const wm = useWindowManager();

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .listJobs()
        .then((r) => alive && (setJobs(r.jobs), setError(false)))
        .catch(() => alive && setError(true));
    void load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [refreshKey]);

  return (
    <div className="absolute left-5 top-11 z-[5] w-[380px] overflow-hidden rounded-lg bg-[#f2f2f2]/95 shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-md">
      <div className="aqua-titlebar flex items-baseline justify-between border-b border-[#c6c6c6] px-3 py-1.5">
        <h2 className="text-[12.5px] font-bold text-[#333] [text-shadow:0_1px_0_rgba(255,255,255,0.7)]">
          Active Jobs
        </h2>
        <span className="rounded bg-[#0058d0] px-1.5 text-[10px] font-bold text-white">
          {jobs.length}
        </span>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {error && <p className="px-3 py-3 text-[12px] text-[#b3261e]">Server unreachable.</p>}
        {!error && jobs.length === 0 && (
          <p className="px-3 py-3 text-[12px] leading-relaxed text-[#6e6e73]">
            Nothing on the docket. Open <b>Roofing Demo</b> or <b>New Job</b> from the desktop.
          </p>
        )}
        <ul className="divide-y divide-black/5">
          {jobs.slice(0, 10).map((job) => (
            <li key={job.id}>
              <button
                onClick={() => wm.openJob(job.id, job.title)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[#0058d0]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0058d0]"
              >
                <span
                  className={`flex-none rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${
                    (BADGE[job.status] ?? BADGE.planning)!.cls
                  }`}
                >
                  {(BADGE[job.status] ?? BADGE.planning)!.label}
                </span>
                <span className="min-w-0 flex-1 whitespace-normal text-[12.5px] font-medium leading-snug text-[#1d1d1f]">
                  {job.title}
                </span>
                <span className="flex-none text-[10px] text-[#98989d]">
                  {new Date(job.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
