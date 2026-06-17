"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, FlagTriangleRight, Loader2, MessageSquare, Send, X } from "lucide-react";

import AnswerFeedback from "@/components/AnswerFeedback";
import InterviewReport from "@/components/InterviewReport";
import QuestionSidebar from "@/components/QuestionSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  type AnswerRecord,
  type CategoryScore,
  type InterviewReport as ReportT,
  type LiveInterviewQuestion,
  type SessionStatus,
  finishInterviewSession,
  getInterviewSession,
  submitAnswer,
} from "@/lib/api";

type FeedbackState = "idle" | "evaluating" | "done";

export default function InterviewSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  // ----- core state -----
  const [questions, setQuestions] = useState<LiveInterviewQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<SessionStatus>("ready");
  const [totalExpected, setTotalExpected] = useState(0);
  const [bootError, setBootError] = useState<string | null>(null);

  // ----- per-turn UI state -----
  const [draft, setDraft] = useState("");
  const [feedbackState, setFeedbackState] = useState<FeedbackState>("idle");
  const [latestAnswer, setLatestAnswer] = useState<AnswerRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);

  // ----- report state -----
  const [reportOverall, setReportOverall] = useState<{ score: number; feedback: string } | null>(null);
  const [reportStrengths, setReportStrengths] = useState<string[]>([]);
  const [reportImprovements, setReportImprovements] = useState<string[]>([]);
  const [reportCategories, setReportCategories] = useState<CategoryScore[]>([]);
  const [finalReport, setFinalReport] = useState<ReportT | null>(null);
  const [reportInFlight, setReportInFlight] = useState(false);

  const startedRef = useRef(false);

  // ---------------------------------------------------------------
  // Boot:
  //   1. Try sessionStorage (set by /analyze page right before navigation).
  //      → instant render, no API call needed.
  //   2. Fall back to GET /api/interview-session/{sid} for refresh / direct
  //      visit / handoff data missing.
  // ---------------------------------------------------------------
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let mounted = true;

    async function boot() {
      // (1) Optimistic sessionStorage read — usually present on fresh launch.
      try {
        const cached = sessionStorage.getItem(`interview:${sessionId}`);
        if (cached) {
          const { questions: qs } = JSON.parse(cached);
          if (Array.isArray(qs) && qs.length > 0 && mounted) {
            setQuestions(qs);
            setTotalExpected(qs.length);
            setStatus("ready");
            // Don't return — fall through to GET so we get authoritative
            // server state (esp. answers if session is being resumed).
          }
        }
      } catch {
        // sessionStorage disabled / quota — ignore, fall through to API
      }

      // (2) Pull authoritative session state from API.
      try {
        const s = await getInterviewSession(sessionId);
        if (!mounted) return;
        setQuestions(s.questions);
        setAnswers(s.answers);
        setCurrentIndex(s.current_index);
        setStatus(s.status);
        setTotalExpected(s.question_count);
        if (s.report) setFinalReport(s.report);
      } catch (e) {
        if (!mounted) return;
        setBootError(e instanceof Error ? e.message : String(e));
      }
    }

    boot();
    return () => { mounted = false; };
  }, [sessionId]);

  // ----- derived -----
  const currentQuestion = questions[currentIndex];
  const progressPct = totalExpected > 0 ? Math.round((answers.length / totalExpected) * 100) : 0;
  const evaluating = feedbackState === "evaluating";
  const canSubmit = !!currentQuestion && draft.trim().length > 0 && !evaluating && !reviewMode;
  const allAnswered = answers.length >= totalExpected || status === "completed" || status === "evaluated";

  useEffect(() => {
    const ans = answers.find((a) => a.question_index === currentIndex);
    if (ans) {
      setReviewMode(true);
      setLatestAnswer(ans);
      setFeedbackState("done");
      setDraft(ans.user_answer);
    } else {
      setReviewMode(false);
      setLatestAnswer(null);
      setFeedbackState("idle");
      setDraft("");
    }
  }, [currentIndex, answers]);

  // ---------------------------------------------------------------
  // Submit answer
  // ---------------------------------------------------------------
  const handleSubmit = async (giveUp = false) => {
    if (!currentQuestion) return;
    const userAnswer = giveUp ? "（跳过本题）" : draft.trim();
    if (!userAnswer) return;

    setFeedbackState("evaluating");
    setLatestAnswer(null);
    try {
      await submitAnswer(
        sessionId,
        { question_index: currentQuestion.index, user_answer: userAnswer },
        (e) => {
          switch (e.event) {
            case "eval:start":
              return;
            case "eval:done":
              setLatestAnswer(e.data);
              setAnswers((prev) => {
                const filtered = prev.filter((a) => a.question_index !== e.data.question_index);
                return [...filtered, e.data].sort((a, b) => a.question_index - b.question_index);
              });
              setFeedbackState("done");
              return;
            case "next:question":
              return;
            case "session:complete":
              setStatus("completed");
              return;
            case "error":
              setError(e.message);
              setFeedbackState("idle");
              return;
          }
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFeedbackState("idle");
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else if (allAnswered) {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    if (reportInFlight || finalReport) return;
    setReportInFlight(true);
    setReportOverall(null);
    setReportStrengths([]);
    setReportImprovements([]);
    setReportCategories([]);
    try {
      await finishInterviewSession(
        sessionId,
        (e) => {
          switch (e.event) {
            case "report:overall":
              setReportOverall({ score: e.data.overall_score, feedback: e.data.overall_feedback });
              return;
            case "report:strength":
              setReportStrengths((prev) => [...prev, e.data]);
              return;
            case "report:improvement":
              setReportImprovements((prev) => [...prev, e.data]);
              return;
            case "report:category":
              setReportCategories((prev) => [...prev, e.data]);
              return;
            case "report:done":
              setFinalReport(e.data);
              setStatus("evaluated");
              return;
            case "error":
              setError(e.message);
              return;
          }
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReportInFlight(false);
    }
  };

  // Boot error mode
  if (bootError) {
    return (
      <ReportLayout>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-lg font-semibold text-destructive">加载会话失败</p>
          <p className="mt-2 text-sm text-muted-foreground">{bootError}</p>
          <p className="mt-4 text-xs text-muted-foreground">
            可能的原因：会话不存在、已被删除，或服务重启后会话还没回放完成。
          </p>
          <div className="mt-5 flex justify-center">
            <Button asChild variant="outline">
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </div>
      </ReportLayout>
    );
  }

  // Report mode
  if (status === "evaluated" || finalReport || reportInFlight || reportOverall) {
    return (
      <ReportLayout>
        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
        <InterviewReport
          overallScore={reportOverall?.score ?? finalReport?.overall_score ?? null}
          overallFeedback={reportOverall?.feedback ?? finalReport?.overall_feedback ?? ""}
          strengths={reportStrengths}
          improvements={reportImprovements}
          categories={reportCategories}
          done={!!finalReport}
          finalReport={finalReport}
        />
      </ReportLayout>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <div className="sticky top-12 z-10 -mx-6 mb-6 border-b bg-background/80 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回首页
            </Link>
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                进度 {answers.length} / {totalExpected}
              </span>
              <div className="w-32">
                <Progress value={progressPct} className="h-1.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <QuestionSidebar
          questions={questions}
          answers={answers}
          currentIndex={currentIndex}
          totalExpected={totalExpected}
          generating={status === "generating"}
          evaluating={evaluating}
          onJump={(i) => setCurrentIndex(i)}
        />

        <section className="space-y-6">
          {!currentQuestion ? (
            <FirstQuestionLoading />
          ) : (
            <>
              <Card className="overflow-hidden border-2 border-primary/15 bg-gradient-to-br from-primary/5 via-card to-card animate-fade-in-up">
                <CardContent className="space-y-4 p-7">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="default" className="font-mono">
                      第 {currentIndex + 1} / {totalExpected} 题
                    </Badge>
                    {currentQuestion.related_section && (
                      <Badge variant="outline">{currentQuestion.related_section}</Badge>
                    )}
                    {currentQuestion.topic_summary && (
                      <span className="text-muted-foreground">· {currentQuestion.topic_summary}</span>
                    )}
                  </div>
                  <p className="text-lg font-medium leading-relaxed">
                    {currentQuestion.question}
                  </p>
                  {currentQuestion.follow_ups.length > 0 && reviewMode && (
                    <details className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        预设追问 ({currentQuestion.follow_ups.length})
                      </summary>
                      <ul className="mt-2 space-y-1 pl-4">
                        {currentQuestion.follow_ups.map((f, i) => (
                          <li key={i} className="list-disc text-foreground/75">{f}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </CardContent>
              </Card>

              <Card className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      你的回答
                    </div>
                    {reviewMode && (
                      <Badge variant="secondary" className="text-[10px]">
                        已作答 · 查看模式
                      </Badge>
                    )}
                  </div>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={evaluating || reviewMode}
                    placeholder="尽量详细地回答这道题，包含背景、技术决策、具体实现…"
                    rows={8}
                    className={cn(
                      "w-full resize-y rounded-xl border bg-background px-4 py-3 text-sm leading-relaxed transition-all",
                      "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60",
                      "disabled:cursor-not-allowed disabled:bg-muted/40",
                    )}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {!reviewMode && "提示：Ctrl/Cmd + Enter 提交"}
                    </span>
                    {!reviewMode ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={evaluating}
                          onClick={() => handleSubmit(true)}
                        >
                          <FlagTriangleRight className="mr-1 h-4 w-4" />
                          我答不上来
                        </Button>
                        <Button
                          size="sm"
                          disabled={!canSubmit}
                          onClick={() => handleSubmit(false)}
                        >
                          {evaluating ? (
                            <>
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              评估中
                            </>
                          ) : (
                            <>
                              <Send className="mr-1 h-4 w-4" />
                              提交答案
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={currentIndex + 1 >= questions.length && !allAnswered}
                        onClick={handleNext}
                      >
                        {currentIndex + 1 < questions.length ? "下一题" : "查看报告"}
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <AnswerFeedback state={feedbackState} answer={latestAnswer} />

              {feedbackState === "done" && !reviewMode && (
                <div className="flex justify-end animate-fade-in">
                  <Button onClick={handleNext} size="lg">
                    {currentIndex + 1 < questions.length ? "下一题" : "查看综合报告"}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}

              {allAnswered && !finalReport && !reportInFlight && (
                <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-indigo-500/5 animate-scale-in">
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <p className="font-semibold">所有题目已作答完毕</p>
                      <p className="text-sm text-muted-foreground">
                        点击右侧生成综合评估报告
                      </p>
                    </div>
                    <Button onClick={handleFinish} size="lg">
                      生成综合报告
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function FirstQuestionLoading() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div>
          <p className="font-medium">正在加载会话…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            如果长时间无响应，请刷新页面
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回首页
          </Link>
        </Button>
      </div>
      {children}
    </main>
  );
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 animate-fade-in">
      <div className="flex-1">
        <p className="font-medium text-destructive">出错了</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
