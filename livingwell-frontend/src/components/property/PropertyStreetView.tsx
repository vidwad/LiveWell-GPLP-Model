"use client";

import React, { useState, useEffect } from "react";
import { Camera, ExternalLink, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface PropertyStreetViewProps {
  address?: string;
  city?: string;
  province?: string;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Embedded Google Street View panorama for the subject property.
 * Uses the Google Maps Embed API (iframe) — requires a Google Maps API key
 * with the "Maps Embed API" enabled. Key is read from env or platform settings.
 */
export function PropertyStreetView({
  address,
  city,
  province,
  latitude,
  longitude,
}: PropertyStreetViewProps) {
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    process.env.NEXT_PUBLIC_GOOGLE_mapsApiKey ?? ""
  );
  const [keyLoaded, setKeyLoaded] = useState<boolean>(
    Boolean(process.env.NEXT_PUBLIC_GOOGLE_mapsApiKey)
  );

  // Fetch Google Maps key from platform settings if not in env
  useEffect(() => {
    if (!mapsApiKey) {
      import("@/lib/api").then(({ settingsApi }) => {
        settingsApi
          .getAll("api_keys")
          .then((settings: any[]) => {
            const gmKey = settings.find(
              (s: any) => s.key === "GOOGLE_MAPS_API_KEY"
            );
            if (gmKey?.value && !gmKey.value.includes("••")) {
              setMapsApiKey(gmKey.value);
            }
          })
          .catch(() => {})
          .finally(() => setKeyLoaded(true));
      });
    }
  }, [mapsApiKey]);

  const hasCoords =
    latitude != null &&
    longitude != null &&
    !Number.isNaN(Number(latitude)) &&
    !Number.isNaN(Number(longitude));

  const locationParam = hasCoords
    ? `${Number(latitude)},${Number(longitude)}`
    : [address, city, province].filter(Boolean).join(", ");

  const fullMapsUrl = hasCoords
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${Number(latitude)},${Number(longitude)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationParam)}`;

  const embedUrl =
    mapsApiKey && locationParam
      ? `https://www.google.com/maps/embed/v1/streetview?key=${mapsApiKey}&location=${encodeURIComponent(
          locationParam
        )}&heading=0&pitch=0&fov=90`
      : "";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            Street View
          </CardTitle>
          {locationParam && (
            <a
              href={fullMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              Open in Google Maps <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!locationParam ? (
          <div className="flex items-center justify-center h-[320px] bg-muted/20 text-sm text-muted-foreground">
            <div className="text-center">
              <MapPin className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
              No address or coordinates available
            </div>
          </div>
        ) : !mapsApiKey && keyLoaded ? (
          <div className="flex items-center justify-center h-[320px] bg-muted/20 text-sm text-muted-foreground p-6 text-center">
            <div>
              <Camera className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
              <p className="font-medium text-foreground mb-1">
                Google Street View not configured
              </p>
              <p className="text-xs mb-3">
                Add a <code className="px-1 bg-muted rounded">GOOGLE_MAPS_API_KEY</code>{" "}
                with the Maps Embed API enabled to view Street View.
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background h-9 px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Configure API Key
              </Link>
            </div>
          </div>
        ) : embedUrl ? (
          <iframe
            title="Google Street View"
            src={embedUrl}
            className="w-full h-[320px] border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <div className="flex items-center justify-center h-[320px] bg-muted/20 text-sm text-muted-foreground">
            Loading Street View…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
