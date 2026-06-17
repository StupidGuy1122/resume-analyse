"use client";

import { useEffect, useState } from "react";

/**
 * The signature element of this product, dramatized.
 *
 * What you see on the left of /login is exactly what the product does to a
 * resume after upload: an AI editor types out a passage, then marks it up with
 * red proof underlines, blue margin rules, and amber highlights — the same
 * vocabulary used elsewhere on the analysis page.
 *
 * The animation runs on a fixed schedule so the choreography is the same each
 * time the page loads — no random jitter that would feel "AI-generated."
 */
export default function ProofreadingShowcase() {
  // Fixed schedule, in ms from mount
  // 0       — start typing line 1
  // 2400    — line 1 finishes; underline draws on "responsible for tasks"
  // 3000    — start typing line 2
  // 5400    — line 2 finishes; squiggle on "various", margin note appears
  // 6000    — start typing line 3
  // 8400    — line 3 finishes; circle "30%", arrow connects to amber highlight
  // 9400    — typing complete; show summary card (sticky)
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

  // Looping schedule: full 12s loop, then restart
  const loop = t % 12000;

  const line1 = useTypedText(
    "Responsible for various tasks across the engineering team.",
    loop,
    0,
    2400,
  );
  const line2 = useTypedText(
    "Helped improve performance by ~30% during Q3 migration.",
    loop,
    3000,
    2400,
  );
  const line3 = useTypedText(
    "Worked closely with stakeholders to deliver on time.",
    loop,
    6000,
    2400,
  );

  const showSquiggleVarious = loop > 5400;
  const showCircleNumber = loop > 8400;
  const showMarginNote = loop > 5800;
  const showVerdict = loop > 9400;

  return (
    <div className="relative h-full w-full overflow-hidden bg-background bg-grain">
      {/* Top status bar — looks like a manuscript header */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between border-b border-border px-10 py-4 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
        <span>Proof copy · Galley 01</span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-proof" />
          Editor live
        </span>
      </div>

      {/* Margin column with line numbers and rule */}
      <div className="absolute bottom-0 left-0 top-14 w-16 border-r border-[hsl(var(--rule-light))]">
        <div className="mt-12 flex flex-col items-end gap-[14px] pr-3 text-[10px] font-mono leading-[1.6] text-muted-foreground/70">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i}>{String(i + 1).padStart(2, "0")}</span>
          ))}
        </div>
      </div>

      {/* Manuscript body */}
      <div className="absolute inset-0 pl-20 pr-12 pt-20">
        <div className="max-w-[480px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Experience · Senior Engineer · 2022—now
          </p>
          <h3 className="mt-2 font-display text-2xl leading-tight text-foreground">
            Acme Corp.
          </h3>

          <div className="mt-6 space-y-4 font-display text-[17px] leading-[1.7] text-foreground">
            {/* Line 1 — gets a red proof underline on "Responsible for various tasks" */}
            <p className="relative">
              <Marked
                text={line1}
                full="Responsible for various tasks across the engineering team."
                mark="Responsible for various tasks"
                style="strike"
                active={loop > 2400}
              />
              {loop > 0 && loop < 2400 && <span className="typewriter-caret" />}
            </p>

            {/* Line 2 — squiggle under "various", margin note "be specific" */}
            <p className="relative">
              <Marked
                text={line2}
                full="Helped improve performance by ~30% during Q3 migration."
                mark="~30%"
                style="circle"
                active={showCircleNumber}
              />
              {loop >= 3000 && loop < 5400 && <span className="typewriter-caret" />}

              {showMarginNote && (
                <span
                  className="pointer-events-none absolute -right-44 top-0 hidden w-40 animate-fade-in text-[11px] leading-snug text-proof md:block"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <span className="block uppercase tracking-[0.2em] opacity-70">
                    Margin
                  </span>
                  <span>quantify — what shipped?</span>
                </span>
              )}
            </p>

            {/* Line 3 — highlight under "on time" */}
            <p className="relative">
              <Marked
                text={line3}
                full="Worked closely with stakeholders to deliver on time."
                mark="on time"
                style="highlight"
                active={loop > 9000}
              />
              {loop >= 6000 && loop < 8400 && <span className="typewriter-caret" />}
            </p>
          </div>

          {/* Verdict slip — appears after all three marks land */}
          {showVerdict && (
            <div className="mt-12 max-w-[420px] animate-fade-in-up border-l-2 border-proof pl-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-proof">
                Editor's note
              </p>
              <p className="mt-2 font-display text-[18px] leading-snug text-foreground">
                3 lines, 3 fixes.{" "}
                <span className="proof-mark">Specifics beat generalities.</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer credit */}
      <div className="absolute bottom-6 left-20 right-12 flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
        <span>—</span>
        <span>resume-analyse / proof room</span>
      </div>
    </div>
  );
}

/**
 * Renders `text` (the typed-so-far prefix). When `active` and the marked
 * substring is fully present, paints a proof mark over it.
 */
function Marked({
  text,
  full,
  mark,
  style,
  active,
}: {
  text: string;
  full: string;
  mark: string;
  style: "strike" | "circle" | "highlight";
  active: boolean;
}) {
  const idx = full.indexOf(mark);
  if (idx === -1) return <>{text}</>;

  // Decide what slice of the marked region the user has typed past.
  const before = text.slice(0, Math.min(idx, text.length));
  const middle = text.slice(idx, Math.min(idx + mark.length, text.length));
  const after = text.slice(idx + mark.length);
  const middleComplete = middle.length === mark.length;

  return (
    <>
      {before}
      <span className="relative inline-block">
        {middle}
        {active && middleComplete && (
          <MarkOverlay style={style} />
        )}
      </span>
      {after}
    </>
  );
}

function MarkOverlay({ style }: { style: "strike" | "circle" | "highlight" }) {
  if (style === "strike") {
    return (
      <span className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-[6px] origin-left animate-draw-underline">
        <svg
          viewBox="0 0 200 6"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <path
            d="M0 4 Q 8 0 16 4 T 32 4 T 48 4 T 64 4 T 80 4 T 96 4 T 112 4 T 128 4 T 144 4 T 160 4 T 176 4 T 200 4"
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
    return (
      <svg
        className="pointer-events-none absolute -inset-x-2 -inset-y-1"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
      >
        <ellipse
          cx="50"
          cy="20"
          rx="46"
          ry="16"
          fill="none"
          stroke="hsl(var(--proof))"
          strokeWidth="1.5"
          strokeDasharray="360"
          strokeDashoffset="360"
          style={{ animation: "draw-circle 0.7s cubic-bezier(0.16,1,0.3,1) forwards" }}
        />
      </svg>
    );
  }
  // highlight
  return (
    <span
      className="pointer-events-none absolute inset-x-[-2px] inset-y-0 origin-left animate-draw-underline"
      style={{
        background: "hsl(var(--amber) / 0.32)",
        zIndex: -1,
      }}
    />
  );
}

/**
 * Returns the substring of `target` that should be visible at time `time`,
 * given a typing window that starts at `startMs` and lasts `durationMs`.
 */
function useTypedText(target: string, time: number, startMs: number, durationMs: number) {
  const local = time - startMs;
  if (local < 0) return "";
  if (local >= durationMs) return target;
  const ratio = local / durationMs;
  const cut = Math.floor(target.length * ratio);
  return target.slice(0, cut);
}
