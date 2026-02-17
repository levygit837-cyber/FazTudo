import React, { useState, useEffect } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import { Loader2, AlertCircle, MapPin } from "lucide-react";
import clsx from "clsx";
import { getMapConfig } from "../../services/serviceService";

// Custom FazTudo map styles — clean, minimal, brand-aligned (2D roadmap)
const FAZTUDO_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e8eaed" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadce0" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#c5c8cc" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d7e8" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9eb7d4" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5f5e0" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

interface ProfessionalLocationMapProps {
  latitude: number;
  longitude: number;
  label?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  className?: string;
  height?: number;
}

// Inner map content (must be inside APIProvider)
const MapContent: React.FC<{
  latitude: number;
  longitude: number;
  label?: string;
}> = ({ latitude, longitude, label }) => {
  const map = useMap();

  // Apply custom FazTudo map styles (force 2D roadmap)
  useEffect(() => {
    if (!map) return;
    map.setOptions({
      styles: FAZTUDO_MAP_STYLES,
      mapTypeId: "roadmap",
    });
  }, [map]);

  const position = { lat: latitude, lng: longitude };

  return (
    <Map
      defaultCenter={position}
      defaultZoom={14}
      mapId="faztudo-professional-location"
      gestureHandling="cooperative"
      disableDefaultUI={false}
      zoomControl={true}
      streetViewControl={false}
      mapTypeControl={false}
      fullscreenControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <AdvancedMarker position={position} title={label || "Localizacao do profissional"}>
        <Pin background="#2563eb" glyphColor="#fff" borderColor="#1d4ed8" />
      </AdvancedMarker>
    </Map>
  );
};

const ProfessionalLocationMap: React.FC<ProfessionalLocationMapProps> = ({
  latitude,
  longitude,
  label,
  neighborhood,
  city,
  state,
  className,
  height = 220,
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
        setError("Erro ao carregar mapa");
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  // Build location description string
  const locationParts = [neighborhood, city, state].filter(Boolean);
  const locationText = locationParts.join(", ");

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
          <Loader2 className="w-4 h-4 animate-spin" />
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
        style={{ height: Math.min(height, 120) }}
      >
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error || "Mapa indisponivel"}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx("space-y-2", className)}>
      {/* Location text */}
      {locationText && (
        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-primary-500" />
          <span>{locationText}</span>
        </div>
      )}

      {/* Map container */}
      <div
        className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
        style={{ height }}
      >
        <APIProvider apiKey={apiKey}>
          <MapContent
            latitude={latitude}
            longitude={longitude}
            label={label}
          />
        </APIProvider>
      </div>

      {/* Approximate location notice */}
      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        Localizacao aproximada da regiao de atuacao
      </p>
    </div>
  );
};

export default ProfessionalLocationMap;
