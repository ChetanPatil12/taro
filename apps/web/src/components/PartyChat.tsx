import { useEffect, useRef, useState } from 'react';
import { Paperclip, Send } from 'lucide-react';
import type { LogEntry, Party } from '@taro/shared';
import { api } from '../lib/api.js';
import { Button, Meta } from './ui.js';

type Entry = LogEntry & { partyName?: string | null };

export function PartyChat({
  jobId,
  parties,
  log,
}: {
  jobId: string;
  parties: Party[];
  log: Entry[];
}) {
  const [activeId, setActiveId] = useState<string | null>(parties[0]?.id ?? null);
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = parties.find((p) => p.id === activeId) ?? parties[0];
  const thread = log.filter((e) => e.partyId === active?.id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
  }, [thread.length, activeId]);

  async function send() {
    if (!active || (!draft.trim() && !file)) return;
    setSending(true);
    setError(null);
    try {
      let payload: { name: string; mime: string; data_base64: string } | undefined;
      if (file) {
        const buf = await file.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        payload = {
          name: file.name,
          mime: file.type || 'application/octet-stream',
          data_base64: btoa(binary),
        };
      }
      await api.sendMessage(jobId, active.id, draft.trim() || `(sent ${file?.name})`, payload);
      setDraft('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (!active) return null;

  return (
    <section>
      <div role="tablist" className="flex flex-wrap">
        {parties.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === active.id}
            onClick={() => setActiveId(p.id)}
            className={`border border-b-0 border-foreground px-4 py-2 font-mono text-xs uppercase tracking-widest transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground ${
              p.id === active.id ? 'bg-foreground text-background' : 'hover:bg-neutral-100'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="flex h-[520px] flex-col border border-foreground bg-background">
        <div className="border-b border-muted px-4 py-2">
          <Meta>
            {active.role} — {active.instructions.slice(0, 110)}
            {active.instructions.length > 110 ? '…' : ''}
          </Meta>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {thread.length === 0 && (
            <p className="py-8 text-center font-body italic text-neutral-500">
              No correspondence yet.
            </p>
          )}
          {thread.map((e) => (
            <article
              key={e.id}
              className={`border-b border-muted py-3 ${
                e.direction === 'outbound'
                  ? 'text-right'
                  : e.direction === 'system'
                    ? 'text-center'
                    : 'text-left'
              }`}
            >
              <Meta>
                {e.direction === 'outbound'
                  ? 'Taro (agent)'
                  : e.direction === 'system'
                    ? '—'
                    : active.name}
                {' · '}
                {new Date(e.createdAt).toLocaleTimeString()}
              </Meta>
              <p
                className={`mt-1 whitespace-pre-wrap font-body text-sm leading-relaxed ${
                  e.direction === 'system' ? 'italic text-neutral-500' : ''
                }`}
              >
                {e.message}
              </p>
              {e.messageType === 'file' && (
                <p className="mt-1 inline-block border border-foreground px-2 py-1 font-mono text-xs">
                  Fig. — attachment
                </p>
              )}
            </article>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-foreground p-3">
          {file && (
            <p className="mb-2 font-mono text-xs">
              Fig. — {file.name}{' '}
              <button
                className="underline decoration-accent decoration-2"
                onClick={() => setFile(null)}
              >
                remove
              </button>
            </p>
          )}
          {error && <p className="mb-2 font-mono text-xs text-accent">{error}</p>}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              id="chat-file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              aria-label="Attach file"
              className="flex h-11 w-11 items-center justify-center border border-foreground transition-all hover:bg-foreground hover:text-background"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={16} strokeWidth={1.5} />
            </button>
            <input
              className="min-h-[44px] flex-1 border-b-2 border-foreground bg-transparent px-3 font-mono text-sm focus-visible:bg-[#F0F0F0] focus-visible:outline-none"
              placeholder={`Reply as ${active.name}…`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button kind="primary" onClick={send} disabled={sending || (!draft.trim() && !file)}>
              <span className="flex items-center gap-2">
                <Send size={14} strokeWidth={1.5} /> Send as {active.name.split(' ')[0]}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
