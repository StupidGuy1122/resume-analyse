/**
 * Type-safe wrapper around the FastAPI backend.
 * The base URL is read from NEXT_PUBLIC_API_BASE_URL (set in .env.local).
 *
 * IMPORTANT: every request sets ``credentials: 'include'`` so the auth cookie
 * is forwarded on cross-origin calls (frontend on :3000 → backend on :8000).
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** Throw if status is 401 — caller's job is to redirect to /login. */
export class UnauthorizedError extends Error {
  constructor() { super("unauthorized"); }
}

async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, { credentials: "include", ...init });
  if (res.status === 401) throw new UnauthorizedError();
  return res;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type MeResponse = { authenticated: boolean; username: string | null };

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    let detail = "登录失败";
    try {
      const j = await res.json();
      if (j?.detail) detail = j.detail;
    } catch {}
    throw new Error(detail);
  }
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function getMe(): Promise<MeResponse> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    credentials: "include",
  });
  if (!res.ok) return { authenticated: false, username: null };
  return res.json();
}

// ---------------------------------------------------------------------------
// Resume upload + analysis types (existing /api/resume + /api/analysis)
// ---------------------------------------------------------------------------

export type ResumeUploadResponse = {
  resume_id: string;
  filename: string;
  char_count: number;
  preview: string;
};

export type SuggestionItem = {
  section: string;
  original: string;
  suggestion: string;
  reason: string;
  priority: "low" | "medium" | "high";
};

/** Question predicted by /api/analysis (NOT a live interview question). */
export type PredictedInterviewQuestion = {
  question: string;
  difficulty: "easy" | "medium" | "hard";
  related_section: string;
  hint: string;
};

export type SuggestionsResult = {
  resume_id: string;
  items: SuggestionItem[];
};

export type PredictedInterviewQuestionsResult = {
  resume_id: string;
  items: PredictedInterviewQuestion[];
};

export type AnalysisStreamEvent =
  | { stage: "extract:start" }
  | { stage: "extract:done" }
  | { stage: "suggestions:start" }
  | { stage: "suggestion:item"; data: SuggestionItem }
  | { stage: "suggestions:done"; data: SuggestionsResult }
  | { stage: "interview:start" }
  | { stage: "interview:item"; data: PredictedInterviewQuestion }
  | { stage: "interview:done"; data: PredictedInterviewQuestionsResult }
  | { stage: "all:done" }
  | { stage: "error"; message: string };

export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/resume/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Upload failed (${res.status}): ${detail}`);
  }
  return res.json();
}

/**
 * Generic NDJSON streamer. Reads one JSON object per line and invokes
 * onEvent. Used by both /full analysis and the interview session endpoints.
 */
async function streamNdjson<T>(
  url: string,
  init: RequestInit,
  onEvent: (e: T) => void,
): Promise<void> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok || !res.body) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        onEvent(JSON.parse(trimmed) as T);
      } catch {
        // ignore malformed line
      }
    }
  }
}

export async function streamFullAnalysis(
  resumeId: string,
  onEvent: (e: AnalysisStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamNdjson(
    `${API_BASE}/api/analysis/${resumeId}/full`,
    { method: "POST", signal },
    onEvent,
  );
}

// ---------------------------------------------------------------------------
// Mock interview session types (/api/interview-session)
// ---------------------------------------------------------------------------

export type Difficulty = "junior" | "mid" | "senior";

export type SessionStatus =
  | "generating"
  | "ready"
  | "in_progress"
  | "completed"
  | "evaluated";

export type LiveInterviewQuestion = {
  index: number;
  question: string;
  topic_summary: string;
  related_section: string;
  follow_ups: string[];
};

export type AnswerRecord = {
  question_index: number;
  user_answer: string;
  score: number | null;
  feedback: string | null;
  reference_answer: string | null;
};

export type CategoryScore = {
  category: string;
  score: number;
  question_count: number;
};

export type InterviewReport = {
  session_id: string;
  overall_score: number;
  overall_feedback: string;
  strengths: string[];
  improvements: string[];
  category_scores: CategoryScore[];
};

export type InterviewSession = {
  session_id: string;
  resume_id: string;
  difficulty: Difficulty;
  question_count: number;
  status: SessionStatus;
  questions: LiveInterviewQuestion[];
  answers: AnswerRecord[];
  current_index: number;
  report: InterviewReport | null;
};

// ---- /start streaming events ----

export type StartSessionEvent =
  | { event: "session:created"; data: InterviewSession }
  | { event: "question:item"; data: LiveInterviewQuestion }
  | { event: "questions:done"; data: InterviewSession }
  | { event: "error"; message: string };

export async function startInterviewSession(
  body: { resume_id: string; question_count: number; difficulty: Difficulty },
  onEvent: (e: StartSessionEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamNdjson(
    `${API_BASE}/api/interview-session/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    },
    onEvent,
  );
}

// ---- /answer streaming events ----

export type SubmitAnswerEvent =
  | { event: "eval:start" }
  | { event: "eval:done"; data: AnswerRecord }
  | { event: "next:question"; data: LiveInterviewQuestion | null }
  | { event: "session:complete" }
  | { event: "error"; message: string };

export async function submitAnswer(
  sessionId: string,
  body: { question_index: number; user_answer: string },
  onEvent: (e: SubmitAnswerEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamNdjson(
    `${API_BASE}/api/interview-session/${sessionId}/answer`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    },
    onEvent,
  );
}

// ---- /finish streaming events ----

export type FinishEvent =
  | { event: "report:overall"; data: { overall_score: number; overall_feedback: string } }
  | { event: "report:strength"; data: string }
  | { event: "report:improvement"; data: string }
  | { event: "report:category"; data: CategoryScore }
  | { event: "report:done"; data: InterviewReport }
  | { event: "error"; message: string };

export async function finishInterviewSession(
  sessionId: string,
  onEvent: (e: FinishEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamNdjson(
    `${API_BASE}/api/interview-session/${sessionId}/finish`,
    { method: "POST", signal },
    onEvent,
  );
}

export async function getInterviewSession(sessionId: string): Promise<InterviewSession> {
  const res = await fetch(`${API_BASE}/api/interview-session/${sessionId}`, {
    credentials: "include",
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteInterviewSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/interview-session/${sessionId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok && res.status !== 404) {
    throw new Error(`HTTP ${res.status}`);
  }
}
