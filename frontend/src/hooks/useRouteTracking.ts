import { useState, useEffect } from "react";
import { getDirections, decodePolyline, getRouteAlerts } from "../services/geocodingService";
import { TRAIL } from "../components/map/wazeConstants";
import type { RoadAlert } from "../types";

interface RouteInfo {
  distance: string;
  duration: string;
}

interface UseRouteTrackingOptions {
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
}

export function useRouteTracking({ origin, destination }: UseRouteTrackingOptions) {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routePolyline, setRoutePolyline] = useState<Array<[number, number]>>([]);
  const [alerts, setAlerts] = useState<RoadAlert[]>([]);
  const [progressIndex, setProgressIndex] = useState(0);

  // Fetch directions when origin/destination change
  useEffect(() => {
    if (!origin || !destination) return;

    const fetchDirections = async () => {
      try {
        const result = await getDirections(origin, destination);
        if (result) {
          setRouteInfo({ distance: result.distance, duration: result.duration });
          const decoded = decodePolyline(result.polyline);
          setRoutePolyline(decoded);

          if (decoded.length > 0) {
            const routeAlerts = await getRouteAlerts(decoded);
            setAlerts(routeAlerts);
          }
        }
      } catch {
        // Directions are enhancement — don't block the map
      }
    };

    fetchDirections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  // Calculate progress index (closest polyline point to origin)
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

  const remainingPolyline = routePolyline.slice(progressIndex);
  const fadingPolyline = routePolyline.slice(
    Math.max(0, progressIndex - TRAIL.FADING_POINTS),
    progressIndex + 1
  );

  const clearRoute = () => {
    setRoutePolyline([]);
    setRouteInfo(null);
    setAlerts([]);
    setProgressIndex(0);
  };

  return {
    routeInfo,
    routePolyline,
    alerts,
    progressIndex,
    remainingPolyline,
    fadingPolyline,
    clearRoute,
  };
}
