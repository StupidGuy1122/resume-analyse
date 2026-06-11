import { Sparkles, Target, MessageSquare, Lock } from "lucide-react";

import ResumeUploader from "@/components/ResumeUploader";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col items-center px-6 py-16">
      <section className="flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          基于本地大模型 · 数据不出本机
        </span>

        <h1 className="mt-6 bg-gradient-to-br from-violet-700 via-violet-500 to-fuchsia-500 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
          让 AI 帮你打磨简历
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          上传你的简历，几秒钟得到一份**改进建议清单**和**可能被问到的面试题**。
          全程使用本地 Ollama 模型，隐私零外泄。
        </p>

        <div className="mt-12 w-full">
          <div className="flex justify-center">
            <ResumeUploader />
          </div>
        </div>
      </section>

      <section className="mt-24 grid w-full grid-cols-1 gap-6 md:grid-cols-3">
        <FeatureCard
          icon={<Target className="h-6 w-6" />}
          title="精准改进建议"
          desc="按优先级给出具体的措辞替换、量化数据建议，对齐 ATS 关键词。"
        />
        <FeatureCard
          icon={<MessageSquare className="h-6 w-6" />}
          title="面试题预测"
          desc="结合你的项目和履历，预生成行为题与技术追问，附答题提示。"
        />
        <FeatureCard
          icon={<Lock className="h-6 w-6" />}
          title="本地隐私优先"
          desc="后端通过 Ollama 调用本地模型，简历数据全程不离开你的机器。"
        />
      </section>

      <footer className="mt-24 text-xs text-muted-foreground">
        Powered by Next.js · FastAPI · Ollama · shadcn/ui
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card/60 p-6 backdrop-blur transition-all hover:border-primary/40 hover:shadow-lg">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}
