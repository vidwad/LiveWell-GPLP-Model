"use client";

import { FileText, Download, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useInvestorDocuments, useMarkDocumentViewed, useDownloadDocument } from "@/hooks/useDocuments";
import type { Document } from "@/types/investor";

const TYPE_LABELS: Record<string, string> = {
  subscription_agreement: "Subscription Agreement",
  partnership_agreement: "Partnership Agreement",
  tax_form: "Tax Form",
  quarterly_report: "Quarterly Report",
  capital_call: "Capital Call",
  distribution_notice: "Distribution Notice",
  appraisal: "Appraisal",
  insurance: "Insurance",
  other: "Other",
};

interface Props {
  investorId: number;
}

export function DocumentList({ investorId }: Props) {
  const { data: docs, isLoading } = useInvestorDocuments(investorId);
  const markViewed = useMarkDocumentViewed();
  const download = useDownloadDocument();

  function handleDownload(doc: Document) {
    if (!doc.is_viewed) {
      markViewed.mutate(doc.document_id);
    }
    download.mutate({ documentId: doc.document_id, title: doc.title });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading documents…</p>
        ) : !docs || docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.document_id}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium truncate ${!doc.is_viewed ? "font-semibold" : ""}`}>
                      {doc.title}
                    </p>
                    {!doc.is_viewed && (
                      <Badge variant="default" className="text-xs shrink-0">New</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[doc.document_type] ?? doc.document_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.upload_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {doc.is_viewed && (
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={download.isPending}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
