"use client";

import { useEffect, useState } from "react";

/**
 * Left-side signature: a full galley sheet being marked up live.
 *
 * Layout is a 4-column grid so margin notes sit on the same row as the line
 * they annotate — no measuring, no jitter:
 *
 *   ┌ line# ┐ rule │ text                       │ margin notes
 *
 * Each "row" is a self-contained sub-component (Hed/Para/Skills) that owns
 * its typing window and its own mark + note. The whole sheet loops on a
 * 14s schedule so the choreography reads the same every visit.
 */
export default function ProofreadingShowcase() {
  const [t, setT] = useState(0);

  useEffect(() => {
    const start = performance.timeOrigin + performance.now();
    let raf = 0;
    const step = () => {
      const now = performance.timeOrigin + performance.now();
      setT(now - start);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const loop = t % 22000;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background bg-grain">
      {/* Galley header */}
      <div className="flex items-center justify-between border-b border-border px-8 py-3.5 font-mono text-[13px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>Proof copy · Galley 01 · folio I</span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-proof" />
          Editor live
        </span>
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden px-8 py-8">
        <Sheet loop={loop} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-8 py-3.5 font-mono text-[13px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>—</span>
        <span>resume-analyse / proof room</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Sheet — a full galley laid out as a 4-col editorial grid                  */
/* ------------------------------------------------------------------------ */

function Sheet({ loop }: { loop: number }) {
  return (
    <div className="grid grid-cols-[2.5rem_1px_minmax(0,1fr)_220px] gap-x-5 gap-y-1.5">
      {/* Manuscript heading — name */}
      <Row line="01">
        <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
          Curriculum vitæ
        </p>
      </Row>
      <Row line="02" emphasis>
        <h2 className="font-display text-[34px] leading-[1.05] tracking-tight text-foreground">
          Xiao <span className="italic font-light">Ming</span>
        </h2>
      </Row>
      <Row line="03">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Senior Software Engineer · Beijing
        </p>
      </Row>
      <Spacer line="04" />

      {/* Section: Experience */}
      <SectionHead line="05" label="Experience" />
      <Spacer line="06" />

      <Row line="07" emphasis>
        <p className="flex items-baseline justify-between gap-4 font-display text-[18px] leading-tight text-foreground">
          <span>Acme Corp.</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            2026 — now
          </span>
        </p>
      </Row>

      <ParaRow
        line="08"
        startMs={400}
        durationMs={1700}
        loop={loop}
        full="Responsible for various tasks across the engineering team."
        mark={{ word: "various tasks", style: "strike", at: 2200 }}
        note={{ at: 2200, label: "Margin", body: "name them — what shipped?" }}
      />

      <ParaRow
        line="09"
        startMs={2900}
        durationMs={1700}
        loop={loop}
        full="Helped improve checkout latency by ~30% during Q3 migration."
        mark={{ word: "~30%", style: "circle", at: 4700 }}
        note={{ at: 4700, label: "Good", body: "quantified — keep this voice" }}
      />

      <ParaRow
        line="10"
        startMs={5200}
        durationMs={1700}
        loop={loop}
        full="Worked closely with stakeholders to deliver on time."
        mark={{ word: "on time", style: "highlight", at: 7000 }}
        note={{ at: 7000, label: "Vague", body: "vs. which deadline?" }}
      />

      <Spacer line="11" />

      {/* Section: Projects (NEW) */}
      <SectionHead line="12" label="Projects" />
      <Spacer line="13" />

      <Row line="14" emphasis>
        <p className="flex items-baseline justify-between gap-4 font-display text-[18px] leading-tight text-foreground">
          <span>Plume — distributed log store</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            2023
          </span>
        </p>
      </Row>

      <ParaRow
        line="15"
        startMs={7600}
        durationMs={1900}
        loop={loop}
        full="Co-authored a Raft-based log replicator handling 1.2M ops/s."
        mark={{ word: "1.2M ops/s", style: "circle", at: 9700 }}
        note={{ at: 9700, label: "Sharp", body: "lead with this number" }}
      />

      <ParaRow
        line="16"
        startMs={10000}
        durationMs={1900}
        loop={loop}
        full="Did a lot of work on the consensus layer and the storage tier."
        mark={{ word: "Did a lot of work", style: "strike", at: 12100 }}
        note={{ at: 12100, label: "Vague", body: "specifics — which paths?" }}
      />

      <Spacer line="17" />

      {/* Section: Education */}
      <SectionHead line="18" label="Education" />
      <Spacer line="19" />
      <Row line="20" emphasis>
        <p className="flex items-baseline justify-between gap-4 font-display text-[16px] leading-tight text-foreground">
          <span>Tsinghua University · M.Sc.</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            2018 — 2021
          </span>
        </p>
      </Row>
      <Row line="21">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Thesis on distributed systems under Prof. Liu.
        </p>
      </Row>

      <Spacer line="22" />

      {/* Section: Skills */}
      <SectionHead line="23" label="Skills" />
      <Spacer line="24" />
      <ParaRow
        line="25"
        startMs={12600}
        durationMs={1900}
        loop={loop}
        full="Passionate, detail-oriented, fast learner. Python, Go, Rust."
        mark={{
          word: "Passionate, detail-oriented, fast learner. ",
          style: "delete",
          at: 14700,
        }}
        note={{ at: 14700, label: "Delete", body: "empty calories — keep the list" }}
        font="mono"
      />

      {/* Section: Publications */}
      <Spacer line="26" />
      <SectionHead line="27" label="Selected publications" />
      <Spacer line="28" />
      <ParaRow
        line="29"
        startMs={15200}
        durationMs={2000}
        loop={loop}
        full="Wei et al. — On the cost of total order. SOSP 2024."
        mark={{ word: "SOSP 2024", style: "highlight", at: 17400 }}
        note={{ at: 17400, label: "Lead", body: "venue earns the spotlight" }}
        font="mono"
      />

      {/* Verdict slip */}
      <div className="col-span-4 mt-8">
        {loop > 18400 && <Verdict />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Row primitives                                                            */
/* ------------------------------------------------------------------------ */

function Row({
  line,
  emphasis = false,
  children,
}: {
  line: string;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <span className="select-none pt-1 text-right font-mono text-[10px] leading-[1.6] text-muted-foreground/55 tabular-nums">
        {line}
      </span>
      <span
        className={
          "self-stretch " +
          (emphasis ? "bg-[hsl(var(--rule))]/30 w-[1px]" : "bg-[hsl(var(--rule-light))] w-[1px]")
        }
      />
      <div className="min-w-0 py-0.5">{children}</div>
      <div />
    </>
  );
}

function Spacer({ line }: { line: string }) {
  return (
    <>
      <span className="select-none text-right font-mono text-[10px] leading-[1.6] text-muted-foreground/35 tabular-nums">
        {line}
      </span>
      <span className="bg-[hsl(var(--rule-light))]/60 w-[1px]" />
      <div className="h-3" />
      <div />
    </>
  );
}

function SectionHead({ line, label }: { line: string; label: string }) {
  return (
    <>
      <span className="select-none text-right font-mono text-[10px] leading-[1.6] text-muted-foreground/55 tabular-nums">
        {line}
      </span>
      <span className="bg-foreground/30 w-[1px]" />
      <div className="flex items-baseline gap-3 border-t border-foreground/40 pt-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-proof">
          §
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">
          {label}
        </span>
        <span className="flex-1 border-t border-dashed border-border self-end mb-1" />
      </div>
      <div />
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* ParaRow — a typed paragraph + optional in-line mark + margin note         */
/* ------------------------------------------------------------------------ */

type MarkStyle = "strike" | "circle" | "highlight" | "delete";

function ParaRow({
  line,
  startMs,
  durationMs,
  loop,
  full,
  mark,
  note,
  font = "display",
}: {
  line: string;
  startMs: number;
  durationMs: number;
  loop: number;
  full: string;
  mark: { word: string; style: MarkStyle; at: number };
  note: { at: number; label: string; body: string };
  font?: "display" | "mono";
}) {
  const typed = useTypedText(full, loop, startMs, durationMs);
  const typingDone = loop > startMs + durationMs;
  const showMark = loop > mark.at;
  const showNote = loop > note.at - 100;
  const isTyping = loop >= startMs && loop < startMs + durationMs;

  const idx = full.indexOf(mark.word);
  const before = idx >= 0 ? full.slice(0, idx) : full;
  const middle = idx >= 0 ? full.slice(idx, idx + mark.word.length) : "";
  const after = idx >= 0 ? full.slice(idx + mark.word.length) : "";

  // For typewriter, render only what's been typed so far. After typing
  // completes, render the full string so the mark targets the real span.
  const renderText = typingDone ? full : typed;

  const fontClass =
    font === "mono"
      ? "font-mono text-[12px] leading-[1.7] text-foreground/90"
      : "font-display text-[15.5px] leading-[1.65] text-foreground";

  return (
    <>
      <span className="select-none pt-1 text-right font-mono text-[10px] leading-[1.6] text-muted-foreground/55 tabular-nums">
        {line}
      </span>
      <span className="self-stretch w-[1px] bg-[hsl(var(--rule-light))]" />
      <div className="min-w-0 py-0.5">
        <p className={fontClass}>
          {typingDone ? (
            <>
              {before}
              <span className="relative inline-block leading-none align-baseline">
                {middle}
                {showMark && <MarkOverlay style={mark.style} />}
              </span>
              {after}
            </>
          ) : (
            <>{renderText}</>
          )}
          {isTyping && <span className="typewriter-caret" />}
        </p>
      </div>
      <aside className="self-start pt-1">
        {showNote && <MarginNote label={note.label} body={note.body} />}
      </aside>
    </>
  );
}

function MarginNote({ label, body }: { label: string; body: string }) {
  return (
    <div className="animate-fade-in border-l-2 border-proof pl-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-proof">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[11px] leading-snug text-foreground/85">
        {body}
      </p>
    </div>
  );
}

function MarkOverlay({ style }: { style: MarkStyle }) {
  if (style === "strike") {
    return (
      <span className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-[6px] origin-left animate-draw-underline">
        <svg
          viewBox="0 0 200 6"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <path
            d="M0 4 Q 6 0 12 4 T 24 4 T 36 4 T 48 4 T 60 4 T 72 4 T 84 4 T 96 4 T 108 4 T 120 4 T 132 4 T 144 4 T 156 4 T 168 4 T 180 4 T 200 4"
            fill="none"
            stroke="hsl(var(--proof))"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }
  if (style === "circle") {
    // Circle uses an SVG that wraps the inline-block letter box.
    // The parent span is `leading-none`, so its height ≈ cap-height; we add
    // small symmetric insets so the ellipse breathes around the glyphs without
    // drifting off-centre on the y-axis.
    return (
      <svg
        className="pointer-events-none absolute -inset-x-2 -inset-y-1.5 h-[calc(100%+12px)] w-[calc(100%+16px)]"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        aria-hidden
      >
        <ellipse
          cx="50"
          cy="20"
          rx="47"
          ry="17"
          fill="none"
          stroke="hsl(var(--proof))"
          strokeWidth="1.5"
          strokeDasharray="360"
          strokeDashoffset="360"
          style={{
            animation: "draw-circle 0.7s cubic-bezier(0.16,1,0.3,1) forwards",
          }}
        />
      </svg>
    );
  }
  if (style === "delete") {
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] origin-left animate-draw-underline bg-proof"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-[-2px] inset-y-0 -z-10 origin-left animate-draw-underline"
      style={{ background: "hsl(var(--amber) / 0.35)" }}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* Verdict slip                                                              */
/* ------------------------------------------------------------------------ */

function Verdict() {
  return (
    <div className="animate-fade-in-up grid grid-cols-[2.5rem_1px_minmax(0,1fr)_200px] gap-x-5">
      <span className="text-right font-mono text-[10px] tabular-nums text-proof">★</span>
      <span className="bg-proof/40 w-[1px]" />
      <div className="border-l-2 border-proof pl-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-proof">
          Editor's note
        </p>
        <p className="mt-1.5 font-display text-[18px] leading-snug text-foreground">
          6 marks · 3 strikes, 3 nudges.{" "}
          <span className="italic text-muted-foreground">
            Tighten and resubmit.
          </span>
        </p>
      </div>
      <div />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

function useTypedText(
  target: string,
  time: number,
  startMs: number,
  durationMs: number,
) {
  const local = time - startMs;
  if (local < 0) return "";
  if (local >= durationMs) return target;
  const ratio = local / durationMs;
  const cut = Math.floor(target.length * ratio);
  return target.slice(0, cut);
}
