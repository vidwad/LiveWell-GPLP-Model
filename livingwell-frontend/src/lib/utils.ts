import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatCurrency = (value: string | number, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(Number(value));

/** Compact currency for KPI cards: $1.2M, $650K, $4,500 */
export const formatCurrencyCompact = (value: string | number, currency = "CAD") => {
  const num = Number(value);
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 0)}K`;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(num);
};

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });

export const formatPercent = (decimal: string | number, precision = 2) =>
  `${(Number(decimal) * 100).toFixed(precision)}%`;

