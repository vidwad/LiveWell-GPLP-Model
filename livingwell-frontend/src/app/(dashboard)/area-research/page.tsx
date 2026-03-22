"use client";

import { AreaResearchTab } from "@/components/property/AreaResearchTab";
import { MapPin } from "lucide-react";

export default function AreaResearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MapPin className="h-6 w-6" />
          Area Research
        </h1>
        <p className="text-muted-foreground mt-1">
          Research any location for comparable sales, zoning, rental market data,
          demographics, and redevelopment potential.
        </p>
      </div>
      <AreaResearchTab />
    </div>
  );
}
