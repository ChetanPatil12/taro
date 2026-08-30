/** Desktop sticky note carrying the project brief (per user spec). */
export function StickyNote() {
  return (
    <div
      className="absolute bottom-10 left-8 z-[4] w-[250px] -rotate-1 shadow-[3px_6px_18px_rgba(0,0,0,0.45)]"
      style={{
        background: 'linear-gradient(180deg, #fdf7a8 0%, #f8ee7e 100%)',
        fontFamily: "'Marker Felt', 'Segoe Print', 'Comic Sans MS', cursive",
      }}
    >
      <p className="border-b border-[#d9cc4a] px-3 py-1.5 text-center text-[12px] font-bold text-[#6b5d0c]">
        taro — the brief
      </p>
      <div className="space-y-2 px-3.5 py-3 text-[13px] leading-snug text-[#4a3f08]">
        <p>
          one agent coordinates <b>every party</b> in a job — in parallel. it writes &amp; runs code
          in a TrueForge sandbox for the hard parts.
        </p>
        <p>
          nothing binding happens without a human clicking <b>approve</b>.
        </p>
        <p>
          try it → open <b>Roofing Demo</b>, approve the plan, then reply as Sarah ☺
        </p>
      </div>
      <p className="px-3.5 pb-2 text-right text-[10px] text-[#8a7a1e]">
        agent harness hackathon · aug 2026
      </p>
    </div>
  );
}
