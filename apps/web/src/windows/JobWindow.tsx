import { useEffect, useRef, useState } from 'react';
import type { LogEntry, Party, Step } from '@taro/shared';
import { api } from '../lib/api.js';
import { useJob } from '../lib/jobStore.js';
import { useWindowManager } from '../desktop/windowing.js';

const DOT: Record<string, string> = {
  complete: 'bg-[#28c840]',
  active: 'bg-[#0071e3] pulse-dot',
  blocked: 'bg-[#ff9f0a]',
  pending: 'bg-[#d2d2d7]',
};

function StepList({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-0.5">
      {[...steps]
        .sort((a, b) => a.sequenceNum - b.sequenceNum)
        .map((s) => (
          <div
            key={s.id}
            className={`flex items-baseline gap-2 rounded-md px-2 py-1.5 ${
              s.status === 'active' ? 'bg-[#0071e3]/10' : ''
            }`}
          >
            <span
              className={`h-2 w-2 flex-none translate-y-[-1px] rounded-full ${DOT[s.status]}`}
            />
            <div className="min-w-0">
              <p
                className={`truncate text-[12px] font-semibold leading-tight ${
                  s.status === 'pending' ? 'text-[#98989d]' : 'text-[#1d1d1f]'
                }`}
              >
                {s.title}
              </p>
              <p className="text-[10px] text-[#98989d]">{s.status}</p>
            </div>
          </div>
        ))}
    </div>
  );
}

