"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { uploadResume } from "@/lib/api";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.docx,.txt,.md";

export default function ResumeUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setFilename(file.name);
      setUploading(true);
      setProgress(20);

      const tick = setInterval(() => {
        setProgress((p) => (p < 85 ? p + 5 : p));
      }, 120);

      try {
        const res = await uploadResume(file);
        clearInterval(tick);
        setProgress(100);
        setTimeout(() => router.push(`/analyze/${res.resume_id}`), 250);
      } catch (e) {
        clearInterval(tick);
        setUploading(false);
        setProgress(0);
        setError(e instanceof Error ? e.message : "上传失败");
      }
    },
    [router],
  );

  return (
    <div className="w-full">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={cn(
          "group relative block cursor-pointer overflow-hidden rounded-lg border border-foreground/30 bg-card transition-colors",
          "hover:border-foreground",
          dragging && "border-foreground bg-amber/10",
          uploading && "pointer-events-none",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          disabled={uploading}
        />

        {/* Tape strip */}
        <div className="flex items-center justify-between bg-foreground px-5 py-3 font-mono text-[13px] uppercase tracking-[0.16em] text-background">
          <span>Form INK-01 · Manuscript intake</span>
          <span className="opacity-70">PDF / DOCX / TXT / MD · ≤ 10MB</span>
        </div>

        {/* Body — pure drop area, dominant */}
        <div className="grid grid-cols-12">
          <div className="col-span-1 border-r border-border bg-background/40">
            <div className="flex h-full flex-col items-center justify-around py-8 font-mono text-[9.5px] text-muted-foreground/60">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i}>{String(i + 1).padStart(2, "0")}</span>
              ))}
            </div>
          </div>

          <div className="col-span-11 flex flex-col items-start gap-5 px-8 py-10">
            <div className="flex items-center gap-5">
              <span className="font-display text-[44px] font-light leading-none text-proof">
                {uploading ? (
                  <Loader2 className="h-9 w-9 animate-spin text-proof" />
                ) : (
                  "↘"
                )}
              </span>
              <div>
                <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
                  Drop file here
                </p>
                <h3 className="mt-1 font-display text-[30px] leading-[1.05] text-foreground">
                  {uploading
                    ? "Reading the page…"
                    : dragging
                      ? "Yes — let go."
                      : "Lay your manuscript on the desk."}
                </h3>
              </div>
            </div>

            <p className="max-w-[52ch] text-[13px] leading-relaxed text-muted-foreground">
              简历由本机 Ollama 编辑接管：解析结构 → 起草修改建议 → 拟定面试题。整套流程不上传到云端。
            </p>

            {filename && (
              <div className="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-[11.5px]">
                <span className="text-proof">▸</span>
                <span className="truncate">{filename}</span>
              </div>
            )}

            {uploading && (
              <div className="w-full max-w-md">
                <div className="mb-1.5 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span className="shimmer-text">Parsing</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-[2px] w-full bg-border">
                  <div
                    className="h-full bg-proof transition-[width] duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {!uploading && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="group/btn flex items-center gap-2.5 rounded-md border border-foreground bg-foreground px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-background transition-colors hover:bg-background hover:text-foreground"
              >
                Choose a file
                <span className="font-display text-[14px] leading-none transition-transform group-hover/btn:translate-x-0.5">
                  →
                </span>
              </button>
            )}
          </div>
        </div>
      </label>

      {error && (
        <p className="mt-3 animate-shake rounded-md border-l-2 border-proof bg-proof/[0.06] px-4 py-2.5 text-sm text-proof">
          {error}
        </p>
      )}
    </div>
  );
}
