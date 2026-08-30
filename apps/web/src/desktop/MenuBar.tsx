import { useEffect, useState } from 'react';

export function MenuBar({ live }: { live: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  const clock = now.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="absolute inset-x-0 top-0 z-[900] flex h-[26px] items-center gap-5 bg-black/80 px-4 text-[13px] text-white backdrop-blur-xl">
      <span className="text-[14px]">✦</span>
      <span className="font-bold">Taro</span>
      <span className="opacity-75">Jobs</span>
      <span className="opacity-75">Window</span>
      <span className="opacity-75">Help</span>
      <span className="ml-auto flex items-center gap-4 text-[12px]">
        <span className={live ? 'font-semibold text-[#6ee787]' : 'font-semibold text-[#ff8a80]'}>
          ● TrueForge {live ? 'live' : 'offline'}
        </span>
        <span className="opacity-85">{clock}</span>
      </span>
    </div>
  );
}