function Chat({
  jobId,
  party,
  log,
}: {
  jobId: string;
  party: Party;
  log: Array<LogEntry & { partyName?: string | null }>;
}) {
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const thread = log.filter((e) => e.partyId === party.id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [thread.length, party.id]);

  async function send() {
    if (!draft.trim() && !file) return;
    setSending(true);
    setError(null);
    try {
      let payload: { name: string; mime: string; data_base64: string } | undefined;
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        payload = {
          name: file.name,
          mime: file.type || 'application/octet-stream',
          data_base64: btoa(binary),
        };
      }
      await api.sendMessage(jobId, party.id, draft.trim() || `(sent ${file?.name})`, payload);
      setDraft('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {thread.length === 0 && (
          <p className="py-6 text-center text-[12px] text-[#98989d]">No messages yet.</p>
        )}
        {thread.map((e) =>
          e.direction === 'system' ? (
            <p key={e.id} className="py-1 text-center text-[11px] text-[#98989d]">
              — {e.message} —
            </p>
          ) : (
            <div
              key={e.id}
              className={`flex ${e.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] rounded-[16px] px-3 py-2 text-[13px] leading-snug ${
                  e.direction === 'outbound'
                    ? 'rounded-br-[5px] bg-[#0071e3] text-white'
                    : 'rounded-bl-[5px] bg-[#e9e9eb] text-[#111]'
                }`}
              >
                <span
                  className={`block text-[9px] font-bold uppercase tracking-wide ${
                    e.direction === 'outbound' ? 'text-white/70' : 'text-black/50'
                  }`}
                >
                  {e.direction === 'outbound' ? 'Taro · agent' : party.name}
                  {' · '}
                  {new Date(e.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <p className="mt-0.5 whitespace-pre-wrap">{e.message}</p>
                {e.messageType === 'file' && (
                  <p className="mt-1 rounded bg-black/10 px-1.5 py-0.5 text-[10px]">
                    📎 attachment
                  </p>
                )}
              </div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex-none border-t border-black/10 p-2">
        {file && (
          <p className="mb-1 px-1 text-[11px] text-[#6e6e73]">
            📎 {file.name}{' '}
            <button className="text-[#0071e3]" onClick={() => setFile(null)}>
              remove
            </button>
          </p>
        )}
        {error && <p className="mb-1 px-1 text-[11px] text-[#ff3b30]">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            aria-label="Attach file"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[15px] text-[#6e6e73] hover:bg-black/5"
            onClick={() => fileRef.current?.click()}
          >
            📎
          </button>
          <input
            className="h-8 min-w-0 flex-1 rounded-full border border-[#d2d2d7] bg-white px-3.5 text-[13px] outline-none focus:border-[#0071e3]"
            placeholder={`Reply as ${party.name}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            aria-label="Send"
            disabled={sending || (!draft.trim() && !file)}
            onClick={send}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#0071e3] text-[14px] text-white disabled:opacity-35"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

export function JobWindow({ jobId }: { jobId: string }) {
  const state = useJob(jobId);
  const wm = useWindowManager();
  const [activePartyId, setActivePartyId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  const title = state?.job.title;
  useEffect(() => {
    if (title) wm.retitleJob(jobId, title);
  }, [title, jobId, wm]);

  if (!state) {
    return <p className="p-6 text-center text-[13px] text-[#6e6e73]">Loading job…</p>;
  }
  const { job, parties, steps, log, open_conflicts, artifacts } = state;
  const party = parties.find((p) => p.id === activePartyId) ?? parties[0];

  if (job.status === 'planning') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-3xl">🗂️</span>
        <p className="text-[14px] font-semibold">Drafting the execution plan…</p>
        <p className="max-w-[40ch] text-[12px] text-[#6e6e73]">
          The agent is reading the job, validating the workflow in the sandbox, and checking
          cross-job availability. Watch the terminal below.
        </p>
      </div>
    );
  }

  if (job.status === 'awaiting_approval' && job.execution_plan) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <h3 className="text-[15px] font-bold">Execution plan — review before anything is sent</h3>
          <ol className="mt-3 space-y-3">
            {job.execution_plan.map((item, i) => (
              <li key={i} className="rounded-lg border border-black/10 bg-white/70 p-3">
                <p className="text-[13px] font-semibold">
                  {i + 1}. {item.stepTitle}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#3a3a3c]">{item.actions}</p>
                <p className="mt-1 text-[11px] text-[#6e6e73]">
                  Parties: {item.parties.join(', ') || '—'}
                  {item.decisionsNeeded.length > 0 && (
                    <span className="text-[#b3261e]">
                      {' '}
                      · gated: {item.decisionsNeeded.join('; ')}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex-none border-t border-black/10 p-3">
          <button
            disabled={approving}
            onClick={async () => {
              setApproving(true);
              try {
                await api.approvePlan(jobId);
              } finally {
                setApproving(false);
              }
            }}
            className="h-10 w-full rounded-lg bg-[#0071e3] text-[13px] font-semibold text-white hover:bg-[#0077ed] disabled:opacity-40"
          >
            {approving ? 'Starting agent…' : 'Approve Plan & Start Agent'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-[218px] flex-none space-y-4 overflow-y-auto border-r border-black/10 bg-white/40 p-3">
        <div>
          <h4 className="px-1 text-[11px] font-bold uppercase tracking-wide text-[#6e6e73]">
            Run of work
          </h4>
          <div className="mt-1.5">
            <StepList steps={steps} />
          </div>
        </div>
        {open_conflicts.length > 0 && (
          <div>
            <h4 className="px-1 text-[11px] font-bold uppercase tracking-wide text-[#b3261e]">
              Conflicts
            </h4>
            {open_conflicts.map((c) => (
              <div
                key={c.id}
                className="mt-1.5 rounded-lg border border-[#ff9f0a]/60 bg-[#fff8ec] p-2"
              >
                <p className="text-[11px] font-semibold">{c.conflictType.replace(/_/g, ' ')}</p>
                <p className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-[#3a3a3c]">
                  {c.description}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase text-[#6e6e73]">
                  {c.status}
                  {c.resolution ? ` — ${c.resolution.slice(0, 80)}…` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
        <div>
          <h4 className="px-1 text-[11px] font-bold uppercase tracking-wide text-[#6e6e73]">
            Artifacts
          </h4>
          {artifacts.length === 0 ? (
            <p className="mt-1.5 px-1 text-[11px] text-[#98989d]">None filed yet.</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {artifacts.map((a) => (
                <li key={a.id} className="flex items-center gap-1.5 px-1 text-[11px]">
                  <span className="text-[13px]">📄</span>
                  <span className={`min-w-0 flex-1 truncate ${a.ready ? '' : 'text-[#98989d]'}`}>
                    {a.name} <span className="text-[#98989d]">v{a.version}</span>
                  </span>
                  {a.ready && (
                    <a
                      className="font-semibold text-[#0071e3]"
                      href={`/api/artifacts/${a.id}/download`}
                    >
                      ↓
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-none gap-1 border-b border-black/10 bg-white/50 px-2 pt-1.5">
          {parties.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePartyId(p.id)}
              className={`rounded-t-lg px-3 py-1.5 text-[12px] font-semibold ${
                p.id === party?.id
                  ? 'bg-white text-[#1d1d1f] shadow-[0_-1px_0_rgba(0,0,0,0.08)_inset]'
                  : 'text-[#6e6e73] hover:bg-white/60'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        {party && <Chat jobId={jobId} party={party} log={log} />}
      </div>
    </div>
  );
}
