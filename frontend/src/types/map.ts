// frontend/src/types/map.ts

/**
 * Represents a geographic coordinate pair
 */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * A custom marker on the interactive map
 */
export interface MapMarker {
  id: string;
  position: LatLng;
  type: "professional" | "destination" | "landmark";
  label: string;
  /** Optional subtitle shown below the label */
  subtitle?: string;
  /** Custom icon name from lucide-react */
  icon?: string;
}

/**
 * Route information between two points
 */
export interface RouteInfo {
  distance: string;
  duration: string;
  /** Encoded polyline from Google Directions (for fallback) */
  polyline?: string;
}

/**
 * Props for the InteractiveMap component
 */
export interface InteractiveMapProps {
  /** Marker for the professional's current position */
  professionalMarker: MapMarker;
  /** Marker for the service destination */
  destinationMarker: MapMarker;
  /** Additional landmark/street markers */
  landmarkMarkers?: MapMarker[];
  /** Whether to show the route (directions) between professional and destination */
  showRoute?: boolean;
  /** Map height in pixels (default: 450) */
  height?: number;
  /** Callback when route info is computed */
  onRouteInfo?: (info: RouteInfo) => void;
  /** Extra CSS class for the container */
  className?: string;
}

/**
 * Props for the RouteTracker overlay that shows distance/duration
 */
export interface RouteTrackerProps {
  routeInfo: RouteInfo | null;
  isTracking: boolean;
  onStartTracking?: () => void;
  onStopTracking?: () => void;
  isProfessional: boolean;
}
