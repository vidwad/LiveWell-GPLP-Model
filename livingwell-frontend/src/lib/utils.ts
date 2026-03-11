import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatCurrency = (value: string | number, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(Number(value));

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });

export const formatPercent = (decimal: string | number, precision = 2) =>
  `${(Number(decimal) * 100).toFixed(precision)}%`;

