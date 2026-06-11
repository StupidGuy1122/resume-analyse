"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, Loader2 } from "lucide-react";

import AnalysisSkeleton from "@/components/AnalysisSkeleton";
import InterviewQuestionList from "@/components/InterviewQuestionList";
import SuggestionCard from "@/components/SuggestionCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  API_BASE,
  type InterviewQuestionsResult,
  type SuggestionsResult,
  streamFullAnalysis,
} from "@/lib/api";

type Stage =
  | "idle"
  | "extract:start"
  | "extract:done"
  | "suggestions:done"
  | "interview:done"
  | "all:done"
  | "error";

const STAGE_TEXT: Record<Stage, string> = {
  idle: "准备中…",
  "extract:start": "正在解析简历结构…",
  "extract:done": "结构化完成，开始分析…",
  "suggestions:done": "改进建议已生成，正在预测面试题…",
  "interview:done": "面试题预测完成，整理结果…",
  "all:done": "全部完成",
  error: "出错了",
};

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const resumeId = params.id;

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resumeMeta, setResumeMeta] = useState<{ filename: string; charCount: number; preview: string } | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionsResult | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestionsResult | null>(null);

  // Fetch the resume meta & kick off streaming analysis once.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      try {
        const metaRes = await fetch(`${API_BASE}/api/resume/${resumeId}`);
        if (!metaRes.ok) throw new Error(`简历不存在或已过期 (HTTP ${metaRes.status})`);
        const meta = await metaRes.json();
        if (cancelled) return;
        setResumeMeta({
          filename: meta.filename,
          charCount: meta.char_count,
          preview: (meta.raw_text as string).slice(0, 600),
        });

        await streamFullAnalysis(
          resumeId,
          (e) => {
            if (cancelled) return;
            if (e.stage === "error") {
              setError(e.message);
              setStage("error");
              return;
            }
            setStage(e.stage as Stage);
            if (e.stage === "suggestions:done") setSuggestions(e.data);
            if (e.stage === "interview:done") setQuestions(e.data);
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回首页
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {inFlight ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : stage === "all:done" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : null}
          <span>{STAGE_TEXT[stage]}</span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                简历信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {resumeMeta ? (
                <>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      文件名
                    </div>
                    <p className="mt-1 truncate font-medium">{resumeMeta.filename}</p>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      字符数
                    </div>
                    <p className="mt-1 font-mono">{resumeMeta.charCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      预览
                    </div>
                    <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {resumeMeta.preview}
                      {resumeMeta.charCount > 600 && "…"}
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <section>
          <Tabs defaultValue="suggestions" className="w-full">
            <TabsList>
              <TabsTrigger value="suggestions">
                改进建议
                {suggestions && (
                  <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-mono text-primary">
                    {suggestions.items.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="interview">
                面试题预测
                {questions && (
                  <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-mono text-primary">
                    {questions.items.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="suggestions">
              {error ? (
                <ErrorState message={error} />
              ) : suggestions ? (
                <div className="space-y-4">
                  {suggestions.items.map((item, idx) => (
                    <SuggestionCard key={idx} item={item} />
                  ))}
                </div>
              ) : (
                <AnalysisSkeleton />
              )}
            </TabsContent>

            <TabsContent value="interview">
              {error ? (
                <ErrorState message={error} />
              ) : questions ? (
                <InterviewQuestionList items={questions.items} />
              ) : (
                <AnalysisSkeleton />
              )}
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </main>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <p className="font-medium text-destructive">分析失败</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        提示：确认 Ollama 服务已启动，并已 <code className="rounded bg-muted px-1">ollama pull qwen2.5:7b</code>。
      </p>
    </div>
  );
}
