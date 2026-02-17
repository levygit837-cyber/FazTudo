import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Navigation,
  Clock,
  Route,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { useGeolocation } from "../../hooks/useGeolocation";
import {
  startRoute as apiStartRoute,
  updateProfessionalLocation,
  getProfessionalLocation,
  clearProfessionalLocation,
} from "../../services/serviceService";
import { geocode, getDirections, decodePolyline } from "../../services/geocodingService";
import { professionalIcon, destinationIcon } from "../map/leafletIcons";
import { useToast } from "../../context/ToastContext";

interface OrderLocationMapProps {
  orderId: number;
  isProfessional: boolean;
  destinationAddress: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    latitude?: number;
    longitude?: number;
  };
  orderStatus: string;
}

// Component to fit map bounds dynamically
const FitBounds: React.FC<{ points: Array<[number, number]> }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [map, points]);
  return null;
};

const OrderLocationMap: React.FC<OrderLocationMapProps> = ({
  orderId,
  isProfessional,
  destinationAddress,
  orderStatus: _orderStatus,
}) => {
  const toast = useToast();

  const [routeStarted, setRouteStarted] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
  } | null>(null);
  const [routePolyline, setRoutePolyline] = useState<Array<[number, number]>>([]);
  const [professionalPos, setProfessionalPos] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [startingRoute, setStartingRoute] = useState(false);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(
    destinationAddress.latitude && destinationAddress.longitude
      ? { lat: destinationAddress.latitude, lng: destinationAddress.longitude }
      : null
  );
  const [geocodingDest, setGeocodingDest] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Geocode address if no lat/lng via backend proxy
  useEffect(() => {
    if (destination) return;

    const doGeocode = async () => {
      setGeocodingDest(true);
      const addressStr = `${destinationAddress.street}, ${destinationAddress.number}, ${destinationAddress.neighborhood}, ${destinationAddress.city}, ${destinationAddress.state}, Brasil`;
      const result = await geocode(addressStr);
      if (result) {
        setDestination({ lat: result.lat, lng: result.lng });
      } else {
        // Fallback to center of Sao Paulo
        setDestination({ lat: -23.5505, lng: -46.6333 });
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
        // Silent fail — location updates are best-effort
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
          setProfessionalPos({ lat: loc.lat, lng: loc.lng });
        }
      } catch {
        // Silent fail
      }
    };

    // Poll immediately then every 5s
    pollLocation();
    pollIntervalRef.current = setInterval(pollLocation, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isProfessional, orderId]);

  // Determine the "origin" point for the route
  const origin = isProfessional
    ? geo.latitude && geo.longitude
      ? { lat: geo.latitude, lng: geo.longitude }
      : null
    : professionalPos;

  // Fetch directions from backend proxy
  useEffect(() => {
    if (!origin || !destination) return;

    const fetchDirections = async () => {
      const result = await getDirections(origin, destination);
      if (result) {
        setRouteInfo({
          distance: result.distance,
          duration: result.duration,
        });
        setRoutePolyline(decodePolyline(result.polyline));
      }
    };

    fetchDirections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  // Handle "Start Route" click
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
    } catch {
      // Silent fail
    }
  };

  const destinationLabel = `${destinationAddress.street}, ${destinationAddress.number} - ${destinationAddress.neighborhood}`;

  // Show loading while getting professional's initial position
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
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-700 dark:text-red-400 text-sm">
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

  // Compute fit bounds points
  const fitPoints: Array<[number, number]> = [];
  if (origin) fitPoints.push([origin.lat, origin.lng]);
  fitPoints.push([destination.lat, destination.lng]);

  return (
    <div className="space-y-4">
      {/* Route info bar */}
      {routeInfo && (
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Route className="w-4 h-4 text-blue-500" />
              {routeInfo.distance}
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Clock className="w-4 h-4 text-amber-500" />
              {routeInfo.duration}
            </div>
          </div>
          {isProfessional && routeStarted && (
            <button
              onClick={handleStopRoute}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Parar rastreamento
            </button>
          )}
        </div>
      )}

      {/* Map container */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700" style={{ height: "350px" }}>
        <MapContainer
          center={[destination.lat, destination.lng]}
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

          {fitPoints.length >= 2 && <FitBounds points={fitPoints} />}

          {/* Route polyline */}
          {routePolyline.length > 0 && (
            <Polyline
              positions={routePolyline}
              pathOptions={{
                color: "#3b82f6",
                weight: 5,
                opacity: 0.8,
              }}
            />
          )}

          {/* Destination marker (client's address) */}
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
            <Popup>
              <div className="text-sm font-medium">{destinationLabel}</div>
            </Popup>
          </Marker>

          {/* Professional's current position */}
          {origin && (
            <Marker position={[origin.lat, origin.lng]} icon={professionalIcon}>
              <Popup>
                <div className="text-sm font-medium">Profissional</div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Floating legend */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
            <span className="text-slate-600 dark:text-slate-400">Profissional</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
            <span className="text-slate-600 dark:text-slate-400">Destino</span>
          </div>
        </div>
      </div>

      {/* Action button (Professional only) */}
      {isProfessional && !routeStarted && (
        <button
          onClick={handleStartRoute}
          disabled={startingRoute || !geo.latitude}
          className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 text-base"
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

      {/* Client waiting message */}
      {!isProfessional && !professionalPos && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-sm text-amber-700 dark:text-amber-400">
          <Clock className="w-4 h-4 flex-shrink-0" />
          Aguardando o profissional iniciar o trajeto...
        </div>
      )}

      {/* Client: professional is on the way */}
      {!isProfessional && professionalPos && routeInfo && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm text-blue-700 dark:text-blue-400 animate-fade-in">
          <Navigation className="w-4 h-4 flex-shrink-0" />
          Profissional a caminho! Estimativa: {routeInfo.duration} ({routeInfo.distance})
        </div>
      )}
    </div>
  );
};

export default OrderLocationMap;
