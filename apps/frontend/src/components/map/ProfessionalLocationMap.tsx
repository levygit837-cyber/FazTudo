import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import clsx from "clsx";
import { professionalIconSmall } from "./leafletIcons";

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
  const position: [number, number] = [latitude, longitude];
  const locationParts = [neighborhood, city, state].filter(Boolean);
  const locationText = locationParts.join(", ");

  return (
    <div className={clsx("space-y-2", className)}>
      {locationText && (
        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-primary-500" />
          <span>{locationText}</span>
        </div>
      )}

      <div
        className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
        style={{ height }}
      >
        <MapContainer
          center={position}
          zoom={14}
          scrollWheelZoom={false}
          style={{ width: "100%", height: "100%" }}
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker position={position} icon={professionalIconSmall}>
            <Popup>
              <div className="text-sm font-medium">
                {label || "Localização do profissional"}
              </div>
              {locationText && (
                <div className="text-xs text-slate-500 mt-0.5">{locationText}</div>
              )}
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        Localização aproximada da região de atuação
      </p>
    </div>
  );
};

export default ProfessionalLocationMap;
