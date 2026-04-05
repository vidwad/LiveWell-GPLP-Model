"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import {
  Wand2, Home, Wrench, HardHat, ChevronRight, ChevronLeft,
  Building2, DollarSign, Calendar, Target, Loader2, CheckCircle2,
  Link2, Sparkles, DoorOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UnitConfigurator, unitConfigsToApiPayload, type UnitConfig, type BedroomConfig } from "@/components/property/UnitConfigurator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STRATEGIES = [
  {
    key: "hold_as_is",
    label: "Buy & Hold As-Is",
    icon: Home,
    description: "Purchase and operate immediately with existing configuration. Stabilize revenue, hold for LP mandate, sell.",
    color: "border-blue-200 bg-blue-50 hover:border-blue-400",
    activeColor: "border-blue-500 bg-blue-100 ring-2 ring-blue-500/30",
  },
  {
    key: "buy_and_renovate",
    label: "Buy & Renovate",
    icon: Wrench,
    description: "Purchase, renovate to improve rents and value, stabilize, then sell within LP mandate window.",
    color: "border-amber-200 bg-amber-50 hover:border-amber-400",
    activeColor: "border-amber-500 bg-amber-100 ring-2 ring-amber-500/30",
  },
  {
    key: "buy_renovate_develop",
    label: "Buy, Renovate & Develop",
    icon: HardHat,
    description: "Purchase, light reno for interim income, then full development into multi-unit. Highest returns, longest timeline.",
    color: "border-green-200 bg-green-50 hover:border-green-400",
    activeColor: "border-green-500 bg-green-100 ring-2 ring-green-500/30",
  },
];

interface WizardForm {
  strategy: string;
  address: string;
  city: string;
  province: string;
  purchase_price: string;
  purchase_date: string;
  property_type: string;
  bedrooms: string;
  bathrooms: string;
  building_sqft: string;
  year_built: string;
  zoning: string;
  listing_url: string;
  baseline_rent_per_bed: string;
  reno_rent_per_bed: string;
  reno_budget: string;
  dev_units: string;
  dev_beds_per_unit: string;
  dev_rent_per_bed: string;
  dev_construction_cost: string;
  mortgage_ltv_pct: string;
  mortgage_rate: string;
  mortgage_amort_years: string;
  mortgage_term_years: string;
  lp_id: string;
  target_hold_years: string;
  exit_cap_rate: string;
  target_irr: string;
  target_equity_multiple: string;
}

const defaultForm: WizardForm = {
  strategy: "",
  address: "", city: "Calgary", province: "AB",
  purchase_price: "", purchase_date: "", property_type: "Single Family",
  bedrooms: "4", bathrooms: "2", building_sqft: "1200",
  year_built: "", zoning: "", listing_url: "",
  baseline_rent_per_bed: "700",
  reno_rent_per_bed: "800", reno_budget: "35000",
  dev_units: "6", dev_beds_per_unit: "4", dev_rent_per_bed: "850",
  dev_construction_cost: "",
  mortgage_ltv_pct: "75", mortgage_rate: "5.0",
  mortgage_amort_years: "25", mortgage_term_years: "5",
  lp_id: "", target_hold_years: "7", exit_cap_rate: "5.5",
  target_irr: "", target_equity_multiple: "",
};

