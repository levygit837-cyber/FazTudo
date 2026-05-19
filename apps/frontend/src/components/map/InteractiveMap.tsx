import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import MapLegend from "./MapLegend";
import { professionalIcon, destinationIcon, landmarkIcon } from "./leafletIcons";
import type { InteractiveMapProps, RouteInfo, LatLng } from "../../types";
import { getDirections, decodePolyline } from "../../services/geocodingService";

// Component to fit map bounds
const FitBounds: React.FC<{ bounds: L.LatLngBoundsExpression }> = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, bounds]);
  return null;
};

// Main InteractiveMap with Leaflet
const InteractiveMap: React.FC<InteractiveMapProps> = ({
  professionalMarker,
  destinationMarker,
  landmarkMarkers = [],
  showRoute = true,
  onRouteInfo,
  height = 450,
  className,
}) => {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routePolyline, setRoutePolyline] = useState<Array<[number, number]>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch route from backend proxy
  useEffect(() => {
    if (!showRoute) return;

    const fetchRoute = async () => {
      setLoading(true);
      try {
        const result = await getDirections(
          professionalMarker.position,
          destinationMarker.position,
        );

        if (result) {
          const info: RouteInfo = {
            distance: result.distance,
            duration: result.duration,
          };
          setRouteInfo(info);
          onRouteInfo?.(info);
          setRoutePolyline(decodePolyline(result.polyline));
        }
      } catch {
        setError("Erro ao calcular rota");
      } finally {
        setLoading(false);
      }
    };

    fetchRoute();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showRoute,
    professionalMarker.position.lat,
    professionalMarker.position.lng,
    destinationMarker.position.lat,
    destinationMarker.position.lng,
  ]);

  // Calculate bounds
  const allPoints: LatLng[] = [
    professionalMarker.position,
    destinationMarker.position,
    ...landmarkMarkers.map((m) => m.position),
  ];

  const bounds = L.latLngBounds(
    allPoints.map((p) => [p.lat, p.lng] as [number, number]),
  );

  const center: [number, number] = [
    (professionalMarker.position.lat + destinationMarker.position.lat) / 2,
    (professionalMarker.position.lng + destinationMarker.position.lng) / 2,
  ];

  if (error) {
    return (
      <div
        className={clsx(
          "flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/30",
          className,
        )}
        style={{ height: Math.min(height, 200) }}
      >
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md relative",
        className,
      )}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <FitBounds bounds={bounds} />

        {/* Route polyline */}
        {routePolyline.length > 0 && (
          <Polyline
            positions={routePolyline}
            pathOptions={{
              color: "#2563eb",
              weight: 5,
              opacity: 0.85,
            }}
          />
        )}

        {/* Professional marker */}
        <Marker
          position={[professionalMarker.position.lat, professionalMarker.position.lng]}
          icon={professionalIcon}
        >
          <Popup>
            <div className="text-sm font-semibold">{professionalMarker.label}</div>
            {professionalMarker.subtitle && (
              <div className="text-xs text-slate-500">{professionalMarker.subtitle}</div>
            )}
          </Popup>
        </Marker>

        {/* Destination marker */}
        <Marker
          position={[destinationMarker.position.lat, destinationMarker.position.lng]}
          icon={destinationIcon}
        >
          <Popup>
            <div className="text-sm font-semibold">{destinationMarker.label}</div>
            {destinationMarker.subtitle && (
              <div className="text-xs text-slate-500">{destinationMarker.subtitle}</div>
            )}
          </Popup>
        </Marker>

        {/* Landmark markers */}
        {landmarkMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.position.lat, marker.position.lng]}
            icon={landmarkIcon}
          >
            <Popup>
              <div className="text-xs font-medium">{marker.label}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating legend */}
      <div className="absolute bottom-3 left-3 z-[1000]">
        <MapLegend />
      </div>

      {/* Route info floating card */}
      {routeInfo && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-[1000] animate-fade-in">
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

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 z-[1001]">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Calculando rota...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;
