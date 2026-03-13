"use client";

import { useState } from "react";
import {
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Timer,
  Ban,
  Filter,
} from "lucide-react";
import {
  useETransfers,
  useUpdateETransfer,
} from "@/hooks/useLifecycle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { ETransferStatus } from "@/types/lifecycle";

const STATUS_CONFIG: Record<
  ETransferStatus,
  { icon: typeof CheckCircle2; color: string; badgeColor: string }
> = {
  initiated: {
    icon: Clock,
    color: "text-gray-500",
    badgeColor: "bg-gray-100 text-gray-700",
  },
  sent: {
    icon: Send,
    color: "text-blue-500",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  accepted: {
    icon: CheckCircle2,
    color: "text-green-500",
    badgeColor: "bg-green-100 text-green-700",
  },
  declined: {
    icon: XCircle,
    color: "text-red-500",
    badgeColor: "bg-red-100 text-red-700",
  },
  expired: {
    icon: Timer,
    color: "text-amber-500",
    badgeColor: "bg-amber-100 text-amber-700",
  },
  cancelled: {
    icon: Ban,
    color: "text-gray-400",
    badgeColor: "bg-gray-100 text-gray-500",
  },
};

export default function ETransfersPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data: etransfers, isLoading } = useETransfers(
    statusFilter || undefined
  );
  const { mutateAsync: updateETransfer } = useUpdateETransfer();

  const handleStatusUpdate = async (
    etransferId: number,
    newStatus: ETransferStatus
  ) => {
    try {
      await updateETransfer({
        etransferId,
        data: { status: newStatus },
      });
      toast.success(`eTransfer marked as ${newStatus}`);
    } catch {
      toast.error("Failed to update eTransfer");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const stats = {
    total: etransfers?.length ?? 0,
    sent: etransfers?.filter((e) => e.status === "sent").length ?? 0,
    accepted: etransfers?.filter((e) => e.status === "accepted").length ?? 0,
    pending:
      etransfers?.filter((e) =>
        ["initiated", "sent"].includes(e.status)
      ).length ?? 0,
    totalAmount:
      etransfers?.reduce((sum, e) => sum + Number(e.amount), 0) ?? 0,
    acceptedAmount:
      etransfers
        ?.filter((e) => e.status === "accepted")
        .reduce((sum, e) => sum + Number(e.amount), 0) ?? 0,
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Send className="h-6 w-6" />
          eTransfer Tracking
        </h1>
        <p className="text-muted-foreground">
          Track Interac eTransfer distributions to investors
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Transfers</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Accepted</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.acceptedAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">eTransfer History</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={statusFilter || "all"}
              onValueChange={(v) =>
                setStatusFilter(v === "all" || !v ? "" : v)
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="initiated">Initiated</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!etransfers || etransfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No eTransfers found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Accepted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {etransfers.map((et) => {
                  const cfg = STATUS_CONFIG[et.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <TableRow key={et.tracking_id}>
                      <TableCell className="font-mono text-sm">
                        {et.reference_number ?? "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm">{et.recipient_email}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(et.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={cfg.badgeColor}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {et.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {et.sent_at ? formatDate(et.sent_at) : "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {et.accepted_at ? formatDate(et.accepted_at) : "\u2014"}
                      </TableCell>
                      <TableCell>
                        {et.status === "initiated" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleStatusUpdate(et.tracking_id, "sent")
                            }
                          >
                            Mark Sent
                          </Button>
                        )}
                        {et.status === "sent" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleStatusUpdate(et.tracking_id, "accepted")
                            }
                          >
                            Confirm
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
