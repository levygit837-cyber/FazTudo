import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
  Pin,
} from "@vis.gl/react-google-maps";
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
  getMapConfig,
  startRoute as apiStartRoute,
  updateProfessionalLocation,
  getProfessionalLocation,
  clearProfessionalLocation,
} from "../../services/serviceService";
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

// Inner component that uses Google Maps hooks (must be inside APIProvider)
const MapContent: React.FC<{
  isProfessional: boolean;
  orderId: number;
  destinationAddress: OrderLocationMapProps["destinationAddress"];
  orderStatus: string;
}> = ({ isProfessional, orderId, destinationAddress, orderStatus: _orderStatus }) => {
  const map = useMap();
  const routesLibrary = useMapsLibrary("routes");
  const geocodingLibrary = useMapsLibrary("geocoding");
  const toast = useToast();

  const [routeStarted, setRouteStarted] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
  } | null>(null);
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

  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Apply custom FazTudo map styles (force 2D roadmap)
  useEffect(() => {
    if (!map) return;
    map.setOptions({
      styles: [
        { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
        { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e8eaed" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadce0" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d7e8" }] },
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "poi.business", stylers: [{ visibility: "off" }] },
        { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5f5e0" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
      mapTypeId: "roadmap",
    });
  }, [map]);

  // Geocode address if no lat/lng
  useEffect(() => {
    if (destination || !geocodingLibrary) return;

    const addressStr = `${destinationAddress.street}, ${destinationAddress.number}, ${destinationAddress.neighborhood}, ${destinationAddress.city}, ${destinationAddress.state}, Brasil`;
    const geocoder = new geocodingLibrary.Geocoder();
    geocoder.geocode({ address: addressStr }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const loc = results[0].geometry.location;
        setDestination({ lat: loc.lat(), lng: loc.lng() });
      } else {
        // Fallback to center of Sao Paulo
        setDestination({ lat: -23.5505, lng: -46.6333 });
      }
    });
  }, [geocodingLibrary, destination, destinationAddress]);

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

  // Render directions route
  useEffect(() => {
    if (!routesLibrary || !map || !origin || !destination) return;

    // Create renderer if not exists
    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new routesLibrary.DirectionsRenderer({
        map,
        suppressMarkers: true, // We'll render our own markers
        polylineOptions: {
          strokeColor: "#3b82f6",
          strokeWeight: 5,
          strokeOpacity: 0.8,
        },
      });
    }

    const directionsService = new routesLibrary.DirectionsService();

    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === "OK" && response) {
          directionsRendererRef.current?.setDirections(response);
          const leg = response.routes[0]?.legs[0];
          if (leg) {
            setRouteInfo({
              distance: leg.distance?.text || "",
              duration: leg.duration?.text || "",
            });
          }
        }
      }
    );
  }, [routesLibrary, map, origin, destination]);

  // Fit map bounds to show both points
  useEffect(() => {
    if (!map || !origin || !destination) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(origin.lat, origin.lng));
    bounds.extend(new google.maps.LatLng(destination.lat, destination.lng));
    map.fitBounds(bounds, { top: 60, bottom: 60, left: 40, right: 40 });
  }, [map, origin, destination]);

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
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
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

  if (!destination) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Localizando endereco...
      </div>
    );
  }

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
        <Map
          defaultCenter={destination}
          defaultZoom={13}
          mapId="faztudo-route-map"
          gestureHandling="greedy"
          disableDefaultUI={false}
          zoomControl={true}
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={true}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Destination marker (client's address) */}
          <AdvancedMarker position={destination} title={destinationLabel}>
            <Pin background="#ef4444" glyphColor="#fff" borderColor="#dc2626" />
          </AdvancedMarker>

          {/* Professional's current position */}
          {origin && (
            <AdvancedMarker position={origin} title="Profissional">
              <Pin background="#3b82f6" glyphColor="#fff" borderColor="#2563eb" />
            </AdvancedMarker>
          )}
        </Map>

        {/* Floating legend */}
        <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md text-xs space-y-1">
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

// Main component with APIProvider wrapper
const OrderLocationMap: React.FC<OrderLocationMapProps> = ({
  orderId,
  isProfessional,
  destinationAddress,
  orderStatus,
}) => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Load API key
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getMapConfig();
        if (config.apiKey) {
          setApiKey(config.apiKey);
        } else {
          setKeyError("Chave do Google Maps nao configurada");
        }
      } catch {
        setKeyError("Erro ao carregar configuracao do mapa");
      } finally {
        setLoadingKey(false);
      }
    };
    loadConfig();
  }, []);

  if (loadingKey) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Carregando mapa...
      </div>
    );
  }

  if (keyError || !apiKey) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-700 dark:text-red-400 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        {keyError || "Mapa indisponivel"}
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <MapContent
        isProfessional={isProfessional}
        orderId={orderId}
        destinationAddress={destinationAddress}
        orderStatus={orderStatus}
      />
    </APIProvider>
  );
};

export default OrderLocationMap;
