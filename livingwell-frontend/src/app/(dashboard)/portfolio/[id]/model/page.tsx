"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calculator } from "lucide-react";
import { useRunModel, useProperty } from "@/hooks/usePortfolio";
import { ModelingInput, ModelingResult } from "@/types/portfolio";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default function ModelPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const propertyId = Number(id);
  const { data: property } = useProperty(propertyId);
  const { mutateAsync: runModel, isPending } = useRunModel();
  const [result, setResult] = useState<ModelingResult | null>(null);

  const [form, setForm] = useState<ModelingInput>({
    purchase_price: 0,
    construction_cost: 0,
    annual_revenue: 0,
    annual_expenses: 0,
    hold_period_years: 5,
    exit_cap_rate: 0.05,
  });

  const set = (k: keyof ModelingInput, v: number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await runModel(form);
      setResult(res);
    } catch {
      toast.error("Modeling failed. Check your inputs.");
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <LinkButton variant="ghost" size="sm" href={`/portfolio/${propertyId}`} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Property
        </LinkButton>
        <h1 className="text-2xl font-bold">Financial Model</h1>
        {property && (
          <p className="text-muted-foreground">
            {property.address}, {property.city}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Inputs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Purchase Price (CAD)</Label>
                <Input
                  type="number"
                  value={form.purchase_price || ""}
                  onChange={(e) => set("purchase_price", Number(e.target.value))}
                  placeholder={property ? String(Math.round(Number(property.purchase_price))) : "0"}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Construction Cost (CAD)</Label>
                <Input
                  type="number"
                  value={form.construction_cost || ""}
                  onChange={(e) => set("construction_cost", Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Annual Revenue (CAD)</Label>
                <Input
                  type="number"
                  value={form.annual_revenue || ""}
                  onChange={(e) => set("annual_revenue", Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Annual Expenses (CAD)</Label>
                <Input
                  type="number"
                  value={form.annual_expenses || ""}
                  onChange={(e) => set("annual_expenses", Number(e.target.value))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hold Period (years)</Label>
                  <Input
                    type="number"
                    value={form.hold_period_years}
                    onChange={(e) => set("hold_period_years", Number(e.target.value))}
                    min={1}
                    max={30}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Exit Cap Rate (e.g. 0.05)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={form.exit_cap_rate}
                    onChange={(e) => set("exit_cap_rate", Number(e.target.value))}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Calculating…" : "Run Model"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <p className="text-sm text-muted-foreground">
                Fill in the inputs and run the model to see results.
              </p>
            ) : (
              <div className="space-y-6">
                {[
                  {
                    label: "Total Construction Costs",
                    value: formatCurrency(result.construction_costs),
                    desc: "Land + construction",
                  },
                  {
                    label: "Net Operating Income (NOI)",
                    value: formatCurrency(result.noi),
                    desc: "Annual revenue minus expenses",
                  },
                  {
                    label: "Cap Rate",
                    value: `${Number(result.cap_rate).toFixed(2)}%`,
                    desc: "NOI / total cost",
                  },
                  {
                    label: "IRR",
                    value: `${Number(result.irr).toFixed(2)}%`,
                    desc: `Over ${form.hold_period_years}-year hold`,
                  },
                ].map(({ label, value, desc }) => (
                  <div key={label} className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <p className="text-xl font-bold text-primary">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
