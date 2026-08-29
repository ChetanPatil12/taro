import type { Conflict } from '@taro/shared';
import { Meta } from './ui.js';

export function ConflictAlert({ conflict }: { conflict: Conflict }) {
  return (
    <aside className="border-4 border-foreground bg-background">
      <p className="bg-foreground px-3 py-1 font-mono text-xs uppercase tracking-widest text-background">
        Conflict detected — {conflict.conflictType.replace(/_/g, ' ')}
      </p>
      <div className="p-5">
        <p className="font-body text-sm leading-relaxed">{conflict.description}</p>
        <p className="mt-2">
          <Meta>
            status: {conflict.status}
            {conflict.status === 'resolving' ? ' — running in sandbox…' : ''}
          </Meta>
        </p>
        {(conflict.sandboxScript || conflict.sandboxOutput) && (
          <details className="mt-3 border border-foreground">
            <summary className="cursor-pointer px-3 py-2 font-mono text-xs uppercase tracking-widest hover:bg-neutral-100">
              Generated resolution code + output
            </summary>
            {conflict.sandboxScript && (
              <pre className="max-h-48 overflow-auto border-t border-muted bg-neutral-100 p-3 font-mono text-xs">
                {conflict.sandboxScript}
              </pre>
            )}
            {conflict.sandboxOutput && (
              <pre className="max-h-32 overflow-auto border-t border-foreground p-3 font-mono text-xs">
                {conflict.sandboxOutput}
              </pre>
            )}
          </details>
        )}
        {conflict.resolution && (
          <p className="mt-3 border-t-2 border-foreground pt-3 font-body text-sm">
            <strong className="font-sans text-xs uppercase tracking-widest">Resolved — </strong>
            {conflict.resolution}
          </p>
        )}
      </div>
    </aside>
  );
}
