import { useEffect, useRef } from 'react';
import { useJob } from '../lib/jobStore.js';

const KIND_STYLE: Record<string, { glyph: string; cls: string }> = {
  thread_started: { glyph: '▸', cls: 'text-[#60a5fa]' },
  thread_done: { glyph: '✓', cls: 'text-[#4ade80]' },
  sandbox: { glyph: '⌁', cls: 'text-[#c084fc]' },
  tool_call: { glyph: '·', cls: 'text-[#a1a1aa]' },
  status: { glyph: '»', cls: 'text-[#fbbf24]' },
};

/** The job's engine room: harness activity, always visible while the job is open. */
export function TerminalWindow({ jobId }: { jobId: string }) {
  const state = useJob(jobId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const count = state?.activity.length ?? 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [count]);

  return (
    <div className="mono h-full overflow-y-auto bg-[#18181bF2] px-3.5 py-2.5 text-[11.5px] leading-[1.75] text-[#e4e4e7]">
      <p className="text-[#71717a]">
        taro harness — session {state?.job.id.slice(0, 8) ?? '········'} · status:{' '}
        {state?.job.status ?? '…'} · {state?.connected ? 'live' : 'reconnecting'}
      </p>
      {(state?.activity ?? []).map((e, i) => {
        const s = KIND_STYLE[e.kind] ?? KIND_STYLE.status!;
        return (
          <p key={i}>
            <span className="text-[#71717a]">
              {new Date(e.at).toLocaleTimeString([], {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>{' '}
            <span className={s.cls}>
              {s.glyph} {e.label}
            </span>
          </p>
        );
      })}
      <p>
        <span className="caret inline-block h-[12px] w-[7px] translate-y-[2px] bg-[#e4e4e7]" />
      </p>
      <div ref={bottomRef} />
    </div>
  );
}
