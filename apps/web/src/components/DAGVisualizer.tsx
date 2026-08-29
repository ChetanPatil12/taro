import type { Step } from '@taro/shared';
import { Meta, statusGlyph } from './ui.js';

export function DAGVisualizer({ steps }: { steps: Step[] }) {
  const sorted = [...steps].sort((a, b) => a.sequenceNum - b.sequenceNum);
  return (
    <section className="border border-foreground bg-background p-6">
      <div className="border-b-4 border-foreground pb-2">
        <Meta>Progress</Meta>
        <h2 className="font-serif text-2xl font-black">The run of work</h2>
      </div>
      <ol className="mt-4 border-l border-foreground">
        {sorted.map((step) => {
          const { glyph, className } = statusGlyph(step.status);
          return (
            <li key={step.id} className="flex gap-3 py-2 pl-4">
              <span aria-hidden className={`font-mono text-base leading-6 ${className}`}>
                {glyph}
              </span>
              <div>
                <p
                  className={`font-serif text-base font-bold leading-6 ${
                    step.status === 'pending' ? 'text-neutral-400' : ''
                  }`}
                >
                  {step.title}
                </p>
                <Meta className={step.status === 'blocked' ? 'text-accent' : ''}>
                  {step.status}
                  {step.dependsOn.length > 0 ? ` · after: ${step.dependsOn.join(', ')}` : ''}
                </Meta>
                {step.notes && (
                  <p className="font-body text-xs italic text-neutral-600">{step.notes}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
