"use client";

import { Check, Circle, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveInterviewQuestion, AnswerRecord } from "@/lib/api";

type Props = {
  questions: LiveInterviewQuestion[];
  answers: AnswerRecord[];
  currentIndex: number;
  totalExpected: number;       // user-requested count
  generating: boolean;          // still receiving question:item events
  evaluating: boolean;          // currently running eval for a submission
  onJump?: (index: number) => void;
};

/**
 * Left rail: shows the spine of questions, their state (pending / answered /
 * current), and lets the user jump back to a previous answer to review it.
 *
 * State per row:
 *   - answered (has score) → green check + score badge
 *   - current              → ring outline + "正在作答"
 *   - generated, not yet current → grey circle
 *   - placeholder (still generating) → shimmer rectangle
 */
export default function QuestionSidebar({
  questions,
  answers,
  currentIndex,
  totalExpected,
  generating,
  evaluating,
  onJump,
}: Props) {
  const answeredMap = new Map(answers.map((a) => [a.question_index, a]));
  const placeholderCount = Math.max(0, totalExpected - questions.length);

  return (
    <aside className="flex h-full flex-col gap-1 rounded-2xl border bg-card/60 p-3 backdrop-blur">
      <div className="mb-2 flex items-center justify-between px-2 pt-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          题目列表
        </div>
        <div className="text-xs text-muted-foreground">
          {Math.min(currentIndex, totalExpected)} / {totalExpected}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {questions.map((q, i) => {
          const ans = answeredMap.get(q.index);
          const isCurrent = i === currentIndex;
          const isAnswered = ans?.score != null;

          return (
            <button
              key={q.index}
              type="button"
              disabled={!onJump}
              onClick={() => onJump?.(i)}
              className={cn(
                "group flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                "hover:bg-accent/50",
                isCurrent && "bg-accent ring-1 ring-primary/30",
                !isCurrent && isAnswered && "bg-emerald-50/50",
                !onJump && "cursor-default opacity-95",
              )}
            >
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                {isAnswered ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </div>
                ) : isCurrent && evaluating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : isCurrent ? (
                  <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs font-mono",
                    isCurrent ? "text-primary" : "text-muted-foreground",
                  )}>
                    Q{i + 1}
                  </span>
                  {isAnswered && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-emerald-700">
                      {ans!.score}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-foreground/80">
                  {q.topic_summary || q.question.slice(0, 30)}
                </p>
              </div>
            </button>
          );
        })}

        {/* Skeleton rows for not-yet-generated questions */}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <div
            key={`ph-${i}`}
            className="flex items-start gap-3 rounded-xl px-3 py-2.5"
          >
            <div className="mt-0.5 h-5 w-5 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-10 animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {generating && questions.length > 0 && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          <span>正在生成更多题目…</span>
        </div>
      )}
    </aside>
  );
}
