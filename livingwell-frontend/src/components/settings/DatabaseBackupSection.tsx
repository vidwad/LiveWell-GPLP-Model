"use client";

import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Database, Download, Upload, RefreshCw, Trash2, AlertTriangle,
  Lock, Camera, FileText, ShieldAlert, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmtBytes = (b: number | null | undefined): string => {
  if (b == null || b < 0) return "—";
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)}MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)}GB`;
};

const fmtDate = (s: string | null | undefined): string => {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("en-CA", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return s;
  }
};

interface Backup {
  backup_id: number;
  backup_type: "logical" | "physical";
  filename: string;
  size_bytes: number;
  description: string | null;
  row_counts: Record<string, number>;
  total_rows: number;
  table_count: number;
  schema_fingerprint_summary: { table_count: number; captured_at: string | null };
  app_version: string | null;
  created_at: string;
  created_by_user_id: number | null;
  file_exists: boolean;
}

interface DiffReport {
  backup_id: number;
  dry_run: boolean;
  exported_at?: string;
  exported_by?: string | null;
  tables: Record<string, any>;
  summary: {
    tables_processed: number;
    tables_skipped_missing: number;
    rows_inserted: number;
    rows_updated: number;
    rows_skipped_orphan: number;
    warnings: string[];
  };
}

export function DatabaseBackupSection() {
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [creatingType, setCreatingType] = useState<"logical" | "physical" | null>(null);
  const [restorePreview, setRestorePreview] = useState<{ backup: Backup; report: DiffReport } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<"logical" | "physical">("logical");

  const { data: backups, isLoading } = useQuery<Backup[]>({
    queryKey: ["database-backups"],
    queryFn: () => apiClient.get("/api/admin/backups/").then((r) => r.data || []),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { backup_type: "logical" | "physical"; description: string }) =>
      apiClient.post("/api/admin/backups/", payload).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`${data.backup_type === "logical" ? "Logical" : "Physical"} backup created — ${fmtBytes(data.size_bytes)}`);
      setDescription("");
      setCreatingType(null);
      qc.invalidateQueries({ queryKey: ["database-backups"] });
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail || "Backup failed");
      setCreatingType(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/admin/backups/${id}`),
    onSuccess: () => {
      toast.success("Backup deleted");
      qc.invalidateQueries({ queryKey: ["database-backups"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Delete failed"),
  });

  const previewRestoreMutation = useMutation({
    mutationFn: (backup: Backup) =>
      apiClient
        .post(`/api/admin/backups/${backup.backup_id}/restore`, { dry_run: true })
        .then((r) => ({ backup, report: r.data as DiffReport })),
    onSuccess: (data) => setRestorePreview(data),
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Preview failed"),
  });

  const commitRestoreMutation = useMutation({
    mutationFn: (backupId: number) =>
      apiClient
        .post(`/api/admin/backups/${backupId}/restore`, { dry_run: false, confirm: true })
        .then((r) => r.data),
    onSuccess: () => {
      toast.success("Restore committed");
      setRestorePreview(null);
      setRestoring(false);
      qc.invalidateQueries({ queryKey: ["database-backups"] });
      // Best-effort: refetch most queries by invalidating everything
      qc.invalidateQueries();
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail || "Restore failed");
      setRestoring(false);
    },
  });

  const handleDownload = (backup: Backup) => {
    const url = `${apiClient.defaults.baseURL || ""}/api/admin/backups/${backup.backup_id}/download`;
    window.open(url, "_blank");
  };

  const handleUpload = async (file: File) => {
    const form = new FormData();
    form.append("backup_type", uploadType);
    form.append("description", "Uploaded from " + file.name);
    form.append("file", file);
    try {
      await apiClient.post("/api/admin/backups/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`Uploaded ${file.name}`);
      qc.invalidateQueries({ queryKey: ["database-backups"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    }
  };

  const handleStartCreate = (type: "logical" | "physical") => {
    setCreatingType(type);
    createMutation.mutate({ backup_type: type, description });
  };

  // Group backups by type
  const logicalBackups = (backups || []).filter((b) => b.backup_type === "logical");
  const physicalBackups = (backups || []).filter((b) => b.backup_type === "physical");

  return (
    <Card className="border-l-4 border-l-red-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4 text-red-600" />
          Database Backups
          <Badge variant="outline" className="text-[10px] ml-1">Developer only</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-amber-50 border-l-4 border-amber-400 p-3 text-xs text-amber-900">
          <p className="font-semibold flex items-center gap-1 mb-1">
            <ShieldAlert className="h-3.5 w-3.5" />
            Important: backups protect against data loss but restores are powerful and irreversible.
          </p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li><strong>Logical backups</strong> (JSON) are schema-tolerant — safe to restore even after schema changes. Recommended for routine use.</li>
            <li><strong>Physical backups</strong> (SQLite file copy) are byte-for-byte and require an exact schema match. Use for disaster recovery only.</li>
            <li>Up to <strong>3 backups per type</strong> are retained automatically. Creating a 4th deletes the oldest.</li>
            <li>All restore actions use a <strong>two-phase preview-and-confirm</strong> flow.</li>
          </ul>
        </div>

        {/* Create new backup */}
        <div className="border rounded-md p-3 space-y-2 bg-muted/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Create New Backup
          </p>
          <Input
            type="text"
            placeholder="Description (optional, e.g. 'pre-migration')"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-9 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => handleStartCreate("logical")}
              disabled={createMutation.isPending}
              className="gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              {creatingType === "logical" ? "Creating…" : "Logical Snapshot (JSON)"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStartCreate("physical")}
              disabled={createMutation.isPending}
              className="gap-1.5"
            >
              <Camera className="h-3.5 w-3.5" />
              {creatingType === "physical" ? "Creating…" : "Physical Copy (SQLite)"}
            </Button>
          </div>
        </div>

        {/* Backup lists */}
        {isLoading ? (
          <div className="py-4 text-sm text-muted-foreground text-center">Loading backups…</div>
        ) : (
          <div className="space-y-4">
            <BackupTypeBlock
              title="Logical Snapshots (JSON, schema-tolerant)"
              icon={<FileText className="h-4 w-4 text-blue-600" />}
              backups={logicalBackups}
              maxCount={3}
              onDownload={handleDownload}
              onPreviewRestore={(b) => previewRestoreMutation.mutate(b)}
              onDelete={(b) => {
                if (confirm(`Delete backup "${b.filename}"? This cannot be undone.`)) {
                  deleteMutation.mutate(b.backup_id);
                }
              }}
              previewing={previewRestoreMutation.isPending}
            />
            <BackupTypeBlock
              title="Physical Copies (SQLite file, exact-schema restore)"
              icon={<Camera className="h-4 w-4 text-purple-600" />}
              backups={physicalBackups}
              maxCount={3}
              onDownload={handleDownload}
              onPreviewRestore={(b) => previewRestoreMutation.mutate(b)}
              onDelete={(b) => {
                if (confirm(`Delete backup "${b.filename}"? This cannot be undone.`)) {
                  deleteMutation.mutate(b.backup_id);
                }
              }}
              previewing={previewRestoreMutation.isPending}
            />
          </div>
        )}

        {/* Upload */}
        <div className="border rounded-md p-3 space-y-2 bg-muted/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Upload Backup (off-site recovery)
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as any)}
              className="h-9 px-2 rounded border border-input bg-background text-sm"
            >
              <option value="logical">Logical (.json / .json.gz)</option>
              <option value="physical">Physical (.sqlite)</option>
            </select>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Choose File…
            </Button>
          </div>
        </div>
      </CardContent>

      {/* ── Restore preview modal ─────────────────────────── */}
      {restorePreview && (
        <RestorePreviewModal
          backup={restorePreview.backup}
          report={restorePreview.report}
          onConfirm={() => {
            setRestoring(true);
            commitRestoreMutation.mutate(restorePreview.backup.backup_id);
          }}
          onCancel={() => setRestorePreview(null)}
          committing={restoring}
        />
      )}
    </Card>
  );
}

function BackupTypeBlock({
  title, icon, backups, maxCount, onDownload, onPreviewRestore, onDelete, previewing,
}: {
  title: string;
  icon: React.ReactNode;
  backups: Backup[];
  maxCount: number;
  onDownload: (b: Backup) => void;
  onPreviewRestore: (b: Backup) => void;
  onDelete: (b: Backup) => void;
  previewing: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold flex items-center gap-1.5 mb-2 text-muted-foreground">
        {icon}
        {title}
        <Badge variant="outline" className="text-[10px] ml-1">{backups.length} / {maxCount}</Badge>
      </p>
      {backups.length === 0 ? (
        <div className="border rounded text-center py-4 text-xs text-muted-foreground italic">
          No backups of this type yet.
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map((b) => (
            <div key={b.backup_id} className="border rounded-md p-3 bg-card">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono truncate">{b.filename}</p>
                  {b.description && (
                    <p className="text-[11px] text-muted-foreground italic mt-0.5">{b.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-1">
                    <span>{fmtDate(b.created_at)}</span>
                    <span>{fmtBytes(b.size_bytes)}</span>
                    <span>{b.total_rows.toLocaleString()} rows</span>
                    <span>{b.table_count} tables</span>
                    {b.app_version && <span>v{b.app_version.slice(0, 7)}</span>}
                    {!b.file_exists && (
                      <Badge variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-300">
                        FILE MISSING
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] gap-1"
                    disabled={!b.file_exists || previewing}
                    onClick={() => onPreviewRestore(b)}
                    title="Preview restore (safe — no changes made)"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] gap-1"
                    disabled={!b.file_exists}
                    onClick={() => onDownload(b)}
                    title="Download backup file for off-site storage"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] gap-1 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                    onClick={() => onDelete(b)}
                    title="Delete backup permanently"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RestorePreviewModal({
  backup, report, onConfirm, onCancel, committing,
}: {
  backup: Backup;
  report: DiffReport;
  onConfirm: () => void;
  onCancel: () => void;
  committing: boolean;
}) {
  const s = report.summary;
  const tableEntries = Object.entries(report.tables || {});

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-3 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-700" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Restore Preview — Dry Run</h3>
            <p className="text-[11px] text-amber-900">
              Reviewing changes from <span className="font-mono">{backup.filename}</span>. No changes have been made yet.
            </p>
          </div>
        </div>

        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <SummaryCell label="Tables Processed" value={s.tables_processed.toString()} color="text-slate-700" />
            <SummaryCell label="Rows to Insert" value={s.rows_inserted.toLocaleString()} color="text-green-700" />
            <SummaryCell label="Rows to Update" value={s.rows_updated.toLocaleString()} color="text-blue-700" />
            <SummaryCell label="Orphans Skipped" value={s.rows_skipped_orphan.toLocaleString()} color="text-amber-700" />
          </div>

          {/* Warnings */}
          {s.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs">
              <p className="font-semibold mb-1 text-amber-900">⚠ Warnings ({s.warnings.length})</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                {s.warnings.slice(0, 10).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {s.warnings.length > 10 && (
                  <li className="italic">…and {s.warnings.length - 10} more</li>
                )}
              </ul>
            </div>
          )}

          {/* Per-table breakdown */}
          <div className="border rounded">
            <div className="grid grid-cols-12 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 border-b font-semibold">
              <div className="col-span-5">Table</div>
              <div className="col-span-2 text-right">Inserts</div>
              <div className="col-span-2 text-right">Updates</div>
              <div className="col-span-3 text-right">Skipped Orphans</div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {tableEntries
                .filter(([, v]: [string, any]) => v.status === "processed" && (v.rows_inserted > 0 || v.rows_updated > 0 || v.rows_skipped_orphan > 0))
                .sort((a: any, b: any) => (b[1].rows_inserted + b[1].rows_updated) - (a[1].rows_inserted + a[1].rows_updated))
                .map(([tname, v]: [string, any]) => (
                  <div key={tname} className="grid grid-cols-12 px-3 py-1.5 text-xs border-b last:border-b-0">
                    <div className="col-span-5 font-mono">{tname}</div>
                    <div className="col-span-2 text-right tabular-nums text-green-700">{v.rows_inserted || "—"}</div>
                    <div className="col-span-2 text-right tabular-nums text-blue-700">{v.rows_updated || "—"}</div>
                    <div className="col-span-3 text-right tabular-nums text-amber-700">{v.rows_skipped_orphan || "—"}</div>
                  </div>
                ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground italic">
            Restore uses upsert semantics: existing rows are updated, new rows are inserted, foreign-key orphans are skipped.
            Data added since this backup was taken will <strong>not</strong> be deleted.
          </p>
        </div>

        <div className="border-t bg-muted/30 px-4 py-3 flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={committing}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground italic">
              Confirm to commit changes to the live database.
            </span>
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={committing}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {committing ? (
                <>Committing…</>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Commit Restore
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border rounded p-2 bg-card">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={cn("text-lg font-bold", color || "text-slate-700")}>{value}</p>
    </div>
  );
}
