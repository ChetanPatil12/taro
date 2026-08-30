import { useState } from 'react';
import { api, setUnlockToken } from '../lib/api.js';

/**
 * The hosted demo's login moment, styled like the macOS lock screen —
 * except the password field takes the visitor's OpenAI API key.
 */
export function LockScreen({
  onUnlocked,
  onDismiss,
}: {
  onUnlocked: () => void;
  onDismiss: () => void;
}) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  async function submit() {
    if (!key.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.unlock(key.trim());
      setUnlockToken(token);
      onUnlocked();
    } catch (e) {
      setError((e as Error).message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-black/40 backdrop-blur-2xl">
      <div className={`flex flex-col items-center ${shake ? 'animate-[lockshake_0.4s]' : ''}`}>
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-[44px] text-white shadow-xl backdrop-blur-md">
          ✦
        </div>
        <p className="mt-4 text-[19px] font-semibold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]">
          Taro Demo
        </p>
        <p className="mt-1 max-w-[36ch] text-center text-[12px] leading-relaxed text-white/75">
          Browsing is open. To talk to the agent, unlock with your own OpenAI API key — bring your
          own key, pay only for what you run.
        </p>

        <div className="mt-5 flex items-center gap-2">
          <input
            autoFocus
            type="password"
            spellCheck={false}
            placeholder="OpenAI API key (sk-…)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            className="h-9 w-64 rounded-full border border-white/30 bg-white/20 px-4 text-[13px] text-white placeholder-white/50 outline-none backdrop-blur-md focus:border-white/70"
          />
          <button
            aria-label="Unlock"
            disabled={busy || !key.trim()}
            onClick={submit}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-[15px] text-white backdrop-blur-md hover:bg-white/40 disabled:opacity-30"
          >
            {busy ? '…' : '→'}
          </button>
        </div>

        {error && (
          <p className="mt-3 max-w-[44ch] text-center text-[12px] text-[#ffb3ad]">{error}</p>
        )}

        <p className="mt-6 max-w-[46ch] text-center text-[10.5px] leading-relaxed text-white/50">
          Your key is validated with OpenAI, handed to the TrueForge harness in memory for model
          calls, and never written to disk or logs.
        </p>
        <button
          onClick={onDismiss}
          className="mt-4 text-[12px] text-white/60 underline-offset-2 hover:text-white hover:underline"
        >
          Keep browsing without unlocking
        </button>
      </div>
      <style>{`@keyframes lockshake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-10px)}40%,80%{transform:translateX(10px)}}`}</style>
    </div>
  );
}
