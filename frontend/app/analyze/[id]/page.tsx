"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import AnalysisSkeleton from "@/components/AnalysisSkeleton";
import InterviewQuestionList from "@/components/InterviewQuestionList";
import SuggestionCard from "@/components/SuggestionCard";
import { Button } from "@/components/ui/button";
import {
  API_BASE,
  type Difficulty,
  type PredictedInterviewQuestion,
  type SuggestionItem,
  startInterviewSession,
  streamFullAnalysis,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Stage =
  | "idle"
  | "extract:start"
  | "extract:done"
  | "suggestions:start"
  | "suggestions:done"
  | "interview:start"
  | "interview:done"
  | "all:done"
  | "error";

const STAGE_TEXT: Record<Stage, string> = {
  idle: "Preparing",
  "extract:start": "Reading the page",
  "extract:done": "Pencils in hand",
  "suggestions:start": "Marking it up",
  "suggestions:done": "Marks complete",
  "interview:start": "Drafting questions",
  "interview:done": "Questions ready",
  "all:done": "Galley returned",
  error: "Press break",
};

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const resumeId = params.id;

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resumeMeta, setResumeMeta] = useState<{
    filename: string;
    charCount: number;
    rawText: string;
  } | null>(null);

  const [launching, setLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState({ current: 0, total: 0 });
  const [launchError, setLaunchError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [questions, setQuestions] = useState<PredictedInterviewQuestion[]>([]);
  const [suggestionsStarted, setSuggestionsStarted] = useState(false);
  const [questionsStarted, setQuestionsStarted] = useState(false);

  const [tab, setTab] = useState<"suggestions" | "interview">("suggestions");
  const [activeSuggestion, setActiveSuggestion] = useState<number | null>(null);

  // Fetch the resume meta & kick off streaming analysis once.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      try {
        const metaRes = await fetch(`${API_BASE}/api/resume/${resumeId}`, {
          credentials: "include",
        });
        if (!metaRes.ok) throw new Error(`简历不存在或已过期 (HTTP ${metaRes.status})`);
        const meta = await metaRes.json();
        if (cancelled) return;
        setResumeMeta({
          filename: meta.filename,
          charCount: meta.char_count,
          rawText: meta.raw_text as string,
        });

        await streamFullAnalysis(
          resumeId,
          (e) => {
            if (cancelled) return;
            switch (e.stage) {
              case "error":
                setError(e.message);
                setStage("error");
                return;
              case "suggestions:start":
                setSuggestionsStarted(true);
                setStage("suggestions:start");
                return;
              case "suggestion:item":
                setSuggestions((prev) => [...prev, e.data]);
                return;
              case "suggestions:done":
                setSuggestions(e.data.items);
                setStage("suggestions:done");
                return;
              case "interview:start":
                setQuestionsStarted(true);
                setStage("interview:start");
                return;
              case "interview:item":
                setQuestions((prev) => [...prev, e.data]);
                return;
              case "interview:done":
                setQuestions(e.data.items);
                setStage("interview:done");
                return;
              case "extract:start":
              case "extract:done":
              case "all:done":
                setStage(e.stage);
                return;
            }
          },
          controller.signal,
        );
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStage("error");
      }
    }
    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [resumeId]);

  const inFlight = stage !== "all:done" && stage !== "error";
  const analysisDone = stage === "all:done" || stage === "interview:done";

  async function startInterview(count: number, difficulty: Difficulty) {
    setLaunching(true);
    setLaunchError(null);
    setLaunchProgress({ current: 0, total: count });

    let realSid: string | null = null;
    let collected: any[] = [];

    try {
      await startInterviewSession(
        { resume_id: resumeId, question_count: count, difficulty },
        (e) => {
          switch (e.event) {
            case "session:created":
              realSid = e.data.session_id;
              return;
            case "question:item":
              collected.push(e.data);
              setLaunchProgress({ current: collected.length, total: count });
              return;
            case "questions:done":
              return;
            case "error":
              throw new Error(e.message);
          }
        },
      );

      if (!realSid) throw new Error("会话创建失败：未收到 session_id");

      try {
        sessionStorage.setItem(
          `interview:${realSid}`,
          JSON.stringify({ questions: collected, ts: Date.now() }),
        );
      } catch {}

      router.push(`/interview/${realSid}`);
    } catch (e) {
      setLaunchError(e instanceof Error ? e.message : String(e));
      setLaunching(false);
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-3rem)] max-w-[1600px] flex-col px-6 lg:px-10">
      {/* Top bar */}
      <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-foreground/30 py-4">
        <Button asChild variant="ghost" size="sm" className="font-mono text-[13px] uppercase tracking-[0.16em]">
          <Link href="/">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to desk
          </Link>
        </Button>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-[0.16em] text-muted-foreground">
            {inFlight ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-proof" />
            ) : stage === "all:done" ? (
              <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
            ) : stage === "error" ? (
              <span className="h-1.5 w-1.5 rounded-full bg-proof" />
            ) : null}
            <span>{STAGE_TEXT[stage]}</span>
          </div>
          <StartInterviewButton disabled={!analysisDone} onStart={startInterview} />
        </div>
      </header>

      {launching && (
        <InterviewLaunchOverlay
          progress={launchProgress}
          error={launchError}
          onCancel={() => {
            setLaunching(false);
            setLaunchError(null);
          }}
        />
      )}

      {/* 50/50 split */}
      <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)]">
        {/* LEFT — manuscript / preview */}
        <ManuscriptPane
          resumeMeta={resumeMeta}
          suggestions={suggestions}
          activeSuggestion={activeSuggestion}
        />

        {/* GUTTER — typesetter's strip between galley and proofs */}
        <Gutter />

        {/* RIGHT — proofs + questions */}
        <section className="flex h-full flex-col overflow-hidden">
          {/* Tab strip — same h-14 as the manuscript pane header on the left */}
          <div className="flex h-14 flex-shrink-0 items-stretch border-b border-foreground/30">
            <TabButton
              active={tab === "suggestions"}
              onClick={() => setTab("suggestions")}
              label="Edits"
              count={suggestions.length}
            />
            <TabButton
              active={tab === "interview"}
              onClick={() => setTab("interview")}
              label="Questions"
              count={questions.length}
            />
            <div className="flex flex-1 items-center justify-end border-l border-foreground/30 px-5 text-right text-muted-foreground">
              <span className="font-display text-[13px] italic leading-snug">
                {tab === "suggestions"
                  ? "Hover an edit — the original highlights on the left."
                  : "Drafted from your manuscript."}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {tab === "suggestions" ? (
              error ? (
                <ErrorState message={error} />
              ) : !suggestionsStarted ? (
                <AnalysisSkeleton />
              ) : (
                <div>
                  {suggestions.map((item, idx) => (
                    <SuggestionCard
                      key={idx}
                      item={item}
                      index={idx}
                      active={activeSuggestion === idx}
                      onHover={() => setActiveSuggestion(idx)}
                      onLeave={() => setActiveSuggestion(null)}
                    />
                  ))}
                  {stage !== "suggestions:done" &&
                    stage !== "interview:start" &&
                    stage !== "interview:done" &&
                    stage !== "all:done" && (
                      <StreamingHint
                        label={
                          suggestions.length === 0
                            ? "Drafting first edit"
                            : `${suggestions.length} edits · still marking`
                        }
                      />
                    )}
                  {suggestions.length === 0 &&
                    (stage === "suggestions:done" ||
                      stage === "interview:start" ||
                      stage === "interview:done" ||
                      stage === "all:done") && (
                      <p className="px-5 py-10 text-center font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
                        No marks · this manuscript reads clean.
                      </p>
                    )}
                </div>
              )
            ) : error ? (
              <ErrorState message={error} />
            ) : !questionsStarted ? (
              <AnalysisSkeleton />
            ) : (
              <div>
                <InterviewQuestionList items={questions} />
                {stage !== "interview:done" && stage !== "all:done" && (
                  <StreamingHint
                    label={
                      questions.length === 0
                        ? "Drafting first question"
                        : `${questions.length} questions · still drafting`
                    }
                  />
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------------ */
/* Left pane — manuscript                                                    */
/* ------------------------------------------------------------------------ */

function ManuscriptPane({
  resumeMeta,
  suggestions,
  activeSuggestion,
}: {
  resumeMeta: { filename: string; charCount: number; rawText: string } | null;
  suggestions: SuggestionItem[];
  activeSuggestion: number | null;
}) {
  const [view, setView] = useState<"text" | "raw">("text");
  const lines = useMemo(
    () => (resumeMeta?.rawText ?? "").split(/\r?\n/),
    [resumeMeta?.rawText],
  );

  const activeOriginal = activeSuggestion != null
    ? suggestions[activeSuggestion]?.original
    : null;

  // Refs to scroll the active line into view
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const activeLineIdx = useMemo(() => {
    if (!activeOriginal) return -1;
    const needle = activeOriginal.trim().slice(0, 24);
    if (!needle) return -1;
    return lines.findIndex((l) => l.includes(needle));
  }, [activeOriginal, lines]);

  useEffect(() => {
    if (activeLineIdx < 0) return;
    const el = lineRefs.current[activeLineIdx];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLineIdx]);

  return (
    <section className="flex h-full flex-col overflow-hidden bg-card">
      {/* Filename / view toggle — fixed-height row to align with right pane's tab strip */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between gap-4 border-b border-foreground/30 px-6">
        <div className="flex min-w-0 items-baseline gap-3">
          <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-proof">
            Manuscript
          </p>
          <p className="truncate font-display text-[16px] text-foreground">
            {resumeMeta?.filename ?? "—"}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-4">
          {resumeMeta && (
            <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
              {resumeMeta.charCount.toLocaleString()} ch · {lines.length} ln
            </span>
          )}
          <div className="flex border border-foreground/40 font-mono text-[12px] uppercase tracking-[0.16em]">
            <button
              type="button"
              onClick={() => setView("text")}
              className={cn(
                "px-3 py-1.5 transition-colors",
                view === "text"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Extracted
            </button>
            <button
              type="button"
              onClick={() => setView("raw")}
              className={cn(
                "border-l border-foreground/40 px-3 py-1.5 transition-colors",
                view === "raw"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Plain
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-grain">
        {!resumeMeta ? (
          <div className="space-y-3 px-12 py-10">
            <div className="h-4 w-3/4 animate-pulse bg-muted" />
            <div className="h-4 w-2/3 animate-pulse bg-muted" />
            <div className="h-4 w-1/2 animate-pulse bg-muted" />
          </div>
        ) : view === "text" ? (
          <div className="grid grid-cols-[3.5rem_1fr] py-8">
            {lines.map((line, i) => {
              const isActive = activeLineIdx === i;
              const matched =
                activeOriginal && line.trim().length > 0
                  ? line.includes(activeOriginal.trim().slice(0, 24))
                  : false;
              return (
                <div
                  key={i}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  className="contents"
                >
                  <div className="select-none border-r border-[hsl(var(--rule-light))] pr-3 text-right font-mono text-[10px] leading-[1.7] text-muted-foreground/60">
                    {String(i + 1).padStart(3, "0")}
                  </div>
                  <div
                    className={cn(
                      "relative px-6 font-display text-[15.5px] leading-[1.7]",
                      isActive && "bg-amber/15",
                    )}
                  >
                    {line.length === 0 ? " " : matched ? (
                      <Highlight text={line} needle={activeOriginal!} />
                    ) : (
                      line
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap px-12 py-8 font-mono text-[12.5px] leading-[1.65] text-foreground/80">
            {resumeMeta.rawText}
          </pre>
        )}
      </div>

      {/* Foot */}
      <footer className="flex flex-shrink-0 items-center justify-between border-t border-foreground/30 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>Galley · proof copy</span>
        <span>{suggestions.length > 0 ? `${suggestions.length} marks pending` : "—"}</span>
      </footer>
    </section>
  );
}

function Highlight({ text, needle }: { text: string; needle: string }) {
  const trimmed = needle.trim();
  if (!trimmed) return <>{text}</>;
  const probe = trimmed.slice(0, 24);
  const i = text.indexOf(probe);
  if (i < 0) return <>{text}</>;
  // Try to extend to full needle if present, else use the probe length.
  const fullIdx = text.indexOf(trimmed);
  const start = fullIdx >= 0 ? fullIdx : i;
  const end = fullIdx >= 0 ? fullIdx + trimmed.length : i + probe.length;
  return (
    <>
      {text.slice(0, start)}
      <span className="squiggle bg-amber/30 text-foreground">{text.slice(start, end)}</span>
      {text.slice(end)}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Bits                                                                      */
/* ------------------------------------------------------------------------ */

/**
 * The vertical strip between manuscript (left) and proofs (right).
 *
 * Reads as a typesetter's gutter: a hairline rule on each edge with a
 * register mark stamped at the optical centre and a faint repeating tick
 * pattern down the rest. Hidden on mobile (the layout collapses to one col).
 */
function Gutter() {
  return (
    <div
      aria-hidden
      className="relative hidden h-full lg:block"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, hsl(var(--rule-light)) 0, hsl(var(--rule-light)) 4px, transparent 4px, transparent 12px)",
        backgroundSize: "1px 12px",
        backgroundRepeat: "repeat-y",
        backgroundPosition: "center top",
      }}
    >
      {/* Edge hairlines */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-px bg-foreground/15" />
      <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-foreground/15" />

      {/* Top + bottom tick markers */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2 font-mono text-[9px] tracking-[0.16em] text-muted-foreground/70">
        ✕
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[0.16em] text-muted-foreground/70">
        ✕
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 px-6 transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="font-mono text-[13px] uppercase tracking-[0.16em]">{label}</span>
      {count > 0 && (
        <span
          className={cn(
            "font-mono text-[12px] tabular-nums",
            active ? "text-background/70" : "text-proof",
          )}
        >
          {String(count).padStart(2, "0")}
        </span>
      )}
    </button>
  );
}

function StreamingHint({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-dashed border-border px-5 py-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin text-proof" />
      <span className="shimmer-text">{label}</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="m-5 border-l-2 border-proof bg-proof/[0.06] p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-proof">
        Press break · analysis failed
      </p>
      <p className="mt-2 font-display text-[16px] text-foreground">{message}</p>
      <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        提示：确认 Ollama 服务已启动，并已{" "}
        <code className="bg-muted px-1">ollama pull qwen2.5:7b</code>。
      </p>
    </div>
  );
}

function StartInterviewButton({
  disabled,
  onStart,
}: {
  disabled: boolean;
  onStart: (count: number, difficulty: "junior" | "mid" | "senior") => void;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"junior" | "mid" | "senior">("mid");

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group flex items-center gap-3 rounded-md border bg-foreground px-5 py-2.5 font-mono text-[13px] uppercase tracking-[0.16em] text-background transition-colors",
          disabled
            ? "cursor-not-allowed opacity-40"
            : "border-foreground hover:bg-background hover:text-foreground",
        )}
      >
        Sit for the panel
        <span className="font-display text-[16px] leading-none transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </button>
      {open && !disabled && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 border border-foreground bg-card p-5 shadow-[6px_6px_0_hsl(var(--foreground))]">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-proof">
            Set the panel
          </p>
          <h4 className="mt-1 font-display text-[20px] leading-tight">
            How long, how hard?
          </h4>

          <div className="mt-5 space-y-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Questions
              </label>
              <div className="mt-1.5 grid grid-cols-4 border border-border">
                {[3, 5, 8, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={cn(
                      "border-r border-border py-2 font-mono text-[12px] tabular-nums transition-colors last:border-r-0",
                      count === n
                        ? "bg-foreground text-background"
                        : "hover:bg-muted",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Tone
              </label>
              <div className="mt-1.5 grid grid-cols-3 border border-border">
                {(
                  [
                    { v: "junior", label: "Cordial" },
                    { v: "mid", label: "Probing" },
                    { v: "senior", label: "Adversarial" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setDifficulty(opt.v)}
                    className={cn(
                      "border-r border-border py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors last:border-r-0",
                      difficulty === opt.v
                        ? "bg-foreground text-background"
                        : "hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onStart(count, difficulty);
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 bg-proof py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-background transition-opacity hover:opacity-90"
            >
              Begin the interview
              <span className="font-display text-[14px] leading-none">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InterviewLaunchOverlay({
  progress,
  error,
  onCancel,
}: {
  progress: { current: number; total: number };
  error: string | null;
  onCancel: () => void;
}) {
  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md border-2 border-foreground bg-card shadow-[8px_8px_0_hsl(var(--foreground))] animate-scale-in">
        <div className="border-b border-foreground bg-foreground px-6 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-background">
          Panel · Convening
        </div>
        <div className="space-y-5 p-7">
          {error ? (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-proof">
                Press break
              </p>
              <h3 className="font-display text-[24px] leading-snug">
                The panel could not be seated.
              </h3>
              <p className="border-l-2 border-proof bg-proof/5 px-4 py-2.5 font-mono text-[12px] leading-relaxed text-proof">
                {error}
              </p>
              <button
                type="button"
                onClick={onCancel}
                className="w-full border border-foreground py-3 font-mono text-[11px] uppercase tracking-[0.16em] hover:bg-foreground hover:text-background"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-proof">
                Drafting questions
              </p>
              <h3 className="font-display text-[26px] leading-snug">
                The interviewer is reading your dossier.
              </h3>

              <div>
                <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span className="shimmer-text">
                    {progress.current === 0 ? "Studying résumé" : `Q${progress.current} drafted`}
                  </span>
                  <span className="tabular-nums">
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <div className="h-[3px] w-full bg-border">
                  <div
                    className="h-full bg-proof transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <p className="border-t border-dashed border-border pt-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
                通常 10–30 秒 · 第一题就绪后立即入场。
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
