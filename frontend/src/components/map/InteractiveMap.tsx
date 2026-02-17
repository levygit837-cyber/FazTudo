// frontend/src/components/map/InteractiveMap.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { Loader2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import ProfessionalMarker from "./ProfessionalMarker";
import DestinationMarker from "./DestinationMarker";
import LandmarkMarker from "./LandmarkMarker";
import MapLegend from "./MapLegend";
import type {
  InteractiveMapProps,
  RouteInfo,
  LatLng,
} from "../../types";
import { getMapConfig } from "../../services/serviceService";

// Custom FazTudo map styles — clean, minimal, brand-aligned
const FAZTUDO_MAP_STYLES: google.maps.MapTypeStyle[] = [
  // Base geometry — light neutral
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  // Roads
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e8eaed" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadce0" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#c5c8cc" }] },
  // Water — subtle blue
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d7e8" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9eb7d4" }] },
  // POI — hide business clutter
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  // Parks — soft green
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5f5e0" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  // Transit — hide
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

// ==========================================
// Inner map content (must be inside APIProvider)
// ==========================================
const MapContent: React.FC<
  Omit<InteractiveMapProps, "mapId" | "className" | "height"> & {
    mapId?: string;
  }
> = ({
  professionalMarker,
  destinationMarker,
  landmarkMarkers = [],
  showRoute = true,
  onRouteInfo,
  mapId,
}) => {
  const map = useMap();
  const routesLibrary = useMapsLibrary("routes");

  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(
    null
  );

  // Render directions route between professional and destination
  useEffect(() => {
    if (!showRoute || !routesLibrary || !map) return;

    const origin = professionalMarker.position;
    const dest = destinationMarker.position;

    // Create renderer if not exists
    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new routesLibrary.DirectionsRenderer({
        map,
        suppressMarkers: true, // We render our own custom markers
        polylineOptions: {
          strokeColor: "#2563eb", // primary-600
          strokeWeight: 5,
          strokeOpacity: 0.85,
        },
      });
    }

    const directionsService = new routesLibrary.DirectionsService();

    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(dest.lat, dest.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === "OK" && response) {
          directionsRendererRef.current?.setDirections(response);
          const leg = response.routes[0]?.legs[0];
          if (leg) {
            const info: RouteInfo = {
              distance: leg.distance?.text || "",
              duration: leg.duration?.text || "",
            };
            setRouteInfo(info);
            onRouteInfo?.(info);
          }
        }
      }
    );

    // Cleanup renderer on unmount
    return () => {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
    };
  }, [
    showRoute,
    routesLibrary,
    map,
    professionalMarker.position,
    destinationMarker.position,
    onRouteInfo,
  ]);

  // Fit map bounds to show all markers
  useEffect(() => {
    if (!map) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(
      new google.maps.LatLng(
        professionalMarker.position.lat,
        professionalMarker.position.lng
      )
    );
    bounds.extend(
      new google.maps.LatLng(
        destinationMarker.position.lat,
        destinationMarker.position.lng
      )
    );

    landmarkMarkers.forEach((m) => {
      bounds.extend(new google.maps.LatLng(m.position.lat, m.position.lng));
    });

    map.fitBounds(bounds, { top: 60, bottom: 80, left: 40, right: 40 });
  }, [map, professionalMarker, destinationMarker, landmarkMarkers]);

  // Apply custom FazTudo map styles (force 2D roadmap)
  useEffect(() => {
    if (!map) return;
    map.setOptions({
      styles: FAZTUDO_MAP_STYLES,
      mapTypeId: "roadmap",
    });
  }, [map]);

  // Calculate center between the two main markers
  const center: LatLng = {
    lat:
      (professionalMarker.position.lat + destinationMarker.position.lat) / 2,
    lng:
      (professionalMarker.position.lng + destinationMarker.position.lng) / 2,
  };

  return (
    <div className="relative w-full h-full">
      <Map
        defaultCenter={center}
        defaultZoom={13}
        mapId={mapId || "faztudo-interactive-map"}
        gestureHandling="greedy"
        disableDefaultUI={false}
        zoomControl={true}
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={true}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Professional marker */}
        <ProfessionalMarker
          position={professionalMarker.position}
          label={professionalMarker.label}
          subtitle={professionalMarker.subtitle}
        />

        {/* Destination marker */}
        <DestinationMarker
          position={destinationMarker.position}
          label={destinationMarker.label}
          subtitle={destinationMarker.subtitle}
        />

        {/* Landmark markers (street signs, reference points) */}
        {landmarkMarkers.map((marker) => (
          <LandmarkMarker
            key={marker.id}
            position={marker.position}
            label={marker.label}
            type={
              (marker.icon as "street" | "reference" | "warning" | "construction") ||
              "street"
            }
          />
        ))}
      </Map>

      {/* Floating legend */}
      <div className="absolute bottom-3 left-3 z-10">
        <MapLegend />
      </div>

      {/* Route info floating card (top-center) */}
      {routeInfo && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-10 animate-fade-in">
          <div className="flex items-center gap-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {routeInfo.distance}
              </span>
            </div>
            <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {routeInfo.duration}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// Main component with APIProvider wrapper
// ==========================================
const InteractiveMap: React.FC<InteractiveMapProps> = ({
  height = 450,
  className,
  mapId,
  ...contentProps
}) => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load API key from backend
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getMapConfig();
        if (config.apiKey) {
          setApiKey(config.apiKey);
        } else {
          setError("Chave do Google Maps nao configurada");
        }
      } catch {
        setError("Erro ao carregar configuracao do mapa");
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  if (loading) {
    return (
      <div
        className={clsx(
          "flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl",
          className
        )}
        style={{ height }}
      >
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando mapa...</span>
        </div>
      </div>
    );
  }

  if (error || !apiKey) {
    return (
      <div
        className={clsx(
          "flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/30",
          className
        )}
        style={{ height: Math.min(height, 200) }}
      >
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error || "Mapa indisponivel"}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md",
        className
      )}
      style={{ height }}
    >
      <APIProvider apiKey={apiKey}>
        <MapContent mapId={mapId} {...contentProps} />
      </APIProvider>
    </div>
  );
};

export default InteractiveMap;
