import { useCallback } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import {
  ZOOM,
  PITCH,
  ANIMATION,
  FIT_BOUNDS_PADDING,
  easeInOutQuad,
} from "../components/map/mapConstants";

interface CameraTarget {
  lat: number;
  lng: number;
  bearing?: number | null;
}

interface BoundsTarget {
  points: Array<{ lat: number; lng: number }>;
}

interface UseMapCameraOptions {
  mapRef: React.RefObject<MapRef | null>;
}

export function useMapCamera({ mapRef }: UseMapCameraOptions) {
  const getMap = useCallback(() => mapRef.current?.getMap(), [mapRef]);

  const followTarget = useCallback(
    (target: CameraTarget) => {
      const map = getMap();
      if (!map) return;
      map.easeTo({
        center: [target.lng, target.lat],
        bearing: target.bearing ?? 0,
        pitch: PITCH.NAVIGATION,
        zoom: ZOOM.NAVIGATION,
        duration: ANIMATION.EASE_DURATION,
        easing: easeInOutQuad,
      });
    },
    [getMap]
  );

  const fitBounds = useCallback(
    ({ points }: BoundsTarget) => {
      const map = getMap();
      if (!map || points.length < 2) return;

      const lngs = points.map((p) => p.lng);
      const lats = points.map((p) => p.lat);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];

      map.fitBounds(bounds, {
        padding: FIT_BOUNDS_PADDING,
        bearing: 0,
        pitch: PITCH.CLIENT_VIEW,
        duration: ANIMATION.FLY_DURATION,
      });
    },
    [getMap]
  );

  const flyToInitial = useCallback(
    (target: CameraTarget) => {
      const map = getMap();
      if (!map) return;
      map.flyTo({
        center: [target.lng, target.lat],
        zoom: ZOOM.NAVIGATION,
        bearing: 0,
        pitch: 0,
        duration: ANIMATION.FLY_DURATION,
        curve: 1.5,
      });
    },
    [getMap]
  );

  const zoomIn = useCallback(() => {
    getMap()?.zoomIn({ duration: 200 });
  }, [getMap]);

  const zoomOut = useCallback(() => {
    getMap()?.zoomOut({ duration: 200 });
  }, [getMap]);

  const centerOn = useCallback(
    (target: CameraTarget) => {
      const map = getMap();
      if (!map) return;
      map.easeTo({
        center: [target.lng, target.lat],
        duration: ANIMATION.CENTER_DURATION,
        easing: easeInOutQuad,
      });
    },
    [getMap]
  );

  const resetNorth = useCallback(() => {
    getMap()?.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  }, [getMap]);

  return {
    followTarget,
    fitBounds,
    flyToInitial,
    zoomIn,
    zoomOut,
    centerOn,
    resetNorth,
  };
}
