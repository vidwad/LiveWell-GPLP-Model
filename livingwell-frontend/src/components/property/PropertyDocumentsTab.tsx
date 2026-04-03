"use client";

import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documents } from "@/lib/api";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Plus,
  AlertTriangle,
  Shield,
  FileCheck,
  Search,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Category metadata ──────────────────────────────────────────────────

const CATEGORIES = [
  { value: "appraisal", label: "Appraisal", icon: "📊", color: "bg-blue-100 text-blue-800" },
  { value: "insurance", label: "Insurance", icon: "🛡️", color: "bg-green-100 text-green-800" },
  { value: "title", label: "Title", icon: "📜", color: "bg-purple-100 text-purple-800" },
  { value: "survey", label: "Survey", icon: "📐", color: "bg-indigo-100 text-indigo-800" },
  { value: "environmental", label: "Environmental", icon: "🌿", color: "bg-emerald-100 text-emerald-800" },
  { value: "permit", label: "Permit", icon: "📋", color: "bg-amber-100 text-amber-800" },
  { value: "inspection", label: "Inspection", icon: "🔍", color: "bg-orange-100 text-orange-800" },
  { value: "purchase_agreement", label: "Purchase Agreement", icon: "🤝", color: "bg-cyan-100 text-cyan-800" },
  { value: "lease", label: "Lease", icon: "📄", color: "bg-teal-100 text-teal-800" },
  { value: "construction_contract", label: "Construction Contract", icon: "🏗️", color: "bg-yellow-100 text-yellow-800" },
  { value: "mortgage", label: "Mortgage", icon: "🏦", color: "bg-rose-100 text-rose-800" },
  { value: "tax_assessment", label: "Tax Assessment", icon: "💰", color: "bg-red-100 text-red-800" },
  { value: "photo", label: "Photo", icon: "📷", color: "bg-pink-100 text-pink-800" },
  { value: "other", label: "Other", icon: "📁", color: "bg-gray-100 text-gray-800" },
] as const;