export function AddPropertyWizard({ lpOptions }: { lpOptions?: { lp_id: number; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>({ ...defaultForm });

  const sf = (key: keyof WizardForm, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiClient.post("/api/portfolio/properties/wizard", data).then(r => r.data),
  });

  const [listingUrl, setListingUrl] = useState("");
  const extractMutation = useMutation({
    mutationFn: (url: string) =>
      apiClient.post("/api/portfolio/extract-listing", { url }).then(r => r.data),
    onSuccess: (data) => {
      // Auto-fill form from extracted data
      setForm(prev => ({
        ...prev,
        address: data.address || prev.address,
        city: data.city || prev.city,
        province: data.province || prev.province,
        purchase_price: data.list_price ? String(data.list_price) : prev.purchase_price,
        bedrooms: data.bedrooms ? String(data.bedrooms) : prev.bedrooms,
        bathrooms: data.bathrooms ? String(data.bathrooms) : prev.bathrooms,
        building_sqft: data.building_sqft ? String(data.building_sqft) : prev.building_sqft,
        year_built: data.year_built ? String(data.year_built) : prev.year_built,
        zoning: data.zoning || prev.zoning,
        property_type: data.property_type || prev.property_type,
        listing_url: listingUrl,
      }));
      toast.success("Listing data imported — review and adjust below");
    },
    onError: () => toast.error("Failed to extract listing. Check URL and try again."),
  });

  const strategy = form.strategy;
  const isReno = strategy === "buy_and_renovate" || strategy === "buy_renovate_develop";
  const isDev = strategy === "buy_renovate_develop";

  // Unit configurations per phase
  const defaultBR = (rent: number): BedroomConfig[] => {
    const n = Number(form.bedrooms) || 3;
    return Array.from({ length: n }, (_, i) => ({ bedroom_number: i + 1, beds: 1, rent_per_bed: rent }));
  };
  const [baselineUnits, setBaselineUnits] = useState<UnitConfig[]>([
    { unit_number: "House", unit_type: "house", bedrooms: 3, bathrooms: 1, sqft: 1200, floor: "Main", bedroom_configs: defaultBR(700) },
  ]);
  const [renoUnits, setRenoUnits] = useState<UnitConfig[]>([
    { unit_number: "House (Renovated)", unit_type: "house", bedrooms: 3, bathrooms: 1, sqft: 1200, floor: "Main", bedroom_configs: defaultBR(800) },
  ]);
  const [devUnits, setDevUnits] = useState<UnitConfig[]>([
    { unit_number: "Unit 101", unit_type: "2br", bedrooms: 2, bathrooms: 1, sqft: 750, floor: "Ground", bedroom_configs: [{ bedroom_number: 1, beds: 2, rent_per_bed: 825 }, { bedroom_number: 2, beds: 2, rent_per_bed: 825 }] },
  ]);

  // Sync baseline unit bedrooms when form.bedrooms changes
  React.useEffect(() => {
    const n = Number(form.bedrooms) || 3;
    setBaselineUnits(prev => {
      if (prev.length === 1 && prev[0].bedrooms !== n) {
        const u = { ...prev[0], bedrooms: n, bedroom_configs: Array.from({ length: n }, (_, i) => ({ bedroom_number: i + 1, beds: 1, rent_per_bed: Number(form.baseline_rent_per_bed) || 700 })) };
        return [u];
      }
      return prev;
    });
  }, [form.bedrooms, form.baseline_rent_per_bed]);

  // Steps: 5 steps now
  const steps = [
    { label: "Strategy", icon: Target },
    { label: "Property", icon: Building2 },
    { label: "Units & Beds", icon: DoorOpen },
    { label: "Financing", icon: DollarSign },
    { label: "LP Mandate", icon: Calendar },
  ];

  const canNext = (() => {
    if (step === 0) return !!strategy;
    if (step === 1) return !!form.address && !!form.purchase_price;
    if (step === 2) return baselineUnits.length > 0;
    if (step === 3) return true;
    if (step === 4) return true;
    return false;
  })();

  const handleSubmit = async () => {
    // Compute totals from unit configs
    const totalBedrooms = baselineUnits.reduce((s, u) => s + u.bedrooms, 0);
    const totalBeds = baselineUnits.reduce((s, u) => s + u.bedroom_configs.reduce((bs, br) => bs + br.beds, 0), 0);
    const avgRent = totalBeds > 0
      ? baselineUnits.reduce((s, u) => s + u.bedroom_configs.reduce((bs, br) => bs + br.beds * br.rent_per_bed, 0), 0) / totalBeds
      : 700;

    const payload: Record<string, any> = {
      strategy: form.strategy,
      address: form.address,
      city: form.city,
      province: form.province,
      purchase_price: Number(form.purchase_price),
      purchase_date: form.purchase_date || undefined,
      property_type: form.property_type,
      bedrooms: totalBedrooms,
      bathrooms: Number(form.bathrooms) || 2,
      building_sqft: Number(form.building_sqft) || 1200,
      year_built: form.year_built ? Number(form.year_built) : undefined,
      zoning: form.zoning || undefined,
      listing_url: form.listing_url || undefined,
      baseline_rent_per_bed: Math.round(avgRent),
      mortgage_ltv_pct: Number(form.mortgage_ltv_pct) || 75,
      mortgage_rate: Number(form.mortgage_rate) || 5.0,
      mortgage_amort_years: Number(form.mortgage_amort_years) || 25,
      mortgage_term_years: Number(form.mortgage_term_years) || 5,
      lp_id: form.lp_id ? Number(form.lp_id) : undefined,
      target_hold_years: Number(form.target_hold_years) || 7,
      exit_cap_rate: Number(form.exit_cap_rate) || 5.5,
      target_irr: form.target_irr ? Number(form.target_irr) : undefined,
      target_equity_multiple: form.target_equity_multiple ? Number(form.target_equity_multiple) : undefined,
    };

    if (isReno) {
      payload.reno_rent_per_bed = Number(form.reno_rent_per_bed) || undefined;
      payload.reno_budget = Number(form.reno_budget) || undefined;
    }
    if (isDev) {
      const devBeds = devUnits.reduce((s, u) => s + u.bedroom_configs.reduce((bs, br) => bs + br.beds, 0), 0);
      const devAvgRent = devBeds > 0
        ? devUnits.reduce((s, u) => s + u.bedroom_configs.reduce((bs, br) => bs + br.beds * br.rent_per_bed, 0), 0) / devBeds
        : 850;
      payload.dev_units = devUnits.length;
      payload.dev_beds_per_unit = devBeds > 0 ? Math.round(devBeds / devUnits.length) : 4;
      payload.dev_rent_per_bed = Math.round(devAvgRent);
      payload.dev_construction_cost = form.dev_construction_cost ? Number(form.dev_construction_cost) : undefined;
    }

    try {
      // Step 1: Create property via wizard (creates structure + baseline)
      const result = await createMutation.mutateAsync(payload);
      const propertyId = result.property_id;

      // Step 2: Override baseline units with the configured ones
      const blPayload = unitConfigsToApiPayload(baselineUnits);
      await apiClient.post(`/api/portfolio/properties/${propertyId}/configure-units`, {
        plan_id: null,
        units: blPayload.units,
        clear_existing: true,
      });

      // Step 3: Configure reno units if applicable
      // (plan was already created by wizard — we need to find its ID)
      // For now, the wizard's auto-created plans will be overridden when user edits

      toast.success(`Property created: ${form.address}`);
      setOpen(false);
      setStep(0);
      setForm({ ...defaultForm });
      router.push(`/portfolio/${propertyId}`);
    } catch {
      toast.error("Failed to create property");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setStep(0); setForm({ ...defaultForm }); } }}>
      {/* @ts-expect-error radix asChild */}
      <DialogTrigger asChild>
        <Button variant="outline">
          <Wand2 className="mr-2 h-4 w-4" />
          Quick Setup
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Add Property — Quick Setup
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 mb-4">
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <button
                onClick={() => i <= step && setStep(i)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  i === step ? "bg-primary text-white" :
                  i < step ? "bg-primary/10 text-primary cursor-pointer" :
                  "bg-muted text-muted-foreground"
                )}
              >
                {i < step ? <CheckCircle2 className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
                {s.label}
              </button>
              {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 0: Strategy Selection */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">What is your investment strategy for this property?</p>
            {STRATEGIES.map(s => (
              <button
                key={s.key}
                onClick={() => sf("strategy", s.key)}
                className={cn(
                  "w-full rounded-lg border-2 p-4 text-left transition-all",
                  strategy === s.key ? s.activeColor : s.color
                )}
              >
                <div className="flex items-start gap-3">
                  <s.icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">{s.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Property Basics */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Listing URL Import */}
            <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Link2 className="h-4 w-4" />
                Import from Listing URL
              </div>
              <p className="text-xs text-muted-foreground">
                Paste a Realtor.ca, Zillow, or other listing URL to auto-fill property details using AI.
              </p>
              <div className="flex gap-2">
                <Input
                  value={listingUrl}
                  onChange={e => setListingUrl(e.target.value)}
                  placeholder="https://www.realtor.ca/real-estate/..."
                  className="flex-1"
                />
                <Button
                  variant="default"
                  size="sm"
                  disabled={!listingUrl.trim() || extractMutation.isPending}
                  onClick={() => extractMutation.mutate(listingUrl.trim())}
                >
                  {extractMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Extracting...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-1.5" />Fetch</>
                  )}
                </Button>
              </div>
              {extractMutation.isSuccess && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Listing data imported — review fields below
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <Label>Address *</Label>
                <Input value={form.address} onChange={e => sf("address", e.target.value)} placeholder="1847 Bowness Road NW" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={e => sf("city", e.target.value)} /></div>
                <div className="space-y-1"><Label>Province</Label><Input value={form.province} onChange={e => sf("province", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Purchase Price *</Label><Input type="number" value={form.purchase_price} onChange={e => sf("purchase_price", e.target.value)} placeholder="465000" /></div>
                <div className="space-y-1"><Label>Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={e => sf("purchase_date", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1"><Label>Bedrooms</Label><Input type="number" value={form.bedrooms} onChange={e => sf("bedrooms", e.target.value)} /></div>
                <div className="space-y-1"><Label>Bathrooms</Label><Input type="number" value={form.bathrooms} onChange={e => sf("bathrooms", e.target.value)} /></div>
                <div className="space-y-1"><Label>Sqft</Label><Input type="number" value={form.building_sqft} onChange={e => sf("building_sqft", e.target.value)} /></div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Units & Beds Configuration */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Baseline / As-Is */}
            <UnitConfigurator
              units={baselineUnits}
              onChange={setBaselineUnits}
              defaultRentPerBed={Number(form.baseline_rent_per_bed) || 700}
              label="Baseline / As-Is Configuration"
            />

            {/* Post-Renovation (strategy 2 & 3) */}
            {isReno && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-1 w-6 bg-amber-500 rounded-full" />
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Post-Renovation</span>
                  <Input type="number" value={form.reno_budget} onChange={e => sf("reno_budget", e.target.value)} placeholder="Reno budget ($)" className="h-7 w-36 text-xs ml-auto" />
                </div>
                <UnitConfigurator
                  units={renoUnits}
                  onChange={setRenoUnits}
                  defaultRentPerBed={Number(form.reno_rent_per_bed) || 800}
                />
              </div>
            )}

            {/* Full Development (strategy 3) */}
            {isDev && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-1 w-6 bg-green-500 rounded-full" />
                  <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">Full Development</span>
                  <Input type="number" value={form.dev_construction_cost} onChange={e => sf("dev_construction_cost", e.target.value)} placeholder="Construction cost ($)" className="h-7 w-36 text-xs ml-auto" />
                </div>
                <UnitConfigurator
                  units={devUnits}
                  onChange={setDevUnits}
                  defaultRentPerBed={Number(form.dev_rent_per_bed) || 850}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Financing */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Acquisition financing defaults. You can adjust these later.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>LTV (%)</Label><Input type="number" step="0.1" value={form.mortgage_ltv_pct} onChange={e => sf("mortgage_ltv_pct", e.target.value)} /></div>
              <div className="space-y-1"><Label>Interest Rate (%)</Label><Input type="number" step="0.01" value={form.mortgage_rate} onChange={e => sf("mortgage_rate", e.target.value)} /></div>
              <div className="space-y-1"><Label>Amortization (years)</Label><Input type="number" value={form.mortgage_amort_years} onChange={e => sf("mortgage_amort_years", e.target.value)} /></div>
              <div className="space-y-1"><Label>Term (years)</Label><Input type="number" value={form.mortgage_term_years} onChange={e => sf("mortgage_term_years", e.target.value)} /></div>
            </div>
            {form.purchase_price && (
              <Card className="bg-muted/50">
                <CardContent className="py-3 px-4 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Mortgage Amount</span><span className="font-medium">${Math.round(Number(form.purchase_price) * Number(form.mortgage_ltv_pct) / 100).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Equity Required</span><span className="font-medium">${Math.round(Number(form.purchase_price) * (1 - Number(form.mortgage_ltv_pct) / 100)).toLocaleString()}</span></div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 4: LP Mandate */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">LP hold mandate and return targets.</p>
            <div className="grid grid-cols-2 gap-4">
              {lpOptions && lpOptions.length > 0 && (
                <div className="space-y-1 col-span-2">
                  <Label>LP Entity</Label>
                  <Select value={form.lp_id} onValueChange={v => sf("lp_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select LP..." /></SelectTrigger>
                    <SelectContent>
                      {lpOptions.map(lp => (
                        <SelectItem key={lp.lp_id} value={String(lp.lp_id)}>{lp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1"><Label>Target Hold (years)</Label><Input type="number" value={form.target_hold_years} onChange={e => sf("target_hold_years", e.target.value)} /></div>
              <div className="space-y-1"><Label>Exit Cap Rate (%)</Label><Input type="number" step="0.1" value={form.exit_cap_rate} onChange={e => sf("exit_cap_rate", e.target.value)} /></div>
              <div className="space-y-1"><Label>Target IRR (%)</Label><Input type="number" step="0.1" value={form.target_irr} onChange={e => sf("target_irr", e.target.value)} placeholder="Optional" /></div>
              <div className="space-y-1"><Label>Target Equity Multiple (x)</Label><Input type="number" step="0.01" value={form.target_equity_multiple} onChange={e => sf("target_equity_multiple", e.target.value)} placeholder="Optional" /></div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" onClick={() => step > 0 ? setStep(step - 1) : setOpen(false)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={createMutation.isPending || !form.address || !form.purchase_price}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
              {createMutation.isPending ? "Creating..." : "Create Property"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
