import type { ActivityEntry } from '../lib/useJobState.js';

/**
 * The one inverted section: a black wire-service ticker streaming what the
 * harness is doing — subagent threads, sandbox runs, turn lifecycle.
 */
export function AgentActivity({
  entries,
  connected,
}: {
  entries: ActivityEntry[];
  connected: boolean;
}) {
  const items = entries.length
    ? entries.slice(-12)
    : [{ kind: 'status', label: connected ? 'standing by' : 'connecting…', at: '' }];
  const line = items.map((e) => label(e)).join('  ■  ');
  return (
    <div className="overflow-hidden border-y-4 border-foreground bg-foreground py-2 text-background">
      <div className="ticker-track" aria-live="polite">
        <span className="px-8 font-mono text-xs uppercase tracking-widest">{line}</span>
        <span aria-hidden className="px-8 font-mono text-xs uppercase tracking-widest">
          {line}
        </span>
      </div>
    </div>
  );
}

function label(e: ActivityEntry): string {
  switch (e.kind) {
    case 'thread_started':
      return '▸ subagent dispatched';
    case 'thread_done':
      return '✓ subagent returned';
    case 'sandbox':
      return `⌁ ${e.label}`;
    default:
      return e.label;
  }
}
