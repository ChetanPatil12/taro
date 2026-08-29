import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { JobListItem } from '../lib/api.js';
import { api } from '../lib/api.js';
import { Button, Meta, SectionHeader } from '../components/ui.js';

export default function Home() {
  const [jobs, setJobs] = useState<JobListItem[] | null>(null);
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listJobs()
      .then((r) => setJobs(r.jobs))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function loadPreset() {
    setLoadingPreset(true);
    setError(null);
    try {
      const { job_id } = await api.loadPreset();
      navigate(`/jobs/${job_id}`);
    } catch (e) {
      setError((e as Error).message);
      setLoadingPreset(false);
    }
  }

  return (
    <main className="grid grid-cols-1 gap-8 pt-8 lg:grid-cols-12">
      <section className="lg:col-span-5">
        <div className="border-4 border-foreground bg-background p-8">
          <Meta>Front page — one-click demonstration</Meta>
          <h2 className="mt-2 font-serif text-4xl font-black leading-tight lg:text-5xl">
            Load the Roofing Demo
          </h2>
          <p className="mt-4 font-body text-sm leading-relaxed text-neutral-600">
            A residential roofing job, fully staffed: homeowner, project manager, subcontractor,
            supplier. The engine knows nothing about roofs — every rule below is runtime data.
          </p>
          <p className="mt-3 font-mono text-xs uppercase tracking-widest text-neutral-500">
            4 parties · 8 steps · 1 pre-seeded cross-job conflict
          </p>
          <Button
            kind="primary"
            className="mt-6 w-full"
            onClick={loadPreset}
            disabled={loadingPreset}
          >
            {loadingPreset ? 'Convening the desk…' : 'Load demo & generate plan'}
          </Button>
        </div>

        <div className="mt-8 border border-foreground p-6">
          <h3 className="font-serif text-2xl font-bold">Or define any job</h3>
          <p className="mt-2 font-body text-sm text-neutral-600">
            Parties, steps, dependencies, rules — all free-form. The agent plans and coordinates
            whatever you describe.
          </p>
          <Link to="/jobs/new" className="mt-4 inline-block">
            <Button>New job definition →</Button>
          </Link>
        </div>
      </section>

      <section className="lg:col-span-7">
        <SectionHeader label="The docket" title="Jobs" />
        {error && (
          <p className="mt-4 border border-accent p-3 font-mono text-xs text-accent">{error}</p>
        )}
        {jobs === null && !error && (
          <p className="mt-4 font-mono text-xs uppercase tracking-widest text-neutral-500">
            Loading…
          </p>
        )}
        {jobs?.length === 0 && (
          <p className="mt-6 bg-neutral-200 p-8 text-center font-body italic text-neutral-600">
            No jobs on the docket yet. Load the demo or define one.
          </p>
        )}
        <ul>
          {jobs?.map((job) => (
            <li key={job.id}>
              <Link
                to={`/jobs/${job.id}`}
                className="hard-shadow-hover mt-4 block border border-foreground bg-background p-5 hover:bg-neutral-100"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-serif text-xl font-bold lg:text-2xl">{job.title}</h3>
                  <Meta
                    className={
                      job.status === 'paused' || job.status === 'failed' ? 'text-accent' : ''
                    }
                  >
                    {job.status.replace('_', ' ')}
                  </Meta>
                </div>
                <Meta>{new Date(job.createdAt).toLocaleString()}</Meta>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
