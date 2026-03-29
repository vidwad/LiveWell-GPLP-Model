"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, badge, className, children }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between", className)}
    >
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {badge && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 mt-3 sm:mt-0">{children}</div>}
    </motion.div>
  );
}
