"use client";

import React, { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText, Upload, Download, Trash2, RefreshCw, CheckCircle2,
  AlertCircle, FileSignature, IdCard, Home, Award, ShieldCheck,
  Banknote, Receipt, BookOpen, FileQuestion,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmtBytes = (b: number | null | undefined): string => {
  if (b == null || b <= 0) return "—";
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1024 / 1024).toFixed(1)}MB`;
};
const fmtDate = (s: string | null | undefined): string => {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("en-CA", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return s; }
};

interface DocumentType {
  key: string;
  label: string;
  description: string;
  required: boolean;
}
interface LPDocument {
  lp_document_id: number;
  lp_id: number;
  document_type: string;
  display_name: string;
  description: string | null;
  filename: string;
  file_size: number;
  content_type: string | null;
  version: number;
  is_active: boolean;
  uploaded_at: string;
}

// Icon per type
const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  information_package: BookOpen,
  indication_of_interest: FileQuestion,
  photo_id_kyc: IdCard,
  proof_of_address: Home,
  accreditation_certificate: Award,
  aml_kyc_report: ShieldCheck,
  subscription_agreement: FileSignature,
  partnership_agreement: FileSignature,
  banking_information: Banknote,
  tax_form: Receipt,
};

interface Props {
  lpId: number;
  canEdit: boolean;
}

export function LPDocumentsTab({ lpId, canEdit }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  // Fetch the canonical type registry from the backend (single source of truth)
  const { data: typesResponse } = useQuery<{ types: DocumentType[] }>({
    queryKey: ["lp-document-types", lpId],
    queryFn: () => apiClient.get(`/api/investment/lp/${lpId}/documents/types`).then((r) => r.data),
  });

  const { data: documents, isLoading } = useQuery<LPDocument[]>({
    queryKey: ["lp-documents", lpId],
    queryFn: () => apiClient.get(`/api/investment/lp/${lpId}/documents`).then((r) => r.data || []),
    enabled: lpId > 0,
  });

  const types = typesResponse?.types || [];
  // Map document_type → most-recent active document
  const docByType = new Map<string, LPDocument>();
  (documents || []).forEach((d) => {
    docByType.set(d.document_type, d);
  });

  const uploadMutation = useMutation({
    mutationFn: ({ documentType, file }: { documentType: string; file: File }) => {
      const form = new FormData();
      form.append("document_type", documentType);
      form.append("file", file);
      return apiClient
        .post(`/api/investment/lp/${lpId}/documents`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data);
    },
    onSuccess: (_, vars) => {
      toast.success(`Uploaded ${vars.file.name}`);
      qc.invalidateQueries({ queryKey: ["lp-documents", lpId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Upload failed"),
    onSettled: () => setUploadingType(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => apiClient.delete(`/api/investment/lp-documents/${docId}`),
    onSuccess: () => {
      toast.success("Document removed");
      qc.invalidateQueries({ queryKey: ["lp-documents", lpId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Delete failed"),
  });

  const triggerUpload = (documentType: string) => {
    setUploadingType(documentType);
    // Use a hidden file input that we re-target per click
    if (fileInputRef.current) {
      fileInputRef.current.dataset.docType = documentType;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const docType = e.target.dataset.docType;
    if (file && docType) {
      uploadMutation.mutate({ documentType: docType, file });
    }
    // Reset the input so the same file can be re-selected later
    e.target.value = "";
  };

  const handleDownload = (doc: LPDocument) => {
    const url = `${apiClient.defaults.baseURL || ""}/api/investment/lp-documents/${doc.lp_document_id}/download`;
    window.open(url, "_blank");
  };

  const handleDelete = (doc: LPDocument) => {
    if (window.confirm(`Delete "${doc.display_name}" (${doc.filename})? This cannot be undone.`)) {
      deleteMutation.mutate(doc.lp_document_id);
    }
  };

  const totalUploaded = (documents || []).length;
  const totalRequired = types.filter((t) => t.required).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            LP Offering Documents
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Templates and reference documents for this LP offering. Uploaded once by GP/Admin and shared with all investors.
          </p>
        </div>
        <Badge variant="outline" className="text-[11px]">
          {totalUploaded} / {types.length} uploaded
          {totalRequired > 0 && <> &middot; {totalRequired} required</>}
        </Badge>
      </div>

      {/* Hidden file input shared by all upload buttons */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Document slot grid */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-6">Loading documents…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {types.map((type) => {
            const doc = docByType.get(type.key);
            const Icon = TYPE_ICONS[type.key] || FileText;
            const isUploaded = !!doc;
            const isLoading = uploadingType === type.key && uploadMutation.isPending;
            return (
              <Card
                key={type.key}
                className={cn(
                  "border-l-4 transition-shadow hover:shadow-sm",
                  isUploaded ? "border-l-green-500" : "border-l-slate-300",
                )}
              >
                <CardContent className="pt-3 pb-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded shrink-0",
                      isUploaded ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500",
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold truncate">{type.label}</p>
                        {type.required && (
                          <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                            REQUIRED
                          </Badge>
                        )}
                        {isUploaded && (
                          <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700 border-green-200 inline-flex items-center gap-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            v{doc.version}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {type.description}
                      </p>

                      {isUploaded && (
                        <div className="mt-2 text-[10px] text-muted-foreground space-y-0.5">
                          <p className="font-mono truncate">{doc.filename}</p>
                          <p>{fmtBytes(doc.file_size)} &middot; uploaded {fmtDate(doc.uploaded_at)}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {isUploaded ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] gap-1"
                              onClick={() => handleDownload(doc)}
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </Button>
                            {canEdit && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] gap-1"
                                  onClick={() => triggerUpload(type.key)}
                                  disabled={isLoading}
                                  title="Upload a new version"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Replace
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDelete(doc)}
                                  title="Delete document"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </>
                        ) : canEdit ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1 border-dashed"
                            onClick={() => triggerUpload(type.key)}
                            disabled={isLoading}
                          >
                            <Upload className="h-3 w-3" />
                            {isLoading ? "Uploading…" : "Upload"}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Not yet uploaded
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <Card className="bg-muted/30">
        <CardContent className="pt-3 pb-3 px-4">
          <p className="text-[11px] text-muted-foreground italic">
            These are <strong>LP-level template documents</strong> shared with all investors. Per-investor signed copies
            (e.g. signed Subscription Agreements, individual KYC files) are tracked separately on each investor's CRM
            record under <strong>Interest &amp; Docs</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
