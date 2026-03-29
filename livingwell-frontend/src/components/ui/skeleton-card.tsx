import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className, lines = 3 }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-card p-6 ring-1 ring-foreground/[0.06] shadow-card animate-pulse",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <div className="h-3 w-24 rounded-md bg-muted" />
          <div className="h-7 w-16 rounded-md bg-muted" />
          {Array.from({ length: lines - 2 }).map((_, i) => (
            <div key={i} className="h-2.5 w-32 rounded-md bg-muted" />
          ))}
        </div>
        <div className="h-10 w-10 rounded-xl bg-muted" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/[0.06] shadow-card overflow-hidden animate-pulse">
      <div className="border-b border-border p-4">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-3 flex-1 rounded-md bg-muted" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b border-border/50 p-4">
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="h-3 flex-1 rounded-md bg-muted/60" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
