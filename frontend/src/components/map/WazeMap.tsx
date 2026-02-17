import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Navigation,
  Loader2,
  AlertCircle,
  Clock,
  X,
} from "lucide-react";
import { useGeolocation } from "../../hooks/useGeolocation";
import {
  startRoute as apiStartRoute,
  updateProfessionalLocation,
  getProfessionalLocation,
  clearProfessionalLocation,
} from "../../services/serviceService";
import {
  geocode,
  getDirections,
  decodePolyline,
  getRouteAlerts,
} from "../../services/geocodingService";
import { createWazeAvatarIcon, createWazeDestinationIcon, createAlertIcon } from "./wazeIcons";
import WazeInfoBar from "./WazeInfoBar";
import WazeControls from "./WazeControls";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import type { WazeMapProps, RoadAlert } from "../../types";

// Tile URLs
const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

// Camera controller sub-component
const CameraController: React.FC<{
  target: [number, number] | null;
  fitPoints: Array<[number, number]>;
  followMode: boolean;
}> = ({ target, fitPoints, followMode }) => {
  const map = useMap();
  const hasFlownRef = useRef(false);

  useEffect(() => {
    if (followMode && target && !hasFlownRef.current) {
      map.flyTo(target, 16, { duration: 2 });
      hasFlownRef.current = true;
    } else if (followMode && target) {
      map.panTo(target, { animate: true, duration: 0.8 });
    }
  }, [map, target, followMode]);

  // Fit bounds when not in follow mode
  useEffect(() => {
    if (!followMode && fitPoints.length >= 2) {
      const bounds = L.latLngBounds(fitPoints);
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [map, fitPoints, followMode]);

  return null;
};

// Map controller for external zoom/center
interface MapControllerHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  center: (pos: [number, number]) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface MapControllerProps {}

const MapController = React.forwardRef<MapControllerHandle, MapControllerProps>((_, ref) => {
  const map = useMap();

  React.useImperativeHandle(ref, () => ({
    zoomIn: () => map.zoomIn(),
    zoomOut: () => map.zoomOut(),
    center: (pos: [number, number]) => map.flyTo(pos, map.getZoom(), { duration: 1 }),
  }));

  return null;
});
MapController.displayName = "MapController";

const WazeMap: React.FC<WazeMapProps> = ({
  orderId,
  isProfessional,
  professionalName,
  destinationAddress,
  orderStatus: _orderStatus,
}) => {
  const toast = useToast();
  const { theme } = useTheme();

  // State
  const [routeStarted, setRouteStarted] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [routePolyline, setRoutePolyline] = useState<Array<[number, number]>>([]);
  const [professionalPos, setProfessionalPos] = useState<{ lat: number; lng: number; bearing: number | null } | null>(null);
  const [startingRoute, setStartingRoute] = useState(false);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(
    destinationAddress.latitude && destinationAddress.longitude
      ? { lat: destinationAddress.latitude, lng: destinationAddress.longitude }
      : null
  );
  const [geocodingDest, setGeocodingDest] = useState(false);
  const [alerts, setAlerts] = useState<RoadAlert[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [progressIndex, setProgressIndex] = useState(0);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapControllerRef = useRef<MapControllerHandle | null>(null);

  // Geocode destination address if no lat/lng
  useEffect(() => {
    if (destination) return;

    const doGeocode = async () => {
      setGeocodingDest(true);
      const addressStr = `${destinationAddress.street}, ${destinationAddress.number}, ${destinationAddress.neighborhood}, ${destinationAddress.city}, ${destinationAddress.state}, Brasil`;
      const result = await geocode(addressStr);
      if (result) {
        setDestination({ lat: result.lat, lng: result.lng });
      } else {
        setDestination({ lat: -6.3629, lng: -39.2943 }); // Fallback: Iguatu, CE
      }
      setGeocodingDest(false);
    };

    doGeocode();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  // Professional: track own position
  const handleLocationUpdate = useCallback(
    async (lat: number, lng: number) => {
      if (!routeStarted) return;
      try {
        await updateProfessionalLocation(orderId, lat, lng);
      } catch {
        // Silent fail — best-effort
      }
    },
    [orderId, routeStarted]
  );

  const geo = useGeolocation({
    watchPosition: isProfessional && routeStarted,
    enableHighAccuracy: true,
    updateInterval: 5000,
    onUpdate: isProfessional ? handleLocationUpdate : undefined,
  });

  // Client: poll professional's location
  useEffect(() => {
    if (isProfessional) return;

    const pollLocation = async () => {
      try {
        const loc = await getProfessionalLocation(orderId);
        if (loc) {
          setProfessionalPos({ lat: loc.lat, lng: loc.lng, bearing: loc.bearing ?? null });
        }
      } catch {
        // Silent fail
      }
    };

    pollLocation();
    pollIntervalRef.current = setInterval(pollLocation, 5000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isProfessional, orderId]);

  // Determine origin
  const origin = isProfessional
    ? geo.latitude && geo.longitude
      ? { lat: geo.latitude, lng: geo.longitude, bearing: geo.bearing }
      : null
    : professionalPos;

  // Fetch directions
  useEffect(() => {
    if (!origin || !destination) return;

    const fetchDirections = async () => {
      const result = await getDirections(origin, destination);
      if (result) {
        setRouteInfo({ distance: result.distance, duration: result.duration });
        const decoded = decodePolyline(result.polyline);
        setRoutePolyline(decoded);

        // Fetch road alerts
        if (decoded.length > 0) {
          const routeAlerts = await getRouteAlerts(decoded);
          setAlerts(routeAlerts);
        }
      }
    };

    fetchDirections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  // Calculate progress index (closest polyline point to professional)
  useEffect(() => {
    if (!origin || routePolyline.length === 0) return;

    let minDist = Infinity;
    let minIdx = 0;
    for (let i = 0; i < routePolyline.length; i++) {
      const dx = routePolyline[i][0] - origin.lat;
      const dy = routePolyline[i][1] - origin.lng;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    }
    setProgressIndex(minIdx);
  }, [origin, routePolyline]);

  // Handle "Start Route"
  const handleStartRoute = async () => {
    try {
      setStartingRoute(true);
      await apiStartRoute(orderId);
      setRouteStarted(true);
      toast.success("Trajeto iniciado! O cliente foi notificado.");
    } catch (err: any) {
      toast.error("Erro", err?.response?.data?.message || "Erro ao iniciar trajeto");
    } finally {
      setStartingRoute(false);
    }
  };

  // Handle stop route
  const handleStopRoute = async () => {
    try {
      setRouteStarted(false);
      geo.stopWatching();
      await clearProfessionalLocation(orderId);
      setRoutePolyline([]);
      setRouteInfo(null);
      setAlerts([]);
    } catch {
      // Silent fail
    }
  };

  // Map controls
  const handleZoomIn = () => mapControllerRef.current?.zoomIn();
  const handleZoomOut = () => mapControllerRef.current?.zoomOut();
  const handleCenter = () => {
    if (origin) mapControllerRef.current?.center([origin.lat, origin.lng]);
  };

  // Derived values
  const destinationLabel = `${destinationAddress.street}, ${destinationAddress.number} - ${destinationAddress.neighborhood}`;
  const tileUrl = theme === "dark" ? TILES.dark : TILES.light;
  const isFollowing = routeStarted && !!origin;

  // Remaining polyline (from progress index onward)
  const remainingPolyline = routePolyline.slice(progressIndex);
  // Fading polyline (last 5 points before progress, with opacity)
  const fadingPolyline = routePolyline.slice(Math.max(0, progressIndex - 5), progressIndex + 1);

  // Loading states
  if (isProfessional && geo.loading && !geo.latitude) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Obtendo sua localizacao...
      </div>
    );
  }

  if (isProfessional && geo.error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-700 dark:text-red-400 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        {geo.error}
      </div>
    );
  }

  if (!destination || geocodingDest) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Localizando endereco...
      </div>
    );
  }

  // Fit bounds
  const fitPoints: Array<[number, number]> = [];
  if (origin) fitPoints.push([origin.lat, origin.lng]);
  fitPoints.push([destination.lat, destination.lng]);

  const avatarBearing = isProfessional ? geo.bearing : professionalPos?.bearing ?? null;

  return (
    <div className="space-y-4">
      {/* Map container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg" style={{ height: "420px" }}>
        <MapContainer
          center={[destination.lat, destination.lng]}
          zoom={13}
          scrollWheelZoom={true}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url={tileUrl}
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          <MapController ref={mapControllerRef} />

          <CameraController
            target={origin ? [origin.lat, origin.lng] : null}
            fitPoints={fitPoints}
            followMode={isFollowing}
          />

          {/* Fading trail (behind professional) */}
          {fadingPolyline.length > 1 && routeStarted && (
            <Polyline
              positions={fadingPolyline}
              pathOptions={{
                color: "#93c5fd",
                weight: 5,
                opacity: 0.3,
                dashArray: "4 8",
              }}
            />
          )}

          {/* Remaining route */}
          {remainingPolyline.length > 1 && (
            <Polyline
              positions={remainingPolyline}
              pathOptions={{
                color: "#2563eb",
                weight: 5,
                opacity: 0.85,
              }}
            />
          )}

          {/* Progress indicator (glowing dot at professional's position on route) */}
          {routeStarted && routePolyline[progressIndex] && (
            <Marker
              position={routePolyline[progressIndex]}
              icon={L.divIcon({
                className: "waze-progress-dot",
                html: `<div style="
                  width: 16px; height: 16px;
                  background: #3b82f6;
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 0 8px rgba(59,130,246,0.6);
                  animation: waze-glow-pulse 1.5s ease-in-out infinite;
                "></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            />
          )}

          {/* Road alerts */}
          {alertsEnabled && alerts.map((alert) => (
            <Marker
              key={alert.id}
              position={[alert.position.lat, alert.position.lng]}
              icon={createAlertIcon(alert.type)}
            >
              <Popup>
                <div className="text-xs font-medium">{alert.description}</div>
              </Popup>
            </Marker>
          ))}

          {/* Destination marker */}
          <Marker
            position={[destination.lat, destination.lng]}
            icon={createWazeDestinationIcon(destinationAddress.number)}
          >
            <Popup>
              <div className="text-sm font-semibold">{destinationLabel}</div>
              <div className="text-xs text-slate-500">{destinationAddress.city}, {destinationAddress.state}</div>
            </Popup>
          </Marker>

          {/* Professional avatar */}
          {origin && (
            <Marker
              position={[origin.lat, origin.lng]}
              icon={createWazeAvatarIcon(avatarBearing)}
            >
              <Popup>
                <div className="text-sm font-semibold">{professionalName}</div>
                {routeInfo && (
                  <div className="text-xs text-slate-500">
                    {routeInfo.distance} · {routeInfo.duration}
                  </div>
                )}
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* WazeInfoBar */}
        {routeInfo && (
          <WazeInfoBar
            distance={routeInfo.distance}
            duration={routeInfo.duration}
            professionalName={professionalName}
            isTracking={routeStarted || !!professionalPos}
            isProfessional={isProfessional}
          />
        )}

        {/* WazeControls */}
        <WazeControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onCenter={handleCenter}
          onToggleAlerts={() => setAlertsEnabled(!alertsEnabled)}
          alertsEnabled={alertsEnabled}
        />

        {/* Stop button (professional, tracking) */}
        {isProfessional && routeStarted && (
          <button
            onClick={handleStopRoute}
            className="absolute bottom-4 right-4 z-[1000] w-10 h-10 rounded-xl bg-red-500 text-white shadow-lg flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all"
            title="Parar rastreamento"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Floating legend (collapsed) */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-md text-[10px] space-y-1 border border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-500 ring-2 ring-primary-200" />
            <span className="text-slate-500 dark:text-slate-400">Profissional</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-200" />
            <span className="text-slate-500 dark:text-slate-400">Destino</span>
          </div>
        </div>
      </div>

      {/* Action button / Status messages below map */}
      {isProfessional && !routeStarted && (
        <button
          onClick={handleStartRoute}
          disabled={startingRoute || !geo.latitude}
          className="btn btn-primary w-full py-4 flex items-center justify-center gap-2 text-base font-semibold rounded-2xl shadow-lg shadow-primary-500/20"
        >
          {startingRoute ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Iniciando trajeto...
            </>
          ) : (
            <>
              <Navigation className="w-5 h-5" />
              Iniciar Trajeto
            </>
          )}
        </button>
      )}

      {!isProfessional && !professionalPos && (
        <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-sm text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
          <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
          Aguardando o profissional iniciar o trajeto...
        </div>
      )}
    </div>
  );
};

export default WazeMap;
