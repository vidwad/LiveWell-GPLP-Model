"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  Building2,
  DollarSign,
  Home,
  Landmark,
  HardHat,
  MapPin,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface LatLng {
  lat: number;
  lng: number;
}

interface MapMarker {
  id: string;
  position: LatLng;
  type: "subject" | "comp" | "listing" | "rezoning" | "development";
  title: string;
  details: Record<string, string | number | undefined>;
}

interface AreaResearchMapProps {
  subjectLocation?: LatLng;
  address: string;
  city: string;
  radiusMiles: number;
  comparableSales?: Array<{
    address: string;
    lat?: number;
    lng?: number;
    sale_price: number;
    sale_date: string;
    property_type: string;
    bedrooms: number;
    price_per_sqft: number;
    notes?: string;
  }>;
  activeListings?: Array<{
    address: string;
    lat?: number;
    lng?: number;
    list_price: number;
    property_type: string;
    bedrooms: number;
    days_on_market: number;
    status: string;
  }>;
  rezoningActivity?: Array<{
    location: string;
    lat?: number;
    lng?: number;
    from_zone: string;
    to_zone: string;
    status: string;
    description: string;
  }>;
  developmentActivity?: Array<{
    project_name: string;
    location: string;
    lat?: number;
    lng?: number;
    type: string;
    units?: number | null;
    status: string;
    description: string;
  }>;
  rentalMarket?: {
    average_rent_1br: number;
    average_rent_2br: number;
    average_rent_3br: number;
    average_rent_per_bed: number;
    vacancy_rate_pct: number;
  };
  marketInsights?: {
    median_home_price: number;
    investment_grade: string;
    opportunity_score: number;
    avg_days_on_market: number;
  };
  redevelopmentPotential?: {
    score: number;
    best_use_recommendation: string;
    estimated_arv: number;
  };
}

/* ── Marker Pin Components ─────────────────────────────────────────────── */

function MarkerPin({
  type,
  label,
}: {
  type: MapMarker["type"];
  label?: string;
}) {
  const config = {
    subject: {
      bg: "bg-red-600",
      border: "border-red-800",
      icon: <MapPin className="h-4 w-4 text-white" />,
    },
    comp: {
      bg: "bg-green-600",
      border: "border-green-800",
      icon: <DollarSign className="h-3.5 w-3.5 text-white" />,
    },
    listing: {
      bg: "bg-blue-600",
      border: "border-blue-800",
      icon: <Home className="h-3.5 w-3.5 text-white" />,
    },
    rezoning: {
      bg: "bg-purple-600",
      border: "border-purple-800",
      icon: <Landmark className="h-3.5 w-3.5 text-white" />,
    },
    development: {
      bg: "bg-orange-500",
      border: "border-orange-700",
      icon: <HardHat className="h-3.5 w-3.5 text-white" />,
    },
  };

  const c = config[type];
  const isSubject = type === "subject";

  return (
    <div className="relative flex flex-col items-center">
      <div
        className={cn(
          "flex items-center justify-center rounded-full border-2 shadow-lg cursor-pointer",
          c.bg,
          c.border,
          isSubject ? "h-10 w-10" : "h-7 w-7",
          "hover:scale-110 transition-transform"
        )}
      >
        {c.icon}
      </div>
      {label && (
        <div className="absolute -bottom-5 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold shadow-sm border">
          {label}
        </div>
      )}
      {/* Pin tail */}
      <div
        className={cn(
          "h-2 w-2 rotate-45 -mt-1",
          c.bg,
          isSubject ? "h-2.5 w-2.5" : ""
        )}
      />
    </div>
  );
}

/* ── Radius Circle ─────────────────────────────────────────────────────── */

function RadiusCircle({
  center,
  radiusMiles,
}: {
  center: LatLng;
  radiusMiles: number;
}) {
  const map = useMap();

  React.useEffect(() => {
    if (!map || !window.google?.maps) return;

    const circle = new window.google.maps.Circle({
      map,
      center,
      radius: radiusMiles * 1609.34, // miles to meters
      fillColor: "#3b82f6",
      fillOpacity: 0.06,
      strokeColor: "#3b82f6",
      strokeOpacity: 0.3,
      strokeWeight: 2,
    });

    return () => {
      circle.setMap(null);
    };
  }, [map, center, radiusMiles]);

  return null;
}

/* ── Layer Toggle ──────────────────────────────────────────────────────── */

type LayerKey = "comps" | "listings" | "rezoning" | "development";

const LAYER_CONFIG: Record<
  LayerKey,
  { label: string; color: string; icon: React.ReactNode }
> = {
  comps: {
    label: "Comp Sales",
    color: "bg-green-600",
    icon: <DollarSign className="h-3 w-3" />,
  },
  listings: {
    label: "Listings",
    color: "bg-blue-600",
    icon: <Home className="h-3 w-3" />,
  },
  rezoning: {
    label: "Rezoning",
    color: "bg-purple-600",
    icon: <Landmark className="h-3 w-3" />,
  },
  development: {
    label: "Dev Projects",
    color: "bg-orange-500",
    icon: <HardHat className="h-3 w-3" />,
  },
};

