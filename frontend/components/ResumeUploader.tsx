"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

      // Smooth fake progress while waiting on the server — small files upload instantly.
      const tick = setInterval(() => {
        setProgress((p) => (p < 85 ? p + 5 : p));
      }, 120);

      try {
        const res = await uploadResume(file);
        clearInterval(tick);
        setProgress(100);
        // Small delay so the user perceives the success state before navigation.
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
    <div className="w-full max-w-2xl">
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
          "group relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-card/60 p-12 text-center transition-all backdrop-blur",
          "hover:border-primary hover:bg-accent/50",
          dragging && "border-primary bg-accent/70 scale-[1.01]",
          uploading && "pointer-events-none opacity-75",
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

        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          {uploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <UploadCloud className="h-8 w-8" />}
        </div>

        <div>
          <p className="text-lg font-semibold">
            {uploading ? "正在解析…" : "拖拽简历到此处，或点击选择文件"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            支持 PDF、DOCX、TXT、MD · 最大 10 MB · 数据不会离开你的机器
          </p>
        </div>

        {filename && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="max-w-xs truncate">{filename}</span>
          </div>
        )}

        {uploading && (
          <div className="w-full max-w-md">
            <Progress value={progress} />
          </div>
        )}

        {!uploading && (
          <Button type="button" onClick={() => inputRef.current?.click()} className="mt-2">
            选择简历文件
          </Button>
        )}
      </label>

      {error && (
        <p className="mt-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
