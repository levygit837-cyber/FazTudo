import { useState, useEffect, useCallback, useRef } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  watchPosition?: boolean;
  /** Interval in ms to call onUpdate (default: 5000) */
  updateInterval?: number;
  onUpdate?: (lat: number, lng: number) => void;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    watchPosition = false,
    updateInterval = 5000,
    onUpdate,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
  });

  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  const handleSuccess = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      setState({
        latitude,
        longitude,
        accuracy,
        error: null,
        loading: false,
      });
      latestPositionRef.current = { lat: latitude, lng: longitude };
    },
    []
  );

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = "Erro ao obter localizacao";
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = "Permissao de localizacao negada. Habilite nas configuracoes do navegador.";
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = "Localizacao indisponivel.";
        break;
      case error.TIMEOUT:
        errorMessage = "Tempo esgotado ao obter localizacao.";
        break;
    }
    setState((prev) => ({ ...prev, error: errorMessage, loading: false }));
  }, []);

  // Start/stop watching
  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: "Geolocalizacao nao suportada pelo navegador.",
        loading: false,
      }));
      return;
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy,
      timeout: 10000,
      maximumAge: 0,
    };

    if (watchPosition) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        geoOptions
      );

      // Periodic callback for sending location to server
      if (onUpdate) {
        intervalRef.current = setInterval(() => {
          const pos = latestPositionRef.current;
          if (pos) {
            onUpdate(pos.lat, pos.lng);
          }
        }, updateInterval);
      }
    } else {
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        handleError,
        geoOptions
      );
    }
  }, [enableHighAccuracy, watchPosition, updateInterval, onUpdate, handleSuccess, handleError]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    startWatching();

    return () => {
      stopWatching();
    };
  }, [watchPosition, startWatching, stopWatching]);

  return {
    ...state,
    startWatching,
    stopWatching,
  };
}
