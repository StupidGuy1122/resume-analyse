import type { PredictedInterviewQuestion } from "@/lib/api";

const DIFFICULTY: Record<
  PredictedInterviewQuestion["difficulty"],
  { label: string; tone: string }
> = {
  easy: { label: "Warm-up", tone: "text-rule border-rule" },
  medium: { label: "On the record", tone: "text-amber border-amber" },
  hard: { label: "Defend it", tone: "text-proof border-proof" },
};

export default function InterviewQuestionList({
  items,
}: {
  items: PredictedInterviewQuestion[];
}) {
  if (items.length === 0) {
    return (
      <p className="px-5 py-10 text-center font-mono text-[12px] uppercase tracking-[0.22em] text-muted-foreground">
        No questions yet
      </p>
    );
  }

  const grouped: Record<
    PredictedInterviewQuestion["difficulty"],
    PredictedInterviewQuestion[]
  > = { easy: [], medium: [], hard: [] };
  for (const q of items) grouped[q.difficulty]?.push(q);

  return (
    <div>
      {(["easy", "medium", "hard"] as const).map((d) => {
        const list = grouped[d];
        if (!list?.length) return null;
        const meta = DIFFICULTY[d];
        return (
          <section key={d}>
            <header className="flex items-baseline justify-between border-b border-foreground/40 px-5 py-3">
              <span className={`border-l-2 pl-2 font-mono text-[10px] uppercase tracking-[0.22em] ${meta.tone}`}>
                {meta.label}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {String(list.length).padStart(2, "0")} q.
              </span>
            </header>
            <ol>
              {list.map((q, i) => (
                <li
                  key={`${d}-${i}`}
                  className="grid grid-cols-[auto_1fr] gap-5 border-b border-border px-5 py-5 last:border-b-0"
                >
                  <span className="pt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    Q{String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-display text-[18px] leading-snug text-foreground">
                      {q.question}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {q.related_section}
                    </p>
                    {q.hint && (
                      <p className="mt-3 border-l-2 border-rule/50 pl-3 font-mono text-[12px] leading-relaxed text-muted-foreground">
                        Hint · {q.hint}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
