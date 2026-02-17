/** Map zoom levels */
export const ZOOM = {
  DEFAULT: 13,
  FLY_TO: 16,
  CLOSE: 18,
} as const;

/** Animation durations in seconds */
export const ANIMATION = {
  FLY_DURATION: 2,
  PAN_DURATION: 0.8,
  CENTER_DURATION: 1,
} as const;

/** Tile providers */
export const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
} as const;

/** Polling and update intervals in ms */
export const INTERVALS = {
  LOCATION_UPDATE: 5000,
  LOCATION_POLL: 5000,
} as const;

/** Polyline trail settings */
export const TRAIL = {
  /** Number of points behind professional to show fading trail */
  FADING_POINTS: 5,
} as const;

/** Route polyline style */
export const ROUTE_STYLE = {
  REMAINING: {
    color: "#2563eb",
    weight: 5,
    opacity: 0.85,
  },
  FADING: {
    color: "#93c5fd",
    weight: 5,
    opacity: 0.3,
    dashArray: "4 8",
  },
} as const;

/** Default fallback coordinates (Iguatu, CE) */
export const FALLBACK_COORDS = { lat: -6.3629, lng: -39.2943 } as const;

/** Map fit bounds padding */
export const FIT_BOUNDS_PADDING: [number, number] = [60, 60];
