/** Map zoom levels */
export const ZOOM = {
  DEFAULT: 13,
  NAVIGATION: 16,
  CLOSE: 18,
} as const;

/** Camera pitch (degrees) */
export const PITCH = {
  FLAT: 0,
  NAVIGATION: 30,
  CLIENT_VIEW: 10,
} as const;

/** Animation durations in ms */
export const ANIMATION = {
  FLY_DURATION: 2000,
  EASE_DURATION: 800,
  CENTER_DURATION: 1000,
} as const;

/** MapLibre GL style URL — uses VITE_MAPTILER_KEY */
export const MAP_STYLE = {
  dark: (key: string) =>
    `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${key}`,
  light: (key: string) =>
    `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`,
} as const;

/** Polling and update intervals in ms */
export const INTERVALS = {
  LOCATION_UPDATE: 5000,
  LOCATION_POLL: 5000,
} as const;

/** Trailing points shown behind professional */
export const TRAIL = {
  FADING_POINTS: 5,
} as const;

/** Route line style for MapLibre GL layers */
export const ROUTE_LAYER_STYLE = {
  REMAINING: {
    "line-color": "#3b82f6",
    "line-width": 6,
    "line-opacity": 0.9,
    "line-cap": "round" as const,
    "line-join": "round" as const,
  },
  FADING: {
    "line-color": "#93c5fd",
    "line-width": 5,
    "line-opacity": 0.35,
    "line-dasharray": [4, 8],
  },
} as const;

/** Default fallback coordinates (Iguatu, CE) */
export const FALLBACK_COORDS = { lat: -6.3629, lng: -39.2943 } as const;

/** Map fit bounds padding */
export const FIT_BOUNDS_PADDING = {
  top: 100,
  bottom: 80,
  left: 60,
  right: 60,
} as const;

/** Easing function for camera animations (easeInOutQuad) */
export const easeInOutQuad = (t: number): number =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
