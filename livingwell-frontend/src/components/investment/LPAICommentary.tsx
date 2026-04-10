"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BrainCircuit,
  RefreshCw,
  ChevronRight,
  Loader2,
  Clock,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommentaryData {
  lp_id: number;
  commentary: string | null;
  model: string | null;
  generated_at: string | null;
}

interface Props {
  lpId: number;
  canEdit: boolean;
}

function fmtDate(s: string | null): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

/* Simple markdown-to-HTML: headers, bold, bullets, paragraphs */
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-bold mt-4 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-bold mt-5 mb-1.5">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm leading-relaxed">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="my-1.5">$&</ul>')
    .replace(/\n{2,}/g, '</p><p class="text-sm leading-relaxed mb-2">')
    .replace(/^(?!<[hul])(.+)$/gm, (match) => {
      if (match.startsWith("<")) return match;
      return match;
    });
}

export function LPAICommentary({ lpId, canEdit }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery<CommentaryData>({
    queryKey: ["lp-ai-commentary", lpId],
    queryFn: () =>
      apiClient
        .get(`/api/investment/lp/${lpId}/ai-commentary`)
        .then((r) => r.data),
    enabled: lpId > 0,
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      apiClient
        .post(`/api/investment/lp/${lpId}/ai-commentary`)
        .then((r) => r.data),
    onSuccess: () => {
      toast.success("Investment commentary generated");
      qc.invalidateQueries({ queryKey: ["lp-ai-commentary", lpId] });
      setExpanded(true);
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      toast.error(detail || "Failed to generate commentary", { duration: 8000 });
    },
  });

  const hasCommentary = !!data?.commentary;
  const isGenerating = generateMutation.isPending;

  return (
    <div className="rounded-lg border border-l-4 border-l-indigo-500 bg-card">
      {/* Collapsible header bar — always visible */}
      <button
        type="button"
        className="flex items-center justify-between gap-2 w-full px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />
          <BrainCircuit className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="text-sm font-semibold truncate">
            AI Investment Analyst Commentary
          </span>
          {data?.generated_at && (
            <Badge
              variant="outline"
              className="text-[10px] text-muted-foreground gap-1 hidden sm:inline-flex"
            >
              <Clock className="h-2.5 w-2.5" />
              {fmtDate(data.generated_at)}
            </Badge>
          )}
          {data?.model && (
            <Badge
              variant="outline"
              className="text-[10px] text-muted-foreground gap-1 hidden sm:inline-flex"
            >
              <Cpu className="h-2.5 w-2.5" />
              {data.model}
            </Badge>
          )}
          {!hasCommentary && !isGenerating && !isLoading && (
            <span className="text-[11px] text-muted-foreground italic">
              Not generated yet
            </span>
          )}
        </div>
        {/* Generate / Regenerate button — stop propagation so it doesn't toggle */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1"
              onClick={() => generateMutation.mutate()}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : hasCommentary ? (
                <RefreshCw className="h-3 w-3" />
              ) : (
                <BrainCircuit className="h-3 w-3" />
              )}
              {isGenerating
                ? "Analyzing…"
                : hasCommentary
                  ? "Regenerate"
                  : "Generate Analysis"}
            </Button>
          )}
        </div>
      </button>

      {/* Expandable content */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          {isGenerating && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                <div className="text-sm">
                  <p className="font-medium">Generating investment analysis…</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gathering fund data, portfolio cash flows, and property-level
                    returns. This typically takes 15-30 seconds.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isGenerating && hasCommentary && (
            <div className="px-4 pb-4 border-t border-border/50">
              {/* Mobile-only meta badges */}
              <div className="flex items-center gap-2 pt-3 pb-2 sm:hidden">
                {data?.generated_at && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {fmtDate(data.generated_at)}
                  </Badge>
                )}
                {data?.model && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
                    <Cpu className="h-2.5 w-2.5" />
                    {data.model}
                  </Badge>
                )}
              </div>
              <div
                className="prose prose-sm max-w-none text-sm leading-relaxed pt-3
                  prose-h2:text-base prose-h2:font-bold prose-h2:mt-5 prose-h2:mb-1.5
                  prose-h3:text-sm prose-h3:font-bold prose-h3:mt-4 prose-h3:mb-1
                  prose-h4:text-sm prose-h4:font-semibold prose-h4:mt-3 prose-h4:mb-1
                  prose-p:mb-2 prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1
                  prose-strong:text-foreground"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(data!.commentary!) }}
              />
            </div>
          )}

          {!isGenerating && !hasCommentary && !isLoading && (
            <div className="px-4 pb-4 border-t border-border/50">
              <div className="text-center py-6 text-muted-foreground">
                <BrainCircuit className="h-8 w-8 mx-auto mb-2 text-indigo-300" />
                <p className="text-sm">No investment commentary generated yet.</p>
                <p className="text-xs mt-1">
                  {canEdit
                    ? 'Click "Generate Analysis" to produce an expert review of this LP\'s projected performance.'
                    : "An admin can generate the AI investment analysis for this fund."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
