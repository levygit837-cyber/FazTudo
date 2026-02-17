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

/**
 * Road alert types available from Overpass API
 */
export type RoadAlertType =
  | "speed_bump"
  | "traffic_signal"
  | "curve"
  | "construction"
  | "roundabout"
  | "flood_prone"
  | "unpaved";

/**
 * A road alert along the route
 */
export interface RoadAlert {
  id: string;
  type: RoadAlertType;
  position: LatLng;
  description: string;
}

/**
 * Extended location data with bearing (direction of movement)
 */
export interface ProfessionalLocation {
  lat: number;
  lng: number;
  bearing: number | null;
  updatedAt: string;
}

/**
 * Props for WazeMap component
 */
export interface WazeMapProps {
  orderId: number;
  isProfessional: boolean;
  professionalName: string;
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

/**
 * Props for WazeAvatar marker
 */
export interface WazeAvatarProps {
  position: LatLng;
  bearing: number | null;
  isAnimating: boolean;
}

/**
 * Props for WazeInfoBar overlay
 */
export interface WazeInfoBarProps {
  distance: string;
  duration: string;
  professionalName: string;
  isTracking: boolean;
  isProfessional: boolean;
}

/**
 * Props for WazeControls overlay
 */
export interface WazeControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  onToggleAlerts: () => void;
  alertsEnabled: boolean;
}

/**
 * Props for LocationPicker component
 */
export interface LocationPickerProps {
  value: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    latitude?: number;
    longitude?: number;
  };
  onChange: (address: LocationPickerProps["value"]) => void;
}

/**
 * Reverse geocoding result
 */
export interface ReverseGeocodingResult {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  formattedAddress: string;
  lat: number;
  lng: number;
}
