import { useState } from 'react';
import type { ReactNode } from 'react';

export interface DesktopApp {
  id: string;
  label: string;
  /** Tries /icons/<icon>.png (user asset), then /icons/<icon>.svg, then glyph. */
  icon: string;
  glyph: ReactNode;
  gradient: string;
  onClick: () => void;
}

function Icon({ app }: { app: DesktopApp }) {
  const [source, setSource] = useState<'png' | 'svg' | 'glyph'>('png');
  return (
    <button
      onClick={app.onClick}
      title={app.label}
      className="group flex w-[104px] flex-col items-center gap-1.5 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <span className="flex h-14 w-14 items-center justify-center text-[24px] font-bold text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] transition-transform duration-150 group-hover:scale-105">
        {source === 'glyph' ? (
          <span
            className="flex h-full w-full items-center justify-center rounded-[13px]"
            style={{ background: app.gradient }}
          >
            {app.glyph}
          </span>
        ) : (
          <img
            src={`/icons/${app.icon}.${source}`}
            alt=""
            className={`h-full w-full object-contain ${source === 'png' ? 'rounded-[13px]' : ''}`}
            onError={() => setSource((s) => (s === 'png' ? 'svg' : 'glyph'))}
          />
        )}
      </span>
      <span className="w-full whitespace-normal break-words rounded px-1 py-0.5 text-center text-[12px] font-medium leading-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.8)] group-hover:bg-[#0058d0]/80">
        {app.label}
      </span>
    </button>
  );
}

/** Right-edge desktop icon grid, like a real desktop. */
export function DesktopIcons({ apps }: { apps: DesktopApp[] }) {
  return (
    <div className="absolute right-3 top-10 z-[5] grid grid-cols-2 gap-x-2 gap-y-4">
      {apps.map((app) => (
        <Icon key={app.id} app={app} />
      ))}
    </div>
  );
}
