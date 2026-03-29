import { cn } from "@/lib/utils";

interface StatBadgeProps {
  label: string;
  value: string | number;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const variants = {
  default: "bg-muted text-muted-foreground",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200/50",
  warning: "bg-amber-50 text-amber-700 ring-amber-200/50",
  danger: "bg-red-50 text-red-700 ring-red-200/50",
  info: "bg-blue-50 text-blue-700 ring-blue-200/50",
};

export function StatBadge({ label, value, variant = "default", className }: StatBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        variants[variant],
        className
      )}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
