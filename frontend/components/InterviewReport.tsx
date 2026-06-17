"use client";

import { Award, ThumbsUp, Target, BarChart3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CategoryScore, InterviewReport as ReportT } from "@/lib/api";

type Props = {
  // Report fragments arrive incrementally — any field can be partial / empty.
  overallScore: number | null;
  overallFeedback: string;
  strengths: string[];
  improvements: string[];
  categories: CategoryScore[];
  done: boolean;
  finalReport: ReportT | null;     // present when done === true
};

/**
 * Final report view. Renders progressively as report:* events arrive.
 * Three sections: 总分 / 类别雷达 / 优势-改进 双栏。
 */
export default function InterviewReport({
  overallScore,
  overallFeedback,
  strengths,
  improvements,
  categories,
  done,
  finalReport,
}: Props) {
  const score = (finalReport?.overall_score ?? overallScore) ?? null;

  return (
    <div className="space-y-6">
      {/* Overall hero card */}
      <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <div className="absolute right-0 top-0 h-32 w-32 -translate-y-12 translate-x-12 rounded-full bg-primary/10 blur-3xl" />
        <CardContent className="relative p-8">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Award className="h-4 w-4 text-primary" />
            综合评估报告
          </div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "font-mono text-7xl font-extrabold leading-none tabular-nums",
                  score == null ? "text-muted-foreground/40"
                    : score >= 85 ? "text-emerald-600"
                    : score >= 70 ? "text-blue-600"
                    : score >= 50 ? "text-amber-600"
                    : "text-red-600",
                )}>
                  {score ?? "—"}
                </span>
                <span className="text-2xl text-muted-foreground">/ 100</span>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground/80">
                {finalReport?.overall_feedback ?? overallFeedback ?? ""}
                {!done && (
                  <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-primary" />
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      {(finalReport?.category_scores ?? categories).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              分类得分
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(finalReport?.category_scores ?? categories).map((c, i) => (
              <CategoryRow key={`${c.category}-${i}`} score={c} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Strengths + Improvements (two columns) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-emerald-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-emerald-700">
              <ThumbsUp className="h-4 w-4" />
              你的优势
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList
              items={(finalReport?.strengths ?? strengths)}
              empty="正在分析…"
              done={done}
              kind="strength"
            />
          </CardContent>
        </Card>

        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-700">
              <Target className="h-4 w-4" />
              改进建议
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList
              items={(finalReport?.improvements ?? improvements)}
              empty="正在分析…"
              done={done}
              kind="improvement"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CategoryRow({ score }: { score: CategoryScore }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">{score.category}</span>
          <span className="text-xs text-muted-foreground">({score.question_count} 题)</span>
        </div>
        <span className="font-mono text-sm font-semibold">{score.score}</span>
      </div>
      <Progress value={score.score} className="h-1.5" />
    </div>
  );
}

function BulletList({
  items,
  empty,
  done,
  kind,
}: {
  items: string[];
  empty: string;
  done: boolean;
  kind: "strength" | "improvement";
}) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {empty}
      </p>
    );
  }
  const dotClass = kind === "strength" ? "bg-emerald-500" : "bg-amber-500";
  return (
    <ul className="space-y-2">
      {items.map((s, i) => (
        <li key={i} className="flex items-start gap-2 text-sm leading-relaxed animate-fade-in">
          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
          <span>{s}</span>
        </li>
      ))}
      {!done && (
        <li className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          继续分析中…
        </li>
      )}
    </ul>
  );
}