/* ── Info Card Overlay (top-right) ─────────────────────────────────────── */

function MapOverlayCard({
  rentalMarket,
  marketInsights,
  redevelopmentPotential,
}: Pick<
  AreaResearchMapProps,
  "rentalMarket" | "marketInsights" | "redevelopmentPotential"
>) {
  const [collapsed, setCollapsed] = useState(false);

  if (!rentalMarket && !marketInsights && !redevelopmentPotential) return null;

  return (
    <div className="absolute top-3 right-3 z-10 max-w-[220px]">
      <Card className="shadow-lg border-0 bg-white/95 backdrop-blur-sm">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Area Snapshot
            </p>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-muted-foreground hover:text-foreground"
            >
              {collapsed ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
            </button>
          </div>

          {!collapsed && (
            <>
              {marketInsights && (
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-muted-foreground">
                      Median Price
                    </span>
                    <span className="text-xs font-bold">
                      {formatCurrency(marketInsights.median_home_price)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-muted-foreground">
                      Avg DOM
                    </span>
                    <span className="text-xs font-bold">
                      {marketInsights.avg_days_on_market} days
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-muted-foreground">
                      Grade
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-4 px-1.5"
                    >
                      {marketInsights.investment_grade}
                    </Badge>
                  </div>
                </div>
              )}

              {rentalMarket && (
                <>
                  <div className="border-t pt-1.5 space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-muted-foreground">
                        1BR Rent
                      </span>
                      <span className="text-xs font-bold">
                        {formatCurrency(rentalMarket.average_rent_1br)}/mo
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-muted-foreground">
                        Per-Bed
                      </span>
                      <span className="text-xs font-bold text-blue-700">
                        {formatCurrency(rentalMarket.average_rent_per_bed)}/mo
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-muted-foreground">
                        Vacancy
                      </span>
                      <span className="text-xs font-bold">
                        {rentalMarket.vacancy_rate_pct}%
                      </span>
                    </div>
                  </div>
                </>
              )}

              {redevelopmentPotential && (
                <div className="border-t pt-1.5 space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-muted-foreground">
                      Redev Score
                    </span>
                    <span
                      className={cn(
                        "text-xs font-bold",
                        redevelopmentPotential.score >= 7
                          ? "text-green-600"
                          : redevelopmentPotential.score >= 4
                            ? "text-yellow-600"
                            : "text-red-600"
                      )}
                    >
                      {redevelopmentPotential.score}/10
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-muted-foreground">
                      Est. ARV
                    </span>
                    <span className="text-xs font-bold text-green-700">
                      {formatCurrency(redevelopmentPotential.estimated_arv)}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">
                    {redevelopmentPotential.best_use_recommendation}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Main Map Component ────────────────────────────────────────────────── */

const MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export function AreaResearchMap({
  subjectLocation,
  address,
  city,
  radiusMiles,
  comparableSales,
  activeListings,
  rezoningActivity,
  developmentActivity,
  rentalMarket,
  marketInsights,
  redevelopmentPotential,
}: AreaResearchMapProps) {
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    comps: true,
    listings: true,
    rezoning: true,
    development: true,
  });

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Build markers
  const markers = useMemo(() => {
    const result: MapMarker[] = [];

    // Subject property
    if (subjectLocation) {
      result.push({
        id: "subject",
        position: subjectLocation,
        type: "subject",
        title: address,
        details: { City: city },
      });
    }

    // Comparable sales
    if (layers.comps && comparableSales) {
      comparableSales.forEach((comp, i) => {
        if (comp.lat && comp.lng) {
          result.push({
            id: `comp-${i}`,
            position: { lat: comp.lat, lng: comp.lng },
            type: "comp",
            title: comp.address,
            details: {
              "Sale Price": formatCurrency(comp.sale_price),
              Date: comp.sale_date,
              Type: comp.property_type,
              Beds: comp.bedrooms,
              "$/sqft": `$${comp.price_per_sqft}`,
              Notes: comp.notes,
            },
          });
        }
      });
    }

    // Active listings
    if (layers.listings && activeListings) {
      activeListings.forEach((listing, i) => {
        if (listing.lat && listing.lng) {
          result.push({
            id: `listing-${i}`,
            position: { lat: listing.lat, lng: listing.lng },
            type: "listing",
            title: listing.address,
            details: {
              "List Price": formatCurrency(listing.list_price),
              Type: listing.property_type,
              Beds: listing.bedrooms,
              DOM: listing.days_on_market,
              Status: listing.status,
            },
          });
        }
      });
    }

    // Rezoning
    if (layers.rezoning && rezoningActivity) {
      rezoningActivity.forEach((rz, i) => {
        if (rz.lat && rz.lng) {
          result.push({
            id: `rz-${i}`,
            position: { lat: rz.lat, lng: rz.lng },
            type: "rezoning",
            title: rz.location,
            details: {
              Change: `${rz.from_zone} → ${rz.to_zone}`,
              Status: rz.status,
              Description: rz.description,
            },
          });
        }
      });
    }

    // Development
    if (layers.development && developmentActivity) {
      developmentActivity.forEach((dev, i) => {
        if (dev.lat && dev.lng) {
          result.push({
            id: `dev-${i}`,
            position: { lat: dev.lat, lng: dev.lng },
            type: "development",
            title: dev.project_name,
            details: {
              Location: dev.location,
              Type: dev.type,
              Units: dev.units ?? "N/A",
              Status: dev.status,
              Description: dev.description,
            },
          });
        }
      });
    }

    return result;
  }, [
    subjectLocation,
    address,
    city,
    comparableSales,
    activeListings,
    rezoningActivity,
    developmentActivity,
    layers,
  ]);

  // Default center
  const center = subjectLocation ?? { lat: 51.0447, lng: -114.0719 };

  // Zoom based on radius
  const zoom =
    radiusMiles <= 1
      ? 15
      : radiusMiles <= 2
        ? 14
        : radiusMiles <= 5
          ? 13
          : radiusMiles <= 10
            ? 12
            : 11;

  if (!MAPS_API_KEY) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Google Maps Not Configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Set <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in
            your environment to enable the interactive map view.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        {/* Layer toggles */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5">
          {(Object.entries(LAYER_CONFIG) as [LayerKey, (typeof LAYER_CONFIG)[LayerKey]][]).map(
            ([key, cfg]) => (
              <button
                key={key}
                onClick={() => toggleLayer(key)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-sm border transition-all",
                  layers[key]
                    ? "bg-white text-gray-800 border-gray-300"
                    : "bg-gray-200/80 text-gray-400 border-gray-200 line-through"
                )}
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    layers[key] ? cfg.color : "bg-gray-300"
                  )}
                />
                {cfg.label}
              </button>
            )
          )}
        </div>

        {/* Overlay card */}
        <MapOverlayCard
          rentalMarket={rentalMarket}
          marketInsights={marketInsights}
          redevelopmentPotential={redevelopmentPotential}
        />

        {/* Google Map */}
        <APIProvider apiKey={MAPS_API_KEY}>
          <Map
            defaultCenter={center}
            defaultZoom={zoom}
            mapId="area-research-map"
            style={{ width: "100%", height: "500px" }}
            gestureHandling="cooperative"
            disableDefaultUI={false}
            zoomControl={true}
            mapTypeControl={true}
            streetViewControl={true}
            fullscreenControl={true}
          >
            {/* Radius circle */}
            <RadiusCircle center={center} radiusMiles={radiusMiles} />

            {/* Markers */}
            {markers.map((marker) => (
              <AdvancedMarker
                key={marker.id}
                position={marker.position}
                onClick={() =>
                  setSelectedMarker(
                    selectedMarker?.id === marker.id ? null : marker
                  )
                }
                zIndex={marker.type === "subject" ? 100 : 10}
              >
                <MarkerPin
                  type={marker.type}
                  label={
                    marker.type === "comp"
                      ? (marker.details["Sale Price"] as string)
                      : marker.type === "listing"
                        ? (marker.details["List Price"] as string)
                        : undefined
                  }
                />
              </AdvancedMarker>
            ))}

            {/* Info Window */}
            {selectedMarker && (
              <InfoWindow
                position={selectedMarker.position}
                onCloseClick={() => setSelectedMarker(null)}
                pixelOffset={[0, -35]}
              >
                <div className="min-w-[180px] max-w-[260px] p-1">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full shrink-0",
                        selectedMarker.type === "subject"
                          ? "bg-red-600"
                          : selectedMarker.type === "comp"
                            ? "bg-green-600"
                            : selectedMarker.type === "listing"
                              ? "bg-blue-600"
                              : selectedMarker.type === "rezoning"
                                ? "bg-purple-600"
                                : "bg-orange-500"
                      )}
                    />
                    <p className="text-sm font-semibold leading-tight">
                      {selectedMarker.title}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    {Object.entries(selectedMarker.details).map(
                      ([key, val]) =>
                        val !== undefined && (
                          <div
                            key={key}
                            className="flex justify-between gap-2 text-xs"
                          >
                            <span className="text-gray-500 shrink-0">
                              {key}
                            </span>
                            <span className="font-medium text-right">
                              {String(val)}
                            </span>
                          </div>
                        )
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>

        {/* Legend */}
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-t text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-600" /> Subject
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-600" /> Comp Sales
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-600" /> Listings
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-purple-600" /> Rezoning
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500" /> Dev Projects
          </span>
          <span className="ml-auto">
            <span className="inline-block h-2 w-4 rounded border border-blue-400 bg-blue-100/40" />{" "}
            {radiusMiles}mi radius
          </span>
        </div>
      </div>
    </Card>
  );
}
