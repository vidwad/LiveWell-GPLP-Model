"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useUploadDocument } from "@/hooks/useDocuments";

const DOCUMENT_TYPES = [
  { value: "subscription_agreement", label: "Subscription Agreement" },
  { value: "partnership_agreement", label: "Partnership Agreement" },
  { value: "tax_form", label: "Tax Form" },
  { value: "quarterly_report", label: "Quarterly Report" },
  { value: "capital_call", label: "Capital Call" },
  { value: "distribution_notice", label: "Distribution Notice" },
  { value: "appraisal", label: "Appraisal" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
];

interface Props {
  investorId: number;
  open: boolean;
  onClose: () => void;
}

export function UploadDocumentModal({ investorId, open, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("other");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument();

  if (!open) return null;

  function handleClose() {
    setTitle("");
    setDocType("other");
    setFile(null);
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please select a file."); return; }
    if (!title.trim()) { setError("Please enter a document title."); return; }

    const formData = new FormData();
    formData.append("investor_id", String(investorId));
    formData.append("title", title.trim());
    formData.append("document_type", docType);
    formData.append("file", file);

    upload.mutate(formData, {
      onSuccess: () => handleClose(),
      onError: (err: any) => {
        setError(err?.response?.data?.detail ?? "Upload failed. Please try again.");
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Upload Document</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 2024 K-1 Tax Form"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">File</label>
            <div
              className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-input p-6 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-6 w-6 text-muted-foreground mb-2" />
              {file ? (
                <p className="text-sm font-medium">{file.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Click to select a file (PDF, Word, Excel)</p>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md px-4 py-2 text-sm border border-input hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={upload.isPending}
              className="rounded-md px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {upload.isPending ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
