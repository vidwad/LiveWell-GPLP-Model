"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, BedDouble, DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface BedroomConfig {
  bedroom_number: number;
  beds: number;
  rent_per_bed: number;
}

export interface UnitConfig {
  unit_number: string;
  unit_type: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  floor: string;
  bedroom_configs: BedroomConfig[];
}

interface UnitConfiguratorProps {
  units: UnitConfig[];
  onChange: (units: UnitConfig[]) => void;
  defaultRentPerBed?: number;
  compact?: boolean;
  label?: string;
}

const UNIT_TYPES = [
  { value: "house", label: "House" },
  { value: "shared", label: "Shared House" },
  { value: "studio", label: "Studio" },
  { value: "1br", label: "1 Bedroom" },
  { value: "2br", label: "2 Bedroom" },
  { value: "3br", label: "3 Bedroom" },
  { value: "4br", label: "4 Bedroom" },
  { value: "5br+", label: "5+ Bedroom" },
  { value: "suite", label: "Suite" },
  { value: "duplex", label: "Duplex" },
];

function createDefaultUnit(index: number, defaultRent: number): UnitConfig {
  return {
    unit_number: index === 0 ? "House" : `Unit ${100 + index}`,
    unit_type: index === 0 ? "house" : "2br",
    bedrooms: 3,
    bathrooms: 1,
    sqft: 800,
    floor: "Main",
    bedroom_configs: [
      { bedroom_number: 1, beds: 1, rent_per_bed: defaultRent },
      { bedroom_number: 2, beds: 1, rent_per_bed: defaultRent },
      { bedroom_number: 3, beds: 1, rent_per_bed: defaultRent },
    ],
  };
}

export function UnitConfigurator({ units, onChange, defaultRentPerBed = 700, compact = false, label }: UnitConfiguratorProps) {
  const addUnit = () => {
    onChange([...units, createDefaultUnit(units.length, defaultRentPerBed)]);
  };

  const removeUnit = (idx: number) => {
    onChange(units.filter((_, i) => i !== idx));
  };

  const updateUnit = (idx: number, updates: Partial<UnitConfig>) => {
    const updated = [...units];
    updated[idx] = { ...updated[idx], ...updates };

    // If bedrooms changed, sync bedroom_configs
    if (updates.bedrooms !== undefined) {
      const current = updated[idx].bedroom_configs;
      const target = updates.bedrooms;
      if (target > current.length) {
        // Add bedrooms
        for (let i = current.length; i < target; i++) {
          current.push({ bedroom_number: i + 1, beds: 1, rent_per_bed: defaultRentPerBed });
        }
      } else if (target < current.length) {
        // Remove bedrooms from end
        current.splice(target);
      }
      updated[idx].bedroom_configs = [...current];
    }

    onChange(updated);
  };

  const updateBedroom = (unitIdx: number, brIdx: number, updates: Partial<BedroomConfig>) => {
    const updated = [...units];
    const configs = [...updated[unitIdx].bedroom_configs];
    configs[brIdx] = { ...configs[brIdx], ...updates };
    updated[unitIdx] = { ...updated[unitIdx], bedroom_configs: configs };
    onChange(updated);
  };

  // Totals
  const totalBedrooms = units.reduce((s, u) => s + u.bedrooms, 0);
  const totalBeds = units.reduce((s, u) => s + u.bedroom_configs.reduce((bs, br) => bs + br.beds, 0), 0);
  const totalRent = units.reduce((s, u) => s + u.bedroom_configs.reduce((bs, br) => bs + br.beds * br.rent_per_bed, 0), 0);

  return (
    <div className="space-y-4">
      {label && <p className="text-sm font-semibold">{label}</p>}

      {/* Summary strip */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
        <span><strong className="text-foreground">{units.length}</strong> unit{units.length !== 1 ? "s" : ""}</span>
        <span><strong className="text-foreground">{totalBedrooms}</strong> bedroom{totalBedrooms !== 1 ? "s" : ""}</span>
        <span><strong className="text-foreground">{totalBeds}</strong> bed{totalBeds !== 1 ? "s" : ""}</span>
        <span className="ml-auto"><strong className="text-foreground">${totalRent.toLocaleString()}</strong>/mo</span>
      </div>

      {/* Unit cards */}
      {units.map((unit, ui) => (
        <Card key={ui} className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            {/* Unit header row */}
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Unit Name</Label>
                <Input value={unit.unit_number} onChange={e => updateUnit(ui, { unit_number: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="w-32 space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={unit.unit_type} onValueChange={v => updateUnit(ui, { unit_type: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-xs">Bedrooms</Label>
                <Input type="number" min={1} max={10} value={unit.bedrooms} onChange={e => updateUnit(ui, { bedrooms: Number(e.target.value) || 1 })} className="h-8 text-sm" />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-xs">Baths</Label>
                <Input type="number" min={0} max={10} step={0.5} value={unit.bathrooms} onChange={e => updateUnit(ui, { bathrooms: Number(e.target.value) || 1 })} className="h-8 text-sm" />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-xs">Sqft</Label>
                <Input type="number" value={unit.sqft} onChange={e => updateUnit(ui, { sqft: Number(e.target.value) || 0 })} className="h-8 text-sm" />
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-xs">Floor</Label>
                <Input value={unit.floor} onChange={e => updateUnit(ui, { floor: e.target.value })} className="h-8 text-sm" placeholder="Main" />
              </div>
              {units.length > 1 && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={() => removeUnit(ui)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Bedroom > Bed configuration */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <DoorOpen className="h-3 w-3" /> Bedroom Configuration
              </p>
              <div className="space-y-1.5">
                {unit.bedroom_configs.map((br, bi) => (
                  <div key={bi} className="flex items-center gap-3 text-sm">
                    <span className="w-24 text-xs text-muted-foreground shrink-0">Bedroom {br.bedroom_number}</span>
                    <div className="flex items-center gap-1.5">
                      <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="number" min={1} max={4}
                        value={br.beds}
                        onChange={e => updateBedroom(ui, bi, { beds: Number(e.target.value) || 1 })}
                        className="h-7 w-16 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">bed{br.beds !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        value={br.rent_per_bed}
                        onChange={e => updateBedroom(ui, bi, { rent_per_bed: Number(e.target.value) || 0 })}
                        className="h-7 w-20 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">/bed/mo</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                      = ${(br.beds * br.rent_per_bed).toLocaleString()}/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" size="sm" onClick={addUnit} className="w-full">
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Unit
      </Button>
    </div>
  );
}

// ── Helper: Convert UnitConfig[] to API-ready format ──

export function unitConfigsToApiPayload(configs: UnitConfig[]): {
  units: Array<{
    unit_number: string;
    unit_type: string;
    bed_count: number;
    bedroom_count: number;
    sqft: number;
    floor: string;
    beds: Array<{ bed_label: string; monthly_rent: number; bedroom_number: number }>;
  }>;
} {
  return {
    units: configs.map(u => ({
      unit_number: u.unit_number,
      unit_type: u.unit_type,
      bed_count: u.bedroom_configs.reduce((s, br) => s + br.beds, 0),
      bedroom_count: u.bedrooms,
      sqft: u.sqft,
      floor: u.floor,
      beds: u.bedroom_configs.flatMap(br =>
        Array.from({ length: br.beds }, (_, i) => ({
          bed_label: u.bedrooms === 1 && br.beds === 1
            ? `${u.unit_number}`
            : `BR${br.bedroom_number}-B${i + 1}`,
          monthly_rent: br.rent_per_bed,
          bedroom_number: br.bedroom_number,
        }))
      ),
    })),
  };
}
