"use client";

import React, { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import {
  Link2, Upload, Sparkles, Loader2, CheckCircle2, FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PropertyImporterProps {
  onImport: (data: Record<string, any>) => void;
  compact?: boolean;  // For embedding in wizard
}

/**
 * Shared component for importing property data from:
 * 1. Listing URL (Realtor.ca, Zillow, etc.) via AI web search
 * 2. PDF upload (MLS listing, appraisal) via AI extraction
 */
export function PropertyImporter({ onImport, compact = false }: PropertyImporterProps) {
  const [listingUrl, setListingUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const urlMutation = useMutation({
    mutationFn: (url: string) =>
      apiClient.post("/api/portfolio/extract-listing", { url }).then(r => r.data),
    onSuccess: (data) => {
      onImport({ ...data, _source: "url", _source_url: listingUrl });
      const fieldCount = Object.keys(data).filter(k => data[k] != null && !k.startsWith("_")).length;
      toast.success(`Imported ${fieldCount} fields from listing URL`);
    },
    onError: () => toast.error("Failed to extract listing. Check URL and try again."),
  });

  const pdfMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiClient.post("/api/portfolio/extract-pdf", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then(r => r.data);
    },
    onSuccess: (data) => {
      onImport({ ...data, _source: "pdf" });
      const fieldCount = Object.keys(data).filter(k => data[k] != null && !k.startsWith("_")).length;
      toast.success(`Extracted ${fieldCount} fields from PDF`);
    },
    onError: () => toast.error("Failed to extract PDF. Try a clearer document."),
  });

  const isPending = urlMutation.isPending || pdfMutation.isPending;
  const isSuccess = urlMutation.isSuccess || pdfMutation.isSuccess;

  return (
    <Card className={cn("border-2 border-dashed", isSuccess ? "border-green-300 bg-green-50/30" : "border-primary/30 bg-primary/5")}>
      <CardContent className={compact ? "py-3 px-4" : "py-4 px-5"}>
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Import Property Data
            <span className="text-[10px] text-muted-foreground font-normal ml-1">
              Auto-fill 30+ fields using AI
            </span>
          </div>

          {/* Two column layout on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
            {/* PDF Upload Box */}
            <div className="rounded-lg border bg-background p-3 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Upload PDF
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) pdfMutation.mutate(file);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isPending}
                onClick={() => fileRef.current?.click()}
              >
                {pdfMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Extracting...</>
                ) : (
                  <>Choose PDF File</>
                )}
              </Button>
              <p className="text-[10px] text-muted-foreground leading-tight">
                MLS listing, Realtor.ca export, or appraisal report
              </p>
            </div>

            {/* OR divider */}
            <span className="hidden md:flex text-[10px] font-semibold text-muted-foreground uppercase">OR</span>

            {/* URL Import Box */}
            <div className="rounded-lg border bg-background p-3 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                Listing URL
              </p>
              <div className="flex gap-1.5">
                <Input
                  value={listingUrl}
                  onChange={e => setListingUrl(e.target.value)}
                  placeholder="https://www.realtor.ca/..."
                  className="text-sm h-9"
                  disabled={isPending}
                />
                <Button
                  size="sm"
                  className="h-9 shrink-0"
                  disabled={!listingUrl.trim() || isPending}
                  onClick={() => urlMutation.mutate(listingUrl.trim())}
                >
                  {urlMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Fetch</>
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Realtor.ca, Zillow, or any property listing page
              </p>
            </div>
          </div>

          {/* Success indicator */}
          {isSuccess && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Data imported — review and edit fields below
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
