"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Search,
  Filter,
  AlertTriangle,
  FolderOpen,
  Shield,
  Building2,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { useProperties } from "@/hooks/usePortfolio";

const CATEGORY_LABELS: Record<string, string> = {
  appraisal: "Appraisal",
  insurance: "Insurance",
  title: "Title",
  survey: "Survey",
  environmental: "Environmental",
  permit: "Permit",
  inspection: "Inspection",
  purchase_agreement: "Purchase Agreement",
  lease: "Lease",
  construction_contract: "Construction Contract",
  mortgage: "Mortgage",
  tax_assessment: "Tax Assessment",
  photo: "Photo",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  appraisal: "bg-blue-100 text-blue-700",
  insurance: "bg-green-100 text-green-700",
  title: "bg-purple-100 text-purple-700",
  survey: "bg-amber-100 text-amber-700",
  environmental: "bg-teal-100 text-teal-700",
  permit: "bg-orange-100 text-orange-700",
  inspection: "bg-red-100 text-red-700",
  purchase_agreement: "bg-indigo-100 text-indigo-700",
  lease: "bg-cyan-100 text-cyan-700",
  construction_contract: "bg-yellow-100 text-yellow-700",
  mortgage: "bg-pink-100 text-pink-700",
  tax_assessment: "bg-slate-100 text-slate-700",
  photo: "bg-violet-100 text-violet-700",
  other: "bg-gray-100 text-gray-700",
};

interface PropertyDoc {
  document_id: number;
  source: string;
  property_id: number;
  address: string;
  title: string;
  category: string;
  file_url: string;
  file_size_bytes: number | null;
  expiry_date: string | null;
  notes: string | null;
  upload_date: string | null;
}

interface AllDocsResult {
  total_documents: number;
  by_category: Record<string, number>;
  expiring_within_90_days: number;
  documents: PropertyDoc[];
}

function useAllDocuments() {
  return useQuery<AllDocsResult>({
    queryKey: ["documents", "all"],
    queryFn: () => apiClient.get<AllDocsResult>("/api/documents/all").then((r) => r.data),
  });
}

function useUploadPropertyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, formData }: { propertyId: number; formData: FormData }) =>
      apiClient
        .post(`/api/documents/property/${propertyId}/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

function useDeletePropertyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: number) =>
      apiClient.delete(`/api/documents/property-doc/${documentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { data, isLoading } = useAllDocuments();
  const { data: properties } = useProperties();
  const uploadDoc = useUploadPropertyDocument();
  const deleteDoc = useDeletePropertyDocument();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterProperty, setFilterProperty] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    property_id: "",
    title: "",
    category: "other",
    expiry_date: "",
    notes: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const filteredDocs = useMemo(() => {
    if (!data?.documents) return [];
    return data.documents.filter((doc) => {
      if (filterCategory !== "all" && doc.category !== filterCategory) return false;
      if (filterProperty !== "all" && String(doc.property_id) !== filterProperty) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          doc.title.toLowerCase().includes(q) ||
          doc.address.toLowerCase().includes(q) ||
          (doc.notes || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, searchQuery, filterCategory, filterProperty]);

  function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !uploadForm.property_id) return;

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", uploadForm.title);
    formData.append("category", uploadForm.category);
    if (uploadForm.expiry_date) formData.append("expiry_date", uploadForm.expiry_date);
    if (uploadForm.notes) formData.append("notes", uploadForm.notes);

    uploadDoc.mutate(
      { propertyId: Number(uploadForm.property_id), formData },
      {
        onSuccess: () => {
          toast.success("Document uploaded");
          setUploadOpen(false);
          setUploadForm({ property_id: "", title: "", category: "other", expiry_date: "", notes: "" });
          setSelectedFile(null);
        },
        onError: () => toast.error("Upload failed"),
      }
    );
  }

  function handleDelete(docId: number) {
    if (!confirm("Delete this document?")) return;
    deleteDoc.mutate(docId, {
      onSuccess: () => toast.success("Document deleted"),
      onError: () => toast.error("Failed to delete"),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centralized document storage for all properties
          </p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          {/* @ts-expect-error radix-ui asChild type */}
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-1.5" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Property Document</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Property</Label>
                  <Select value={uploadForm.property_id} onValueChange={(v) => setUploadForm((f) => ({ ...f, property_id: v ?? "" }))}>
                    <SelectTrigger><SelectValue placeholder="Select property..." /></SelectTrigger>
                    <SelectContent>
                      {properties?.map((p) => (
                        <SelectItem key={p.property_id} value={String(p.property_id)}>
                          {p.address} — {p.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input value={uploadForm.title} onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Phase I ESA Report" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={uploadForm.category} onValueChange={(v) => setUploadForm((f) => ({ ...f, category: v ?? "" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expiry Date (optional)</Label>
                  <Input type="date" value={uploadForm.expiry_date} onChange={(e) => setUploadForm((f) => ({ ...f, expiry_date: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Input value={uploadForm.notes} onChange={(e) => setUploadForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">File</Label>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={uploadDoc.isPending || !selectedFile} className="w-full">
                {uploadDoc.isPending ? "Uploading..." : "Upload"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Total Documents</p>
            <p className="text-xl font-bold">{data?.total_documents ?? 0}</p>
            <p className="text-xs text-muted-foreground">Across portfolio</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Categories</p>
            <p className="text-xl font-bold">{Object.keys(data?.by_category ?? {}).length}</p>
            <p className="text-xs text-muted-foreground">Document types</p>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", (data?.expiring_within_90_days ?? 0) > 0 ? "border-l-amber-500" : "border-l-green-500")}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Expiring Soon</p>
            <p className={cn("text-xl font-bold", (data?.expiring_within_90_days ?? 0) > 0 ? "text-amber-700" : "text-green-700")}>
              {data?.expiring_within_90_days ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Within 90 days</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Properties</p>
            <p className="text-xl font-bold">
              {new Set((data?.documents ?? []).map((d) => d.property_id)).size}
            </p>
            <p className="text-xs text-muted-foreground">With documents</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Chips */}
      {data?.by_category && Object.keys(data.by_category).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.by_category)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border",
                  filterCategory === cat
                    ? "ring-2 ring-offset-1 ring-blue-400"
                    : "",
                  CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-700"
                )}
              >
                {CATEGORY_LABELS[cat] ?? cat}
                <span className="bg-white/50 rounded-full px-1.5 text-[10px]">{count}</span>
              </button>
            ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {properties && properties.length > 1 && (
          <Select value={filterProperty} onValueChange={(v) => setFilterProperty(v ?? "")}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.property_id} value={String(p.property_id)}>
                  {p.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Documents Table */}
      <Card>
        <CardContent className="pt-4">
          {filteredDocs.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {data?.total_documents === 0
                  ? "No documents uploaded yet."
                  : "No documents match your filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Title</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map((doc) => {
                    const isExpiringSoon =
                      doc.expiry_date &&
                      new Date(doc.expiry_date) <= new Date(Date.now() + 90 * 24 * 3600 * 1000);

                    return (
                      <TableRow key={doc.document_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="font-medium text-sm">{doc.title}</p>
                              {doc.notes && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.notes}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{doc.address}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", CATEGORY_COLORS[doc.category])}>
                            {CATEGORY_LABELS[doc.category] ?? doc.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground tabular-nums">
                          {formatFileSize(doc.file_size_bytes)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>
                          {doc.expiry_date ? (
                            <span className={cn("text-sm", isExpiringSoon ? "text-amber-600 font-medium" : "text-muted-foreground")}>
                              {isExpiringSoon && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                              {doc.expiry_date}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                window.open(`/api/documents/property-doc/${doc.document_id}/download`, "_blank");
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => handleDelete(doc.document_id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
