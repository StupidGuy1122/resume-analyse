"use client";

import { useEffect, useState } from "react";
import { Award, BookOpen, MessageSquareText, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { AnswerRecord } from "@/lib/api";

type Props = {
  state: "idle" | "evaluating" | "done";
  answer: AnswerRecord | null;   // populated when state === "done"
};

/**
 * Shown directly below the answer textarea after the user submits.
 * State machine:
 *   idle       → not rendered
 *   evaluating → shimmer "评估中…" card
 *   done       → animated score + feedback + collapsible reference answer
 */
export default function AnswerFeedback({ state, answer }: Props) {
  if (state === "idle") return null;

  if (state === "evaluating") {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 p-5">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium">AI 正在评估你的回答…</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              通常 5-15 秒，请稍候
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!answer) return null;
  return <DoneFeedback answer={answer} />;
}

function DoneFeedback({ answer }: { answer: AnswerRecord }) {
  const score = answer.score ?? 0;
  const tone = scoreTone(score);

  return (
    <Card className={cn("animate-fade-in border-2", tone.borderClass)}>
      <CardContent className="space-y-4 p-5">
        {/* Score + grade */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className={cn("h-6 w-6", tone.iconClass)} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                得分
              </p>
              <div className="flex items-baseline gap-2">
                <AnimatedScore target={score} className={tone.numberClass} />
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
            </div>
          </div>
          <div className={cn("rounded-full px-3 py-1 text-xs font-bold", tone.badgeClass)}>
            {tone.label}
          </div>
        </div>

        {/* Feedback */}
        {answer.feedback && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <MessageSquareText className="h-3.5 w-3.5" />
              反馈
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">
              {answer.feedback}
            </p>
          </div>
        )}

        {/* Reference answer (collapsible) */}
        {answer.reference_answer && (
          <ReferenceAnswerToggle text={answer.reference_answer} />
        )}
      </CardContent>
    </Card>
  );
}

function ReferenceAnswerToggle({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-muted/50"
      >
        <span className="flex items-center gap-2 font-medium">
          <BookOpen className="h-4 w-4 text-primary" />
          参考答案
        </span>
        <span className="text-xs text-muted-foreground">
          {open ? "收起" : "展开"}
        </span>
      </button>
      {open && (
        <div className="border-t px-4 py-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
            {text}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Number that counts up from 0 to target over ~700 ms.
 * Pure CSS-free implementation so it works without animation libs.
 */
function AnimatedScore({ target, className }: { target: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 700;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <span className={cn("font-mono text-3xl font-bold tabular-nums", className)}>{n}</span>;
}

function scoreTone(score: number) {
  if (score >= 85) return {
    label: "优秀",
    borderClass: "border-emerald-300/70",
    numberClass: "text-emerald-600",
    iconClass: "text-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-700",
  };
  if (score >= 70) return {
    label: "良好",
    borderClass: "border-blue-300/70",
    numberClass: "text-blue-600",
    iconClass: "text-blue-500",
    badgeClass: "bg-blue-100 text-blue-700",
  };
  if (score >= 50) return {
    label: "及格",
    borderClass: "border-amber-300/70",
    numberClass: "text-amber-600",
    iconClass: "text-amber-500",
    badgeClass: "bg-amber-100 text-amber-700",
  };
  return {
    label: "待改进",
    borderClass: "border-red-300/70",
    numberClass: "text-red-600",
    iconClass: "text-red-500",
    badgeClass: "bg-red-100 text-red-700",
  };
}

// keep import linter happy
const _icon = Sparkles;
void _icon;
