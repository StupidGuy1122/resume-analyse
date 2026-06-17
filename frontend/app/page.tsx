"use client";

import ResumeUploader from "@/components/ResumeUploader";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { state } = useAuth();
  if (state.status !== "authed") return null;

  return (
    <main className="mx-auto max-w-[1280px] px-10 pb-24 pt-12">
      {/* Masthead */}
      <header className="mb-14 grid grid-cols-12 items-end gap-6 border-b border-foreground pb-6">
        <div className="col-span-12 lg:col-span-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-proof">
            The Proof Room · Issue №{new Date().getFullYear()}
          </p>
          <h1 className="mt-3 font-display text-[64px] leading-[0.95] tracking-tight text-foreground sm:text-[88px]">
            Manuscripts,{" "}
            <span className="italic text-muted-foreground">marked up</span> in
            <br />
            the time it takes to <span className="proof-mark">pour tea.</span>
          </h1>
        </div>
        <div className="col-span-12 lg:col-span-4 lg:border-l lg:border-foreground/40 lg:pl-6">
          <p className="text-[14.5px] leading-relaxed text-muted-foreground">
            上传一份简历，本机的 AI 编辑会逐句校对、量化建议、并预排可能的面试问答。
            红蓝铅笔、你的纸张，全程留在这台机器。
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-border pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
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
        </div>
      </header>

      {/* The intake form is the page's primary hero — drop-zone gets full attention */}
      <section className="grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-8">
          <ResumeUploader />
        </div>

        {/* Right rail — the three-step process. Numbered because it IS a sequence. */}
        <aside className="col-span-12 lg:col-span-4">
          <p className="eyebrow">The desk routine</p>
          <ol className="mt-4 divide-y divide-border border-y border-border">
            {STEPS.map((s) => (
              <li key={s.n} className="grid grid-cols-[auto_1fr] gap-5 py-5">
                <span className="index-num text-[40px] leading-none">{s.n}</span>
                <div>
                  <h4 className="font-display text-[19px] leading-tight text-foreground">
                    {s.title}
                  </h4>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                    {s.eta}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-8 border-l-2 border-proof pl-4 font-display text-[15px] italic leading-relaxed text-muted-foreground">
            "An honest line is worth twelve adjectives."
            <span className="ml-2 not-italic font-mono text-[11px] uppercase tracking-[0.2em]">
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
    body:
      "拖拽或选择 PDF / DOCX / TXT / MD。文件留在本机，逐页解析为纯文本。",
    eta: "Approx. 2s",
  },
  {
    n: "02",
    title: "Mark it up",
    body:
      "AI 编辑通读全文，按优先级标出可改之处，给出措辞替换与量化建议。",
    eta: "Approx. 10—20s",
  },
  {
    n: "03",
    title: "Sit for the panel",
    body:
      "面试官按履历预排问题，可一键进入多轮模拟面试，结束后获得评估报告。",
    eta: "Self-paced",
  },
];
