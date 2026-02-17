import React, { useState, useCallback, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Loader2, LocateFixed } from "lucide-react";
import { reverseGeocode } from "../../services/geocodingService";
import { useTheme } from "../../context/ThemeContext";
import type { LocationPickerProps } from "../../types";

const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

// Draggable marker handler
const DraggableMarker: React.FC<{
  position: [number, number];
  onDragEnd: (lat: number, lng: number) => void;
}> = ({ position, onDragEnd }) => {
  const markerRef = useRef<L.Marker | null>(null);

  const icon = L.divIcon({
    className: "location-picker-pin",
    html: `
      <div style="
        width: 40px; height: 52px;
        display: flex; flex-direction: column; align-items: center;
      ">
        <div style="
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3" fill="#1d4ed8"/>
          </svg>
        </div>
        <div style="
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid #1d4ed8;
          margin-top: -2px;
        "></div>
      </div>
    `,
    iconSize: [40, 52],
    iconAnchor: [20, 52],
  });

  return (
    <Marker
      position={position}
      icon={icon}
      draggable={true}
      ref={markerRef}
      eventHandlers={{
        dragend: () => {
          const marker = markerRef.current;
          if (marker) {
            const { lat, lng } = marker.getLatLng();
            onDragEnd(lat, lng);
          }
        },
      }}
    />
  );
};

// Click handler to move pin
const ClickHandler: React.FC<{
  onMapClick: (lat: number, lng: number) => void;
}> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Pan to position
const PanTo: React.FC<{ position: [number, number] }> = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, 16, { duration: 1.5 });
  }, [map, position]);
  return null;
};

const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapPosition, setMapPosition] = useState<[number, number]>(
    value.latitude && value.longitude
      ? [value.latitude, value.longitude]
      : [-6.3629, -39.2943] // Default: Iguatu, CE
  );

  const tileUrl = theme === "dark" ? TILES.dark : TILES.light;

  // Handle GPS button click
  const handleUseGPS = useCallback(async () => {
    if (!navigator.geolocation) return;

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setMapPosition([latitude, longitude]);

        // Reverse geocode
        setLoading(true);
        const result = await reverseGeocode(latitude, longitude);
        if (result) {
          onChange({
            ...value,
            street: result.street,
            number: result.number,
            neighborhood: result.neighborhood,
            city: result.city,
            state: result.state,
            zipCode: result.zipCode,
            latitude: result.lat,
            longitude: result.lng,
          });
        } else {
          onChange({ ...value, latitude, longitude });
        }
        setLoading(false);
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [value, onChange]);

  // Handle map pin drag/click
  const handleMapMove = useCallback(
    async (lat: number, lng: number) => {
      setMapPosition([lat, lng]);
      setLoading(true);

      const result = await reverseGeocode(lat, lng);
      if (result) {
        onChange({
          ...value,
          street: result.street,
          number: result.number,
          neighborhood: result.neighborhood,
          city: result.city,
          state: result.state,
          zipCode: result.zipCode,
          latitude: result.lat,
          longitude: result.lng,
        });
      } else {
        onChange({ ...value, latitude: lat, longitude: lng });
      }
      setLoading(false);
    },
    [value, onChange]
  );

  // Handle form field changes
  const handleFieldChange = (field: string, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <MapPin className="w-4 h-4 text-primary-500" />
        Endereco do Servico
      </label>

      {/* GPS Button */}
      <button
        type="button"
        onClick={handleUseGPS}
        disabled={gpsLoading}
        className="btn btn-outline w-full py-2.5 flex items-center justify-center gap-2 text-sm"
      >
        {gpsLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <LocateFixed className="w-4 h-4" />
        )}
        Usar minha localizacao atual
      </button>

      {/* Address fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Rua</label>
          <input
            type="text"
            value={value.street}
            onChange={(e) => handleFieldChange("street", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Nome da rua"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Numero</label>
          <input
            type="text"
            value={value.number}
            onChange={(e) => handleFieldChange("number", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="123"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Complemento</label>
          <input
            type="text"
            value={value.complement || ""}
            onChange={(e) => handleFieldChange("complement", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Apto, bloco..."
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Bairro</label>
          <input
            type="text"
            value={value.neighborhood}
            onChange={(e) => handleFieldChange("neighborhood", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Bairro"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">CEP</label>
          <input
            type="text"
            value={value.zipCode}
            onChange={(e) => handleFieldChange("zipCode", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="00000-000"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Cidade</label>
          <input
            type="text"
            value={value.city}
            onChange={(e) => handleFieldChange("city", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Cidade"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Estado</label>
          <input
            type="text"
            value={value.state}
            onChange={(e) => handleFieldChange("state", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="UF"
            maxLength={2}
          />
        </div>
      </div>

      {/* Mini map */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm" style={{ height: "220px" }}>
        <MapContainer
          center={mapPosition}
          zoom={15}
          scrollWheelZoom={true}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url={tileUrl} />
          <PanTo position={mapPosition} />
          <DraggableMarker position={mapPosition} onDragEnd={handleMapMove} />
          <ClickHandler onMapClick={handleMapMove} />
        </MapContainer>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
        Arraste o marcador ou clique no mapa para ajustar a localizacao
      </p>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Buscando endereco...
        </div>
      )}

      {/* Confirmed address display */}
      {value.street && value.number && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800/30">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-400">Endereco confirmado</span>
          </div>
          <p className="text-sm text-green-800 dark:text-green-300">
            {value.street}, {value.number}
            {value.complement ? ` - ${value.complement}` : ""}
            {" - "}
            {value.neighborhood}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">
            {value.city}, {value.state} {value.zipCode && `- ${value.zipCode}`}
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
