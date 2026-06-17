"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import ProofreadingShowcase from "@/components/ProofreadingShowcase";

export default function LoginPage() {
  const { state, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === "loading" || state.status === "authed") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-foreground" />
      </main>
    );
  }

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left — proof room */}
      <section className="relative hidden border-r border-border lg:block">
        <ProofreadingShowcase />
      </section>

      {/* Right — sign-in counter */}
      <section className="relative flex flex-col">
        <header className="flex items-center justify-between px-10 py-6">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[22px] tracking-tight text-foreground">
              resume<span className="proof-mark">·</span>analyse
            </span>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Reception · Counter B
          </span>
        </header>

        <div className="flex flex-1 items-center justify-center px-10 pb-16">
          <div className="w-full max-w-sm">
            {/* Eyebrow + headline */}
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-proof">
              Submission desk
            </p>
            <h1 className="mt-3 font-display text-[44px] leading-[1.05] text-foreground">
              Hand it over.
              <span className="block italic text-muted-foreground">
                Then mind the red ink.
              </span>
            </h1>
            <p className="mt-5 max-w-[36ch] text-[14.5px] leading-relaxed text-muted-foreground">
              本机上的 AI 编辑会接过你的简历，逐句校对、画线、做侧批，
              并把可能的面试问题一并预排。数据不离开这台机器。
            </p>

            <div className="mt-10 hairline" />

            <form onSubmit={handleSubmit} className="mt-8 space-y-7">
              <Field
                index="01"
                label="Account"
                hint="入门的口令"
                input={
                  <input
                    type="text"
                    autoComplete="username"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={submitting}
                    placeholder="admin"
                    className="w-full bg-transparent py-2 font-display text-[20px] text-foreground outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
                  />
                }
              />

              <Field
                index="02"
                label="Passphrase"
                hint="保管好它"
                input={
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    placeholder="••••••••"
                    className="w-full bg-transparent py-2 font-display text-[20px] tracking-[0.2em] text-foreground outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
                  />
                }
              />

              {error && (
                <div className="animate-shake border-l-2 border-proof bg-proof/[0.06] px-4 py-2.5 text-sm text-proof">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="group h-12 w-full justify-between rounded-sm bg-foreground px-5 text-background hover:bg-foreground/90"
                disabled={submitting || !username || !password}
              >
                <span className="font-mono text-[12px] uppercase tracking-[0.22em]">
                  {submitting ? "Signing in" : "Enter the proof room"}
                </span>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="font-display text-[18px] leading-none">→</span>
                )}
              </Button>
            </form>

            <p className="mt-10 font-mono text-[11px] leading-relaxed text-muted-foreground">
              账号配置在{" "}
              <code className="bg-muted px-1.5 py-0.5 text-[11px]">backend/.env</code>
              {" · "}首次使用请改默认密码。
            </p>
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-border px-10 py-5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>Issue №01 · 2026</span>
          <span>Local Ollama · qwen2.5</span>
        </footer>
      </section>
    </main>
  );
}

function Field({
  index,
  label,
  hint,
  input,
}: {
  index: string;
  label: string;
  hint: string;
  input: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] tabular-nums text-proof">{index}</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </span>
        </span>
        <span className="font-display text-[12px] italic text-muted-foreground/70">
          {hint}
        </span>
      </div>
      <div className="border-b border-foreground/40 transition-colors focus-within:border-foreground">
        {input}
      </div>
    </label>
  );
}
