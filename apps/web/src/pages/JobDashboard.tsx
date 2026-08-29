import { useParams } from 'react-router-dom';
import { useJobState } from '../lib/useJobState.js';
import { AgentActivity } from '../components/AgentActivity.js';
import { ApprovalGate } from '../components/ApprovalGate.js';
import { ArtifactsPanel } from '../components/ArtifactsPanel.js';
import { ConflictAlert } from '../components/ConflictAlert.js';
import { DAGVisualizer } from '../components/DAGVisualizer.js';
import { ExecutionPlan } from '../components/ExecutionPlan.js';
import { PartyChat } from '../components/PartyChat.js';
import { Meta, Ornament } from '../components/ui.js';

export default function JobDashboard() {
  const { jobId } = useParams<{ jobId: string }>();
  const { state } = useJobState(jobId!);

  if (!state) {
    return (
      <p className="pt-12 text-center font-mono text-xs uppercase tracking-widest text-neutral-500">
        Fetching the docket…
      </p>
    );
  }

  const { job, parties, steps, log, open_conflicts, pending_approvals, artifacts, activity } =
    state;

  return (
    <main>
      <section className="border-b-4 border-foreground py-6">
        <Meta>
          Job {job.id.slice(0, 8)} · status:{' '}
          <span className={job.status === 'paused' || job.status === 'failed' ? 'text-accent' : ''}>
            {job.status.replace('_', ' ')}
          </span>
          {state.connected ? ' · live' : ' · reconnecting…'}
        </Meta>
        <h1 className="mt-1 font-serif text-4xl font-black leading-[0.95] tracking-tighter sm:text-5xl lg:text-6xl">
          {job.title}
        </h1>
        <p className="mt-3 max-w-3xl font-body text-sm leading-relaxed text-neutral-600">
          {job.description}
        </p>
      </section>

      {job.status === 'planning' && (
        <p className="py-16 text-center font-body text-lg italic text-neutral-600">
          The agent is reading the job, validating the workflow in the sandbox, and drafting an
          execution plan…
        </p>
      )}

      {job.status === 'awaiting_approval' && job.execution_plan && (
        <ExecutionPlan jobId={job.id} plan={job.execution_plan} />
      )}

      {job.status !== 'planning' && job.status !== 'awaiting_approval' && (
        <>
          <div className="mt-6">
            <AgentActivity entries={activity} connected={state.connected} />
          </div>

          {(pending_approvals.length > 0 || open_conflicts.length > 0) && (
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {pending_approvals.map((a) => (
                <ApprovalGate key={a.id} jobId={job.id} approval={a} />
              ))}
              {open_conflicts.map((c) => (
                <ConflictAlert key={c.id} conflict={c} />
              ))}
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-4">
              <DAGVisualizer steps={steps} />
              <ArtifactsPanel artifacts={artifacts} />
            </div>
            <div className="lg:col-span-8">
              <PartyChat jobId={job.id} parties={parties} log={log} />
            </div>
          </div>

          <Ornament />
        </>
      )}
    </main>
  );
}
