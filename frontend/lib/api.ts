/**
 * Type-safe wrapper around the FastAPI backend.
 * The base URL is read from NEXT_PUBLIC_API_BASE_URL (set in .env.local).
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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

export type InterviewQuestion = {
  question: string;
  difficulty: "easy" | "medium" | "hard";
  related_section: string;
  hint: string;
};

export type SuggestionsResult = {
  resume_id: string;
  items: SuggestionItem[];
};

export type InterviewQuestionsResult = {
  resume_id: string;
  items: InterviewQuestion[];
};

export type StreamEvent =
  | { stage: "extract:start" }
  | { stage: "extract:done" }
  | { stage: "suggestions:done"; data: SuggestionsResult }
  | { stage: "interview:done"; data: InterviewQuestionsResult }
  | { stage: "all:done" }
  | { stage: "error"; message: string };

export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/resume/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Upload failed (${res.status}): ${detail}`);
  }
  return res.json();
}

/**
 * Stream the full analysis as NDJSON, invoking onEvent for each parsed line.
 * Returns when the stream closes.
 */
export async function streamFullAnalysis(
  resumeId: string,
  onEvent: (e: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/analysis/${resumeId}/full`, {
    method: "POST",
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Analysis failed: HTTP ${res.status}`);
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
        onEvent(JSON.parse(trimmed) as StreamEvent);
      } catch {
        // Ignore malformed line — backend always emits valid JSON, but be safe.
      }
    }
  }
}
