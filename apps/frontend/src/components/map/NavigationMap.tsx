import React, { useState, useEffect, useCallback, useRef } from "react";
import Map, { Marker, Source, Layer, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Loader2, AlertCircle, Clock, Navigation, X } from "lucide-react";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useRouteTracking } from "../../hooks/useRouteTracking";
import { useMapCamera } from "../../hooks/useMapCamera";
import {
  startRoute as apiStartRoute,
  updateProfessionalLocation,
  getProfessionalLocation,
  clearProfessionalLocation,
} from "../../services/serviceService";
import { geocode } from "../../services/geocodingService";
import {
  createProfessionalMarkerElement,
  createDestinationMarkerElement,
  createAlertMarkerElement,
} from "./mapIcons";
import NavInfoBar from "./NavInfoBar";
import NavControls from "./NavControls";
import {
  ZOOM,
  PITCH,
  INTERVALS,
  ROUTE_LAYER_STYLE,
  FALLBACK_COORDS,
  MAP_STYLE,
} from "./mapConstants";
import { toGeoJSONLineString, emptyGeoJSON, ROUTE_LAYER_IDS } from "./mapStyle";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import type { NavigationMapProps } from "../../types";

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY ?? "";

const NavigationMap: React.FC<NavigationMapProps> = ({
  orderId,
  isProfessional,
  professionalName,
  destinationAddress,
  orderStatus: _orderStatus,
}) => {
  const toast = useToast();
  const { theme } = useTheme();
  const mapRef = useRef<MapRef>(null);
  const camera = useMapCamera({ mapRef });
  const avatarElRef = useRef<HTMLDivElement | null>(null);

  const [routeStarted, setRouteStarted] = useState(false);
  const [professionalPos, setProfessionalPos] = useState<{
    lat: number;
    lng: number;
    bearing: number | null;
  } | null>(null);
  const [startingRoute, setStartingRoute] = useState(false);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(
    destinationAddress.latitude && destinationAddress.longitude
      ? { lat: destinationAddress.latitude, lng: destinationAddress.longitude }
      : null
  );
  const [geocodingDest, setGeocodingDest] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Geocode destination if no lat/lng
  useEffect(() => {
    if (destination) return;
    const doGeocode = async () => {
      setGeocodingDest(true);
      try {
        const addressStr = [
          destinationAddress.street,
          destinationAddress.number,
          destinationAddress.neighborhood,
          destinationAddress.city,
          destinationAddress.state,
          "Brasil",
        ].join(", ");
        const result = await geocode(addressStr);
        setDestination(result ?? FALLBACK_COORDS);
      } catch {
        toast.error("Erro", "Nao foi possivel localizar o endereco de destino.");
        setDestination(FALLBACK_COORDS);
      } finally {
        setGeocodingDest(false);
      }
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
        // silent fail
      }
    },
    [orderId, routeStarted]
  );

  const geo = useGeolocation({
    watchPosition: isProfessional && routeStarted,
    enableHighAccuracy: true,
    updateInterval: INTERVALS.LOCATION_UPDATE,
    onUpdate: isProfessional ? handleLocationUpdate : undefined,
  });

  // Client: poll professional location
  useEffect(() => {
    if (isProfessional) return;
    const pollLocation = async () => {
      try {
        const loc = await getProfessionalLocation(orderId);
        if (loc) {
          setProfessionalPos({ lat: loc.lat, lng: loc.lng, bearing: loc.bearing ?? null });
        }
      } catch {
        // silent fail
      }
    };
    pollLocation();
    pollIntervalRef.current = setInterval(pollLocation, INTERVALS.LOCATION_POLL);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isProfessional, orderId]);

  const origin = isProfessional
    ? geo.latitude && geo.longitude
      ? { lat: geo.latitude, lng: geo.longitude, bearing: geo.bearing }
      : null
    : professionalPos;

  const {
    routeInfo,
    routePolyline: _routePolyline,
    alerts,
    progressIndex: _progressIndex,
    remainingPolyline,
    fadingPolyline,
    clearRoute,
  } = useRouteTracking({ origin, destination });

  // Camera control
  useEffect(() => {
    if (!mapLoaded) return;
    if (routeStarted && origin) {
      camera.followTarget({ lat: origin.lat, lng: origin.lng, bearing: origin.bearing });
    } else if (origin && destination) {
      camera.fitBounds({ points: [origin, destination] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, routeStarted, origin?.lat, origin?.lng, origin?.bearing, destination?.lat, destination?.lng]);

  // Update avatar bearing via DOM mutation (avoids full re-render)
  const avatarBearing = isProfessional ? geo.bearing : professionalPos?.bearing ?? null;
  useEffect(() => {
    if (!avatarElRef.current) return;
    const inner = avatarElRef.current.querySelector("div > div") as HTMLDivElement | null;
    if (!inner) return;
    inner.style.transform = avatarBearing !== null ? `rotate(${avatarBearing}deg)` : "";
  }, [avatarBearing]);

  const handleStartRoute = async () => {
    try {
      setStartingRoute(true);
      await apiStartRoute(orderId);
      setRouteStarted(true);
      toast.success("Trajeto iniciado! O cliente foi notificado.");
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error("Erro", apiErr?.response?.data?.message || "Erro ao iniciar trajeto");
    } finally {
      setStartingRoute(false);
    }
  };

  const handleStopRoute = async () => {
    try {
      setRouteStarted(false);
      geo.stopWatching();
      await clearProfessionalLocation(orderId);
      clearRoute();
    } catch {
      // silent fail
    }
  };

  // GeoJSON for route layers
  const remainingGeoJSON =
    remainingPolyline.length > 1 ? toGeoJSONLineString(remainingPolyline) : emptyGeoJSON();
  const fadingGeoJSON =
    fadingPolyline.length > 1 && routeStarted
      ? toGeoJSONLineString(fadingPolyline)
      : emptyGeoJSON();

  // Map style URL
  const mapStyleUrl = MAPTILER_KEY
    ? theme === "dark"
      ? MAP_STYLE.dark(MAPTILER_KEY)
      : MAP_STYLE.light(MAPTILER_KEY)
    : "https://demotiles.maplibre.org/style.json";

  // Loading states
  if (isProfessional && geo.loading && !geo.latitude) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
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
      <div className="flex items-center justify-center h-48 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Localizando endereco...
      </div>
    );
  }

  const isFollowing = routeStarted && !!origin;
  const destinationLabel = destinationAddress.street + ", " + destinationAddress.number;

  return (
    <div className="space-y-4">
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          height: "420px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: destination.lng,
            latitude: destination.lat,
            zoom: ZOOM.DEFAULT,
            pitch: PITCH.FLAT,
            bearing: 0,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={mapStyleUrl}
          attributionControl={false}
          onLoad={() => setMapLoaded(true)}
        >
          {/* Fading trail */}
          <Source id={ROUTE_LAYER_IDS.FADING_SOURCE} type="geojson" data={fadingGeoJSON}>
            <Layer
              id={ROUTE_LAYER_IDS.FADING}
              type="line"
              paint={{
                "line-color": ROUTE_LAYER_STYLE.FADING["line-color"],
                "line-width": ROUTE_LAYER_STYLE.FADING["line-width"],
                "line-opacity": ROUTE_LAYER_STYLE.FADING["line-opacity"],
                "line-dasharray": [4, 8],
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>

          {/* Remaining route */}
          <Source id={ROUTE_LAYER_IDS.SOURCE} type="geojson" data={remainingGeoJSON}>
            <Layer
              id={ROUTE_LAYER_IDS.REMAINING}
              type="line"
              paint={{
                "line-color": ROUTE_LAYER_STYLE.REMAINING["line-color"],
                "line-width": ROUTE_LAYER_STYLE.REMAINING["line-width"],
                "line-opacity": ROUTE_LAYER_STYLE.REMAINING["line-opacity"],
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>

          {/* Road alerts */}
          {alertsEnabled &&
            alerts.map((alert) => (
              <Marker
                key={alert.id}
                longitude={alert.position.lng}
                latitude={alert.position.lat}
                anchor="center"
              >
                <div
                  ref={(el) => {
                    if (el && el.childElementCount === 0) {
                      el.appendChild(createAlertMarkerElement(alert.type));
                    }
                  }}
                  title={alert.description}
                />
              </Marker>
            ))}

          {/* Destination marker */}
          <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
            <div
              ref={(el) => {
                if (el && el.childElementCount === 0) {
                  el.appendChild(createDestinationMarkerElement(destinationAddress.number));
                }
              }}
              title={destinationLabel}
            />
          </Marker>

          {/* Professional avatar */}
          {origin && (
            <Marker
              key={`${origin.lat}-${origin.lng}`}
              longitude={origin.lng}
              latitude={origin.lat}
              anchor="center"
            >
              <div
                ref={(el) => {
                  if (el && el.childElementCount === 0) {
                    const icon = createProfessionalMarkerElement(avatarBearing);
                    el.appendChild(icon);
                    avatarElRef.current = el;
                  }
                }}
                title={professionalName}
              />
            </Marker>
          )}
        </Map>

        {/* HUD overlays */}
        {routeInfo && (
          <NavInfoBar
            distance={routeInfo.distance}
            duration={routeInfo.duration}
            professionalName={professionalName}
            isTracking={routeStarted || !!professionalPos}
            isProfessional={isProfessional}
          />
        )}

        <NavControls
          onZoomIn={camera.zoomIn}
          onZoomOut={camera.zoomOut}
          onCenter={() => origin && camera.centerOn({ lat: origin.lat, lng: origin.lng })}
          onToggleAlerts={() => setAlertsEnabled(!alertsEnabled)}
          onNorth={!isFollowing ? camera.resetNorth : undefined}
          alertsEnabled={alertsEnabled}
        />

        {/* Stop button */}
        {isProfessional && routeStarted && (
          <button
            onClick={handleStopRoute}
            className="absolute bottom-4 right-4 z-[1000] w-11 h-11 rounded-xl text-white shadow-xl flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: "rgba(239,68,68,0.9)", backdropFilter: "blur(8px)" }}
            title="Parar rastreamento"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Attribution */}
        <div className="absolute bottom-2 left-2 z-[1000] text-[9px] text-white/30">
          © MapTiler © OpenStreetMap
        </div>
      </div>

      {/* Start route button */}
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

      {/* Client waiting */}
      {!isProfessional && !professionalPos && (
        <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-sm text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
          <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
          Aguardando o profissional iniciar o trajeto...
        </div>
      )}
    </div>
  );
};

export default NavigationMap;
