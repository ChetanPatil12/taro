import { useEffect, useState } from 'react';
import { api, LOCKED_EVENT } from './lib/api.js';
import { LockScreen } from './desktop/LockScreen.js';
import { useWallpaper } from './desktop/useWallpaper.js';
import { DesktopIcons } from './desktop/DesktopIcons.js';
import type { DesktopApp } from './desktop/DesktopIcons.js';
import { JobsWidget } from './desktop/JobsWidget.js';
import { MenuBar } from './desktop/MenuBar.js';
import { StickyNote } from './desktop/StickyNote.js';
import { Window } from './desktop/Window.js';
import { useWindowManager, WindowManagerProvider } from './desktop/windowing.js';
import { JobApprovalAlerts } from './windows/ApprovalAlerts.js';
import { JobWindow } from './windows/JobWindow.js';
import { NewJobWindow } from './windows/NewJobWindow.js';
import { PresetWindow } from './windows/PresetWindow.js';
import { TerminalWindow } from './windows/TerminalWindow.js';
import { WatchDemoWindow } from './windows/WatchDemoWindow.js';

const REPO_URL = 'https://github.com/ChetanPatil12/taro';

function Desktop() {
  const wm = useWindowManager();
  const wallpaper = useWallpaper();
  const [live, setLive] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const onLocked = () => setLocked(true);
    window.addEventListener(LOCKED_EVENT, onLocked);
    api
      .unlockStatus()
      .then((s) => setLocked(s.required && !s.unlocked))
      .catch(() => {});
    return () => window.removeEventListener(LOCKED_EVENT, onLocked);
  }, []);

  useEffect(() => {
    const probe = () =>
      fetch('/api/health')
        .then((r) => setLive(r.ok))
        .catch(() => setLive(false));
    void probe();
    const t = setInterval(probe, 10_000);
    return () => clearInterval(t);
  }, []);

  const topWin = wm.windows.reduce((a, b) => (a && a.z > b.z ? a : b), wm.windows[0]);

  const apps: DesktopApp[] = [
    {
      id: 'roofing-demo',
      label: 'Roofing Demo',
      icon: 'roofing-demo',
      glyph: '🏠',
      gradient: 'linear-gradient(160deg, #ff9f0a, #d94f04)',
      onClick: () => wm.openApp('preset'),
    },
    {
      id: 'new-job',
      label: 'New Job',
      icon: 'new-job',
      glyph: '＋',
      gradient: 'linear-gradient(160deg, #34c759, #1a9a44)',
      onClick: () => wm.openApp('new-job'),
    },
    {
      id: 'watch-demo',
      label: 'Watch Demo',
      icon: 'watch-demo',
      glyph: '▶',
      gradient: 'linear-gradient(160deg, #5e5ce6, #3634a3)',
      onClick: () => wm.openApp('watch-demo'),
    },
    {
      id: 'github',
      label: 'Source Code',
      icon: 'github',
      glyph: '⌥',
      gradient: 'linear-gradient(160deg, #48484a, #1c1c1e)',
      onClick: () => window.open(REPO_URL, '_blank', 'noopener'),
    },
  ];

  return (
    <div
      className="desktop-bg relative h-full w-full overflow-hidden"
      style={wallpaper ? { backgroundImage: `url('${wallpaper}')` } : undefined}
    >
      <MenuBar live={live} />
      <JobsWidget refreshKey={refreshKey} />
      <StickyNote />
      <DesktopIcons apps={apps} />

      {wm.windows.map((win) => {
        const focused = topWin?.id === win.id;
        switch (win.kind) {
          case 'job':
            return (
              <Window key={win.id} win={win} focused={focused}>
                <JobWindow jobId={win.jobId!} />
              </Window>
            );
          case 'terminal':
            return (
              <Window
                key={win.id}
                win={{ ...win, title: `Agent Activity — ${win.title}` }}
                focused={focused}
                closable={false}
                dark
              >
                <TerminalWindow jobId={win.jobId!} />
              </Window>
            );
          case 'new-job':
            return (
              <Window key={win.id} win={win} focused={focused}>
                <NewJobWindow onCreated={() => setRefreshKey((k) => k + 1)} />
              </Window>
            );
          case 'preset':
            return (
              <Window key={win.id} win={win} focused={focused}>
                <PresetWindow onCreated={() => setRefreshKey((k) => k + 1)} />
              </Window>
            );
          case 'watch-demo':
            return (
              <Window key={win.id} win={win} focused={focused}>
                <WatchDemoWindow />
              </Window>
            );
          default:
            return null;
        }
      })}

      {wm.windows
        .filter((w) => w.kind === 'job')
        .map((w) => (
          <JobApprovalAlerts key={w.id} jobId={w.jobId!} />
        ))}

      {locked && (
        <LockScreen onUnlocked={() => setLocked(false)} onDismiss={() => setLocked(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <WindowManagerProvider>
      <Desktop />
    </WindowManagerProvider>
  );
}
