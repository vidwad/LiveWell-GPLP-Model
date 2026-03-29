"use client";

import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  className?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  accentColor?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  description,
  className,
  trend,
  trendValue,
  accentColor,
}: KpiCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-xl bg-card p-6 ring-1 ring-foreground/[0.06] shadow-card hover:shadow-card-hover transition-shadow duration-300",
        className
      )}
    >
      {/* Subtle gradient accent at top */}
      <div
        className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl"
        style={{
          background: accentColor
            ? `linear-gradient(90deg, ${accentColor}, ${accentColor}80)`
            : "linear-gradient(90deg, var(--primary), var(--brand-300))",
        }}
      />

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <div className="flex items-center gap-2">
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && trendValue && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  trend === "up" && "bg-emerald-50 text-emerald-600",
                  trend === "down" && "bg-red-50 text-red-600",
                  trend === "neutral" && "bg-gray-50 text-gray-600"
                )}
              >
                {trend === "up" && "↑"}
                {trend === "down" && "↓"}
                {trendValue}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-xl bg-primary/8 p-2.5 ring-1 ring-primary/10 group-hover:bg-primary/12 transition-colors duration-300">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </motion.div>
  );
}
