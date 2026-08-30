import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useWindowManager } from './windowing.js';
import type { Win } from './windowing.js';

interface Props {
  win: Win;
  focused: boolean;
  /** Terminals are inseparable from their job window (user rule). */
  closable?: boolean;
  dark?: boolean;
  children: ReactNode;
}

export function Window({ win, focused, closable = true, dark, children }: Props) {
  const wm = useWindowManager();
  const ref = useRef<HTMLDivElement>(null);

  function onDrag(e: React.PointerEvent) {
    e.preventDefault();
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const start = { x: e.clientX, y: e.clientY, wx: win.x, wy: win.y };
    const bounds = parent.getBoundingClientRect();

    function move(ev: PointerEvent) {
      const x = Math.max(-win.w + 90, Math.min(start.wx + ev.clientX - start.x, bounds.width - 90));
      const y = Math.max(26, Math.min(start.wy + ev.clientY - start.y, bounds.height - 50));
      wm.move(win.id, x, y);
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return (
    <div
      ref={ref}
      className={`window-in absolute flex flex-col overflow-hidden rounded-lg ${
        focused ? 'window-shadow-focused' : 'window-shadow'
      } ${dark ? 'bg-[#1c1c1eF5]' : 'bg-[#ececec]'}`}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      onPointerDown={() => wm.focus(win.id)}
    >
      <div
        className={`flex h-8 flex-none cursor-grab items-center gap-2 border-b px-3 active:cursor-grabbing ${
          dark
            ? 'border-black/60 bg-gradient-to-b from-[#4a4a4e] to-[#2e2e32]'
            : 'aqua-titlebar border-[#b4b4b4]'
        }`}
        onPointerDown={onDrag}
      >
        <div className="flex gap-[7px]">
          {closable ? (
            <button
              aria-label="Close window"
              className="aqua-light h-3 w-3 rounded-full bg-[#ff5f57] transition-transform hover:scale-110"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => wm.close(win.id)}
            />
          ) : (
            <span
              title="This terminal closes with its job window"
              className="aqua-light h-3 w-3 rounded-full bg-[#9a9aa0]/70"
            />
          )}
          <span className="aqua-light h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="aqua-light h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <p
          className={`mr-11 flex-1 truncate text-center text-[12.5px] font-semibold ${
            dark ? 'text-neutral-300' : 'text-[#333] [text-shadow:0_1px_0_rgba(255,255,255,0.7)]'
          }`}
        >
          {win.title}
        </p>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      <div
        role="presentation"
        aria-hidden
        className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-nwse-resize"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const start = { x: e.clientX, y: e.clientY, w: win.w, h: win.h };
          function move(ev: PointerEvent) {
            wm.resize(win.id, start.w + ev.clientX - start.x, start.h + ev.clientY - start.y);
          }
          function up() {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
          }
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}
      >
        <svg viewBox="0 0 16 16" className={dark ? 'opacity-40' : 'opacity-30'}>
          <path
            d="M15 6 L6 15 M15 10 L10 15 M15 14 L14 15"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}
