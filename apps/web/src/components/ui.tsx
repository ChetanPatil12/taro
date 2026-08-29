import type { ButtonHTMLAttributes } from 'react';

type ButtonKind = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'link';

const KIND_CLASSES: Record<ButtonKind, string> = {
  primary:
    'bg-foreground text-background border border-transparent hover:bg-background hover:text-foreground hover:border-foreground',
  secondary: 'border border-foreground bg-transparent hover:bg-foreground hover:text-background',
  destructive:
    'border border-foreground bg-transparent hover:bg-accent hover:text-background hover:border-accent',
  ghost: 'border border-transparent hover:bg-muted',
  link: 'border-0 underline-offset-4 decoration-2 decoration-accent hover:underline min-h-0 min-w-0 px-0',
};

export function Button({
  kind = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonKind }) {
  return (
    <button
      {...props}
      className={`min-h-[44px] min-w-[44px] px-6 font-sans text-xs font-semibold uppercase tracking-widest transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${KIND_CLASSES[kind]} ${className}`}
    />
  );
}

/** Metadata label: timestamps, section tags, "Vol." style annotations. */
export function Meta({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-mono text-xs uppercase tracking-widest text-neutral-500 ${className}`}>
      {children}
    </span>
  );
}

export function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="border-b-4 border-foreground pb-2">
      <Meta>{label}</Meta>
      <h2 className="font-serif text-3xl font-black lg:text-4xl">{title}</h2>
    </div>
  );
}

export function Ornament() {
  return (
    <div
      aria-hidden
      className="py-6 text-center font-serif text-xl tracking-[1em] text-neutral-400"
    >
      &#x2727; &#x2727; &#x2727;
    </div>
  );
}

export const inputClass =
  'w-full border-b-2 border-foreground bg-transparent px-3 py-2 font-mono text-sm focus-visible:bg-[#F0F0F0] focus-visible:outline-none';

export function statusGlyph(status: string): { glyph: string; className: string } {
  switch (status) {
    case 'active':
      return { glyph: '●', className: 'text-foreground step-active-glyph' };
    case 'complete':
      return { glyph: '✓', className: 'text-foreground' };
    case 'blocked':
      return { glyph: '⚠', className: 'text-accent' };
    case 'failed':
      return { glyph: '✗', className: 'text-accent' };
    default:
      return { glyph: '○', className: 'text-neutral-400' };
  }
}
