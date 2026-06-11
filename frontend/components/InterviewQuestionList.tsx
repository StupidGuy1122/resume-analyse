import { HelpCircle, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { InterviewQuestion } from "@/lib/api";

const DIFFICULTY: Record<InterviewQuestion["difficulty"], { label: string; variant: "success" | "warning" | "danger" }> = {
  easy: { label: "简单", variant: "success" },
  medium: { label: "中等", variant: "warning" },
  hard: { label: "困难", variant: "danger" },
};

export default function InterviewQuestionList({
  items,
}: {
  items: InterviewQuestion[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">尚未生成面试题。</p>
    );
  }

  // Group by difficulty for better scanability.
  const grouped: Record<InterviewQuestion["difficulty"], InterviewQuestion[]> = {
    easy: [],
    medium: [],
    hard: [],
  };
  for (const q of items) grouped[q.difficulty]?.push(q);

  return (
    <div className="space-y-6">
      {(["easy", "medium", "hard"] as const).map((d) => {
        const list = grouped[d];
        if (!list?.length) return null;
        const meta = DIFFICULTY[d];
        return (
          <section key={d}>
            <div className="mb-3 flex items-center gap-2">
              <Badge variant={meta.variant}>{meta.label}</Badge>
              <span className="text-sm text-muted-foreground">
                共 {list.length} 道
              </span>
            </div>
            <div className="space-y-3">
              {list.map((q, i) => (
                <Card key={`${d}-${i}`} className="animate-fade-in">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <HelpCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                      <div className="flex-1 space-y-2">
                        <p className="font-medium leading-relaxed">{q.question}</p>
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {q.related_section}
                        </Badge>
                        {q.hint && (
                          <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                            <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <span>{q.hint}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
