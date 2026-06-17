"use client";

import ResumeUploader from "@/components/ResumeUploader";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { state } = useAuth();
  if (state.status !== "authed") return null;

  return (
    <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-8 lg:px-6">
      {/* Compact masthead — eyebrow + one short line, not a hero */}
      <header className="mb-8 flex items-baseline justify-between gap-6 border-b border-border pb-5">
        <div>
          <p className="font-mono text-[13px] uppercase tracking-[0.16em] text-proof">
            The Proof Room · Issue №{new Date().getFullYear()}
          </p>
          <h1 className="mt-2 font-display text-[34px] leading-tight tracking-tight text-foreground">
            Drop your résumé. The editor will be in shortly.
          </h1>
        </div>
        <dl className="hidden gap-6 font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground sm:flex">
          <div>
            <dt>Engine</dt>
            <dd className="mt-1 text-foreground">qwen2.5:7b</dd>
          </div>
          <div>
            <dt>Hosted</dt>
            <dd className="mt-1 text-foreground">localhost</dd>
          </div>
          <div>
            <dt>Cost</dt>
            <dd className="mt-1 text-foreground">$0</dd>
          </div>
        </dl>
      </header>

      {/* Drop-zone is the page's centre of gravity */}
      <section className="grid grid-cols-12 gap-12">
        <div className="col-span-12 lg:col-span-8">
          <ResumeUploader />
        </div>

        <aside className="col-span-12 lg:col-span-4 lg:pl-2">
          <p className="eyebrow">The desk routine</p>
          <ol className="mt-3 divide-y divide-border border-y border-border">
            {STEPS.map((s) => (
              <li key={s.n} className="grid grid-cols-[auto_1fr] gap-4 py-3.5">
                <span className="index-num text-[24px] leading-none">{s.n}</span>
                <div>
                  <h4 className="font-display text-[15px] leading-tight text-foreground">
                    {s.title}
                  </h4>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
                    {s.body}
                  </p>
                  <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/70">
                    {s.eta}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-5 border-l-2 border-proof pl-3 font-display text-[12.5px] italic leading-snug text-muted-foreground">
            "An honest line is worth twelve adjectives."
            <span className="ml-1.5 not-italic font-mono text-[9.5px] uppercase tracking-[0.2em]">
              — desk motto
            </span>
          </p>
        </aside>
      </section>
    </main>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Submit the page",
    body: "PDF / DOCX / TXT / MD · 留在本机，逐页解析为纯文本。",
    eta: "Approx. 2s",
  },
  {
    n: "02",
    title: "Mark it up",
    body: "AI 编辑通读全文，按优先级标出可改之处。",
    eta: "Approx. 10—20s",
  },
  {
    n: "03",
    title: "Sit for the panel",
    body: "面试官按履历预排问题，可一键进入多轮模拟面试。",
    eta: "Self-paced",
  },
];
