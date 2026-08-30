import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';

export type WindowKind = 'job' | 'terminal' | 'new-job' | 'watch-demo' | 'preset';

export interface Win {
  /** 'job:<id>' | 'terminal:<id>' | 'new-job' | 'watch-demo' */
  id: string;
  kind: WindowKind;
  jobId?: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

export const DEFAULT_SIZE: Record<WindowKind, { w: number; h: number }> = {
  preset: { w: 640, h: 560 },
  job: { w: 780, h: 520 },
  terminal: { w: 560, h: 200 },
  'new-job': { w: 560, h: 560 },
  'watch-demo': { w: 720, h: 430 },
};

export const MIN_SIZE: Record<WindowKind, { w: number; h: number }> = {
  preset: { w: 460, h: 380 },
  job: { w: 560, h: 380 },
  terminal: { w: 380, h: 140 },
  'new-job': { w: 420, h: 380 },
  'watch-demo': { w: 400, h: 260 },
};

interface WmState {
  windows: Win[];
  nextZ: number;
}

type WmAction =
  | { type: 'open'; win: Omit<Win, 'z' | 'w' | 'h'> }
  | { type: 'close'; id: string }
  | { type: 'focus'; id: string }
  | { type: 'move'; id: string; x: number; y: number }
  | { type: 'resize'; id: string; w: number; h: number }
  | { type: 'retitle'; id: string; title: string };

/**
 * Rule (user spec): a job window and its terminal are one unit — opening a
 * job opens its terminal; closing the job closes the terminal; the terminal
 * itself has no close control.
 */
function reduce(state: WmState, action: WmAction): WmState {
  switch (action.type) {
    case 'open': {
      if (state.windows.some((w) => w.id === action.win.id)) {
        return reduce(state, { type: 'focus', id: action.win.id });
      }
      const opened: Win[] = [{ ...action.win, ...DEFAULT_SIZE[action.win.kind], z: state.nextZ }];
      if (action.win.kind === 'job' && action.win.jobId) {
        opened.push({
          id: `terminal:${action.win.jobId}`,
          kind: 'terminal',
          jobId: action.win.jobId,
          title: action.win.title,
          x: action.win.x - 40,
          y: action.win.y + 330,
          ...DEFAULT_SIZE.terminal,
          z: state.nextZ + 1,
        });
      }
      return { windows: [...state.windows, ...opened], nextZ: state.nextZ + opened.length };
    }
    case 'close': {
      const target = state.windows.find((w) => w.id === action.id);
      if (!target || target.kind === 'terminal') return state; // terminals never close directly
      const closing = new Set([target.id]);
      if (target.kind === 'job' && target.jobId) closing.add(`terminal:${target.jobId}`);
      return { ...state, windows: state.windows.filter((w) => !closing.has(w.id)) };
    }
    case 'focus':
      return {
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, z: state.nextZ } : w)),
        nextZ: state.nextZ + 1,
      };
    case 'move':
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, x: action.x, y: action.y } : w,
        ),
      };
    case 'resize': {
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id
            ? {
                ...w,
                w: Math.max(MIN_SIZE[w.kind].w, action.w),
                h: Math.max(MIN_SIZE[w.kind].h, action.h),
              }
            : w,
        ),
      };
    }
    case 'retitle': {
      const target = state.windows.find((w) => w.id === action.id);
      if (!target || target.title === action.title) return state; // no-op: avoid rerender loops
      return {
        ...state,
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, title: action.title } : w)),
      };
    }
    default:
      return state;
  }
}

interface WindowManager {
  windows: Win[];
  topZ: number;
  openJob: (jobId: string, title: string) => void;
  openApp: (kind: 'new-job' | 'watch-demo' | 'preset') => void;
  close: (id: string) => void;
  focus: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, w: number, h: number) => void;
  retitleJob: (jobId: string, title: string) => void;
  isOpen: (id: string) => boolean;
}

const WmContext = createContext<WindowManager | null>(null);

let cascade = 0;
function nextPos(base: { x: number; y: number }) {
  cascade = (cascade + 1) % 6;
  return { x: base.x + cascade * 28, y: base.y + cascade * 24 };
}

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, { windows: [], nextZ: 10 });

  const openJob = useCallback((jobId: string, title: string) => {
    const { x, y } = nextPos({ x: 320, y: 60 });
    dispatch({ type: 'open', win: { id: `job:${jobId}`, kind: 'job', jobId, title, x, y } });
  }, []);
  const openApp = useCallback((kind: 'new-job' | 'watch-demo' | 'preset') => {
    const { x, y } = nextPos({ x: 380, y: 90 });
    const titles = { 'new-job': 'New Job', 'watch-demo': 'Watch Demo', preset: 'Roofing Demo' };
    dispatch({ type: 'open', win: { id: kind, kind, title: titles[kind], x, y } });
  }, []);

  const value = useMemo<WindowManager>(
    () => ({
      windows: state.windows,
      topZ: state.nextZ,
      openJob,
      openApp,
      close: (id) => dispatch({ type: 'close', id }),
      focus: (id) => dispatch({ type: 'focus', id }),
      move: (id, x, y) => dispatch({ type: 'move', id, x, y }),
      resize: (id, w, h) => dispatch({ type: 'resize', id, w, h }),
      retitleJob: (jobId, title) => {
        dispatch({ type: 'retitle', id: `job:${jobId}`, title });
        dispatch({ type: 'retitle', id: `terminal:${jobId}`, title });
      },
      isOpen: (id) => state.windows.some((w) => w.id === id),
    }),
    [state, openJob, openApp],
  );

  return <WmContext.Provider value={value}>{children}</WmContext.Provider>;
}

export function useWindowManager(): WindowManager {
  const ctx = useContext(WmContext);
  if (!ctx) throw new Error('useWindowManager outside provider');
  return ctx;
}
