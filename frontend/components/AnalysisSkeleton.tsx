export default function AnalysisSkeleton() {
  return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[auto_1fr] gap-5 border-b border-border px-5 py-6"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="space-y-2">
            <div className="h-3 w-6 animate-pulse bg-muted" />
            <div className="h-5 w-3 animate-pulse bg-muted" />
          </div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="h-3 w-20 animate-pulse bg-muted" />
              <div className="h-3 w-24 animate-pulse bg-muted" />
            </div>
            <div className="h-4 w-3/4 animate-pulse bg-muted" />
            <div className="h-4 w-2/3 animate-pulse bg-muted" />
            <div className="h-3 w-1/2 animate-pulse bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
