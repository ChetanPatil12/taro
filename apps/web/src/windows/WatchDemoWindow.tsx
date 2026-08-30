import { useState } from 'react';

/** Plays /demo.mp4 from apps/web/public once the demo video is recorded. */
export function WatchDemoWindow() {
  const [missing, setMissing] = useState(false);
  return (
    <div className="flex h-full items-center justify-center bg-black">
      {missing ? (
        <div className="p-8 text-center text-[13px] text-neutral-400">
          <p className="text-2xl">🎬</p>
          <p className="mt-2 font-semibold text-neutral-200">Demo video not found</p>
          <p className="mt-1">
            Drop <code className="mono text-neutral-300">demo.mp4</code> into{' '}
            <code className="mono text-neutral-300">apps/web/public/</code> and reopen.
          </p>
        </div>
      ) : (
        <video
          className="h-full w-full"
          src="/demo.mp4"
          controls
          onError={() => setMissing(true)}
        />
      )}
    </div>
  );
}
