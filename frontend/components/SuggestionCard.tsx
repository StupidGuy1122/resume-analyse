import { ArrowRight, Lightbulb } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SuggestionItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const PRIORITY_LABEL: Record<SuggestionItem["priority"], { text: string; variant: "danger" | "warning" | "secondary" }> = {
  high: { text: "高优先级", variant: "danger" },
  medium: { text: "中优先级", variant: "warning" },
  low: { text: "低优先级", variant: "secondary" },
};

export default function SuggestionCard({ item }: { item: SuggestionItem }) {
  const meta = PRIORITY_LABEL[item.priority] ?? PRIORITY_LABEL.medium;
  return (
    <Card className="animate-fade-in transition-shadow hover:shadow-md">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={meta.variant}>{meta.text}</Badge>
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
            {item.section}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              原文
            </div>
            <p className="text-sm leading-relaxed text-foreground/80">{item.original}</p>
          </div>
          <div className="hidden items-center justify-center text-muted-foreground sm:flex">
            <ArrowRight className="h-5 w-5" />
          </div>
          <div className={cn("rounded-lg p-3", "bg-primary/10 ring-1 ring-primary/20")}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
              建议
            </div>
            <p className="text-sm font-medium leading-relaxed text-foreground">
              {item.suggestion}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <p>{item.reason}</p>
        </div>
      </CardContent>
    </Card>
  );
}
