import type { SuggestionItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const PRIORITY_LABEL: Record<
  SuggestionItem["priority"],
  { text: string; mark: string; tone: string }
> = {
  high: { text: "Heavy edit", mark: "✎", tone: "text-proof border-proof" },
  medium: { text: "Polish", mark: "✓", tone: "text-rule border-rule" },
  low: { text: "Tidy", mark: "·", tone: "text-muted-foreground border-border" },
};

export default function SuggestionCard({
  item,
  index,
  active,
  onHover,
  onLeave,
}: {
  item: SuggestionItem;
  index: number;
  active?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
}) {
  const meta = PRIORITY_LABEL[item.priority] ?? PRIORITY_LABEL.medium;
  return (
    <article
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={cn(
        "group relative grid grid-cols-[auto_1fr] gap-5 border-l-2 px-5 py-5 transition-colors",
        active ? "border-proof bg-amber/10" : "border-transparent hover:border-foreground/30",
      )}
    >
      {/* Index */}
      <div className="flex flex-col items-end pt-1 leading-none">
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className={cn("mt-2 font-display text-[20px]", meta.tone.split(" ")[0])}>
          {meta.mark}
        </span>
      </div>

      <div className="min-w-0">
        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "border-l-2 pl-2 font-mono text-[10px] uppercase tracking-[0.22em]",
              meta.tone,
            )}
          >
            {meta.text}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {item.section}
          </span>
        </div>

        {/* Original — struck through */}
        <p className="mt-3 font-display text-[15px] leading-snug text-muted-foreground/80">
          <span className="line-through decoration-proof/70 decoration-1 underline-offset-[3px]">
            {item.original}
          </span>
        </p>

        {/* Suggestion */}
        <p className="mt-2 font-display text-[17px] leading-snug text-foreground">
          {item.suggestion}
        </p>

        {/* Reason — like a margin note */}
        <p className="mt-3 border-t border-dashed border-border pt-3 font-mono text-[12px] leading-relaxed text-muted-foreground">
          <span className="text-proof">▸ </span>
          {item.reason}
        </p>
      </div>
    </article>
  );
}