function getCategoryMeta(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isExpiringSoon(expiryDate: string | null | undefined): boolean {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  return expiry <= ninetyDays && expiry >= now;
}

function isExpired(expiryDate: string | null | undefined): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

// ── Types ──────────────────────────────────────────────────────────────

interface PropertyDoc {
  document_id: number;
  property_id: number;
  title: string;
  category: string;
  file_url: string;
  file_size_bytes: number | null;
  expiry_date: string | null;
  notes: string | null;
  uploaded_by?: number | null;
  upload_date: string | null;
  ai_extraction?: Record<string, unknown> | null;
}

interface Props {
  propertyId: number;
  canEdit: boolean;
}

export function PropertyDocumentsTab({ propertyId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── State ──
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadForm, setUploadForm] = useState({
    title: "",
    category: "other",
    expiry_date: "",
    notes: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ── Queries ──
  const { data: allDocs, isLoading } = useQuery<PropertyDoc[]>({
    queryKey: ["property-documents", propertyId],
    queryFn: () => documents.listByProperty(propertyId),
  });

  // ── Mutations ──
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", uploadForm.title || selectedFile.name);
      formData.append("category", uploadForm.category);
      if (uploadForm.expiry_date) formData.append("expiry_date", uploadForm.expiry_date);
      if (uploadForm.notes) formData.append("notes", uploadForm.notes);
      return documents.uploadPropertyDocument(propertyId, formData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["property-documents", propertyId] });
      toast.success("Document uploaded successfully");
      if (data?.ai_extraction) {
        toast.info("AI extracted data from this document and updated property fields.");
      }
      setUploadOpen(false);
      setSelectedFile(null);
      setUploadForm({ title: "", category: "other", expiry_date: "", notes: "" });
    },
    onError: () => toast.error("Failed to upload document"),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => documents.deletePropertyDocument(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-documents", propertyId] });
      toast.success("Document deleted");
    },
    onError: () => toast.error("Failed to delete document"),
  });

  const handleDownload = async (doc: PropertyDoc) => {
    try {
      const blob = await documents.downloadPropertyDocument(doc.document_id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.title || "document";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download document");
    }
  };

  // ── Filtered docs ──
  const filteredDocs = (allDocs ?? []).filter((doc) => {
    if (filterCategory !== "all" && doc.category !== filterCategory) return false;
    if (searchQuery && !doc.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // ── Summary stats ──
  const totalDocs = (allDocs ?? []).length;
  const categoryCounts: Record<string, number> = {};
  (allDocs ?? []).forEach((d) => {
    categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
  });
  const expiringCount = (allDocs ?? []).filter((d) => isExpiringSoon(d.expiry_date)).length;
  const expiredCount = (allDocs ?? []).filter((d) => isExpired(d.expiry_date)).length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4">
              <div className="h-6 bg-muted animate-pulse rounded w-1/3 mb-2" />
              <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Total Documents</p>
            <p className="text-lg font-bold">{totalDocs}</p>
            <p className="text-xs text-muted-foreground">
              {Object.keys(categoryCounts).length} categor{Object.keys(categoryCounts).length !== 1 ? "ies" : "y"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Categories Used</p>
            <p className="text-lg font-bold">{Object.keys(categoryCounts).length}</p>
            <p className="text-xs text-muted-foreground">of {CATEGORIES.length} available</p>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", expiringCount > 0 ? "border-l-amber-500" : "border-l-gray-300")}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Expiring Soon</p>
            <p className={cn("text-lg font-bold", expiringCount > 0 ? "text-amber-700" : "")}>{expiringCount}</p>
            <p className="text-xs text-muted-foreground">within 90 days</p>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", expiredCount > 0 ? "border-l-red-500" : "border-l-gray-300")}>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Expired</p>
            <p className={cn("text-lg font-bold", expiredCount > 0 ? "text-red-700" : "")}>{expiredCount}</p>
            <p className="text-xs text-muted-foreground">need renewal</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Toolbar: Search, Filter, Upload ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Property Documents</CardTitle>
          {canEdit && (
            <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) { setSelectedFile(null); setUploadForm({ title: "", category: "other", expiry_date: "", notes: "" }); } }}>
              {/* @ts-expect-error radix-ui asChild type */}
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Upload Document
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Upload Property Document</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    uploadMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">File</Label>
                    <div
                      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      {selectedFile ? (
                        <p className="text-sm font-medium">{selectedFile.name} ({formatFileSize(selectedFile.size)})</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Click to select a file (PDF, Word, Excel, JPEG, PNG)</p>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedFile(file);
                            if (!uploadForm.title) {
                              setUploadForm((f) => ({ ...f, title: file.name.replace(/\.[^.]+$/, "") }));
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Title</Label>
                      <Input
                        value={uploadForm.title}
                        onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Document title"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Category</Label>
                      <Select value={uploadForm.category} onValueChange={(v) => setUploadForm((f) => ({ ...f, category: v || "other" }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.icon} {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Expiry Date</Label>
                      <Input
                        type="date"
                        value={uploadForm.expiry_date}
                        onChange={(e) => setUploadForm((f) => ({ ...f, expiry_date: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input
                        value={uploadForm.notes}
                        onChange={(e) => setUploadForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Optional notes about this document"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={!selectedFile || uploadMutation.isPending} className="w-full">
                    {uploadMutation.isPending ? "Uploading..." : "Upload Document"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v || "all")}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.icon} {c.label} {categoryCounts[c.value] ? `(${categoryCounts[c.value]})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Document Table */}
          {filteredDocs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {totalDocs === 0
                  ? "No documents uploaded yet."
                  : "No documents match your filter."}
              </p>
              {canEdit && totalDocs === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Upload appraisals, insurance certificates, permits, and other property documents.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Document</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map((doc) => {
                    const catMeta = getCategoryMeta(doc.category);
                    const expired = isExpired(doc.expiry_date);
                    const expiring = isExpiringSoon(doc.expiry_date);

                    return (
                      <TableRow key={doc.document_id}>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{doc.title}</p>
                              {doc.notes && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{doc.notes}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", catMeta.color)}>
                            {catMeta.icon} {catMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatFileSize(doc.file_size_bytes)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {doc.upload_date
                            ? new Date(doc.upload_date).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {doc.expiry_date ? (
                            <span className={cn(expired ? "text-red-600 font-medium" : expiring ? "text-amber-600 font-medium" : "text-muted-foreground")}>
                              {new Date(doc.expiry_date).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {expired ? (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Expired
                            </Badge>
                          ) : expiring ? (
                            <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Expiring
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                              <FileCheck className="h-3 w-3 mr-1" />
                              Current
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDownload(doc)}
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700"
                                onClick={() => {
                                  if (!confirm(`Delete "${doc.title}"?`)) return;
                                  deleteMutation.mutate(doc.document_id);
                                }}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
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

      {/* ── Lender Document Checklist ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Lender Document Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Commercial lenders typically require the following documents. Green indicates at least one document of that type has been uploaded.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {CATEGORIES.filter((c) => c.value !== "photo" && c.value !== "other").map((cat) => {
              const hasDoc = (categoryCounts[cat.value] || 0) > 0;
              return (
                <div
                  key={cat.value}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg border text-sm",
                    hasDoc ? "bg-green-50 border-green-200" : "bg-muted/30 border-muted"
                  )}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className={cn("font-medium", hasDoc ? "text-green-800" : "text-muted-foreground")}>
                    {cat.label}
                  </span>
                  {hasDoc && (
                    <Badge variant="outline" className="ml-auto text-xs text-green-700 border-green-300">
                      {categoryCounts[cat.value]}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
