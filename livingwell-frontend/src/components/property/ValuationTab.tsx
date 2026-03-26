"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Calculator,
  TrendingUp,
  DollarSign,
  Save,
  Building2,
  Ruler,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, cn } from "@/lib/utils";
import {
  useValuations,
  useCreateValuation,
  useDeleteValuation,
  useCapRateCalculation,
  useSaveCapRateValuation,
  useProperty,
} from "@/hooks/usePortfolio";
import type {
  Valuation,
  CapRateValuationResult,
} from "@/types/portfolio";

const METHOD_LABELS: Record<string, string> = {
  internal_estimate: "Internal Estimate",
  appraisal: "Appraisal",
  cap_rate: "Cap Rate / Income",
  purchase_price: "Purchase Price",
  assessed: "Tax Assessment",
  broker_opinion: "Broker Opinion",
};

interface Props {
  propertyId: number;
  canEdit: boolean;
}

export function ValuationTab({ propertyId, canEdit }: Props) {
  const { data: property } = useProperty(propertyId);
  const { data: valuations, isLoading } = useValuations(propertyId);
  const createValuation = useCreateValuation(propertyId);
  const deleteValuation = useDeleteValuation(propertyId);
  const capRateCalc = useCapRateCalculation(propertyId);
  const saveCapRate = useSaveCapRateValuation(propertyId);

  // Manual valuation form
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    valuation_date: new Date().toISOString().split("T")[0],
    value: "",
    method: "internal_estimate",
    appraiser: "",
    notes: "",
  });

  // Cap rate calculator
  const [noi, setNoi] = useState("");
  const [capRate, setCapRate] = useState("5.5");
  const [calcResult, setCalcResult] = useState<CapRateValuationResult | null>(null);

  // Multi-scenario comparison
  const scenarioRates = [4.5, 5.0, 5.5, 6.0, 6.5, 7.0];

  const currentValue = property?.current_market_value
    ? Number(property.current_market_value)
    : null;
  const latestValuation = valuations?.[0];

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    createValuation.mutate(
      {
        valuation_date: manualForm.valuation_date,
        value: Number(manualForm.value),
        method: manualForm.method,
        appraiser: manualForm.appraiser || undefined,
        notes: manualForm.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Valuation recorded");
          setManualOpen(false);
          setManualForm({
            valuation_date: new Date().toISOString().split("T")[0],
            value: "",
            method: "internal_estimate",
            appraiser: "",
            notes: "",
          });
        },
        onError: () => toast.error("Failed to record valuation"),
      }
    );
  }

  function handleCalculate() {
    if (!noi || !capRate) return;
    capRateCalc.mutate(
      { noi: Number(noi), cap_rate: Number(capRate) },
      {
        onSuccess: (result) => setCalcResult(result),
        onError: () => toast.error("Calculation failed"),
      }
    );
  }

  function handleSaveCalcAsValuation() {
    if (!noi || !capRate) return;
    saveCapRate.mutate(
      { noi: Number(noi), cap_rate: Number(capRate) },
      {
        onSuccess: () => {
          toast.success("Cap rate valuation saved");
          setCalcResult(null);
        },
        onError: () => toast.error("Failed to save valuation"),
      }
    );
  }

  function handleDeleteValuation(id: number) {
    if (!confirm("Delete this valuation record?")) return;
    deleteValuation.mutate(id, {
      onSuccess: () => toast.success("Valuation deleted"),
      onError: () => toast.error("Failed to delete"),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Current Value KPI ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Current Market Value</p>
            <p className="text-xl font-bold">
              {currentValue ? formatCurrency(currentValue) : "Not set"}
            </p>
            <p className="text-xs text-muted-foreground">
              {latestValuation
                ? `Last valued ${latestValuation.valuation_date}`
                : "No valuations recorded"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Purchase Price</p>
            <p className="text-xl font-bold">
              {property?.purchase_price
                ? formatCurrency(Number(property.purchase_price))
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {property?.purchase_date ?? "No date"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground font-medium">Appreciation</p>
            {currentValue && property?.purchase_price ? (() => {
              const purchase = Number(property.purchase_price);
              const appreciation = currentValue - purchase;
              const pct = purchase > 0 ? (appreciation / purchase) * 100 : 0;
              return (
                <>
                  <p className={cn("text-xl font-bold", appreciation >= 0 ? "text-green-700" : "text-red-700")}>
                    {appreciation >= 0 ? "+" : ""}{formatCurrency(appreciation)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pct >= 0 ? "+" : ""}{pct.toFixed(1)}% since purchase
                  </p>
                </>
              );
            })() : (
              <p className="text-xl font-bold text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Cap Rate Calculator ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Income Approach / Cap Rate Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input side */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Net Operating Income (NOI) — Annual</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-9"
                    value={noi}
                    onChange={(e) => setNoi(e.target.value)}
                    placeholder="e.g. 120000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cap Rate (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={capRate}
                  onChange={(e) => setCapRate(e.target.value)}
                  placeholder="5.5"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCalculate} disabled={capRateCalc.isPending || !noi || !capRate}>
                  <Calculator className="h-4 w-4 mr-1.5" />
                  {capRateCalc.isPending ? "Calculating..." : "Calculate Value"}
                </Button>
              </div>
            </div>

            {/* Result side */}
            <div>
              {calcResult ? (
                <div className="rounded-lg border bg-green-50/50 border-green-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-green-800">Estimated Property Value</p>
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      Income Approach
                    </Badge>
                  </div>
                  <p className="text-3xl font-bold text-green-700">
                    {formatCurrency(Number(calcResult.estimated_value))}
                  </p>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">NOI</p>
                      <p className="font-medium">{formatCurrency(Number(calcResult.noi))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Cap Rate</p>
                      <p className="font-medium">{calcResult.cap_rate}%</p>
                    </div>
                    {calcResult.value_per_unit && (
                      <div>
                        <p className="text-muted-foreground text-xs flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> Per Unit
                        </p>
                        <p className="font-medium">{formatCurrency(Number(calcResult.value_per_unit))}</p>
                      </div>
                    )}
                    {calcResult.value_per_sqft && (
                      <div>
                        <p className="text-muted-foreground text-xs flex items-center gap-1">
                          <Ruler className="h-3 w-3" /> Per Sqft
                        </p>
                        <p className="font-medium">{formatCurrency(Number(calcResult.value_per_sqft))}</p>
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <>
                      <Separator />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleSaveCalcAsValuation}
                        disabled={saveCapRate.isPending}
                      >
                        <Save className="h-4 w-4 mr-1.5" />
                        {saveCapRate.isPending ? "Saving..." : "Save as Valuation Record"}
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Enter NOI and cap rate to calculate estimated property value.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Formula: Value = NOI / Cap Rate
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Multi-scenario table */}
          {noi && Number(noi) > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium mb-2">Sensitivity Analysis</p>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Cap Rate</TableHead>
                      <TableHead className="text-right">Implied Value</TableHead>
                      <TableHead className="text-right">Per Unit</TableHead>
                      {currentValue && <TableHead className="text-right">vs Current</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scenarioRates.map((rate) => {
                      const noival = Number(noi);
                      const value = noival / (rate / 100);
                      const perUnit = property?.purchase_price ? value : null;
                      const diff = currentValue ? value - currentValue : null;
                      return (
                        <TableRow key={rate} className={rate === Number(capRate) ? "bg-blue-50/50" : ""}>
                          <TableCell className="font-medium">
                            {rate.toFixed(1)}%
                            {rate === Number(capRate) && (
                              <Badge variant="outline" className="ml-2 text-xs">Selected</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatCurrency(value)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {perUnit !== null ? formatCurrency(value) : "—"}
                          </TableCell>
                          {currentValue && (
                            <TableCell className={cn("text-right tabular-nums font-medium", (diff ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                              {diff !== null
                                ? `${diff >= 0 ? "+" : ""}${formatCurrency(diff)}`
                                : "—"}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Valuation History ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Valuation History</CardTitle>
          {canEdit && (
            <Dialog open={manualOpen} onOpenChange={setManualOpen}>
              {/* @ts-expect-error radix-ui asChild type */}
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Record Valuation
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Record Property Valuation</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Valuation Date</Label>
                      <Input
                        type="date"
                        value={manualForm.valuation_date}
                        onChange={(e) => setManualForm((f) => ({ ...f, valuation_date: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Value ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={manualForm.value}
                        onChange={(e) => setManualForm((f) => ({ ...f, value: e.target.value }))}
                        placeholder="1,200,000"
                        required
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Method</Label>
                      <Select
                        value={manualForm.method}
                        onValueChange={(v) => setManualForm((f) => ({ ...f, method: v ?? "" }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="internal_estimate">Internal Estimate</SelectItem>
                          <SelectItem value="appraisal">Appraisal</SelectItem>
                          <SelectItem value="cap_rate">Cap Rate / Income</SelectItem>
                          <SelectItem value="purchase_price">Purchase Price</SelectItem>
                          <SelectItem value="assessed">Tax Assessment</SelectItem>
                          <SelectItem value="broker_opinion">Broker Opinion</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Appraiser / Source</Label>
                      <Input
                        value={manualForm.appraiser}
                        onChange={(e) => setManualForm((f) => ({ ...f, appraiser: e.target.value }))}
                        placeholder="e.g. Colliers International"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input
                        value={manualForm.notes}
                        onChange={(e) => setManualForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Any additional context..."
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={createValuation.isPending} className="w-full">
                    {createValuation.isPending ? "Saving..." : "Save Valuation"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {!valuations || valuations.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No valuation records yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the cap rate calculator above or record a manual valuation.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Appraiser</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {valuations.map((val: Valuation, idx: number) => {
                    const prev = idx < valuations.length - 1 ? valuations[idx + 1] : null;
                    const change = prev
                      ? Number(val.value) - Number(prev.value)
                      : null;
                    const changePct = prev && Number(prev.value) > 0
                      ? (change! / Number(prev.value)) * 100
                      : null;

                    return (
                      <TableRow key={val.valuation_id}>
                        <TableCell className="font-medium">{val.valuation_date}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(Number(val.value))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {METHOD_LABELS[val.method] ?? val.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {val.appraiser || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {val.notes || "—"}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums text-sm font-medium", change !== null ? (change >= 0 ? "text-green-600" : "text-red-600") : "")}>
                          {change !== null
                            ? `${change >= 0 ? "+" : ""}${formatCurrency(change)} (${changePct!.toFixed(1)}%)`
                            : "—"}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteValuation(val.valuation_id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
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
