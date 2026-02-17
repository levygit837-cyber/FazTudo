import api, { extractData, ApiResponse } from "./api";

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

interface DirectionsResult {
  distance: string;
  duration: string;
  polyline: string;
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
    startLocation: { lat: number; lng: number };
    endLocation: { lat: number; lng: number };
  }>;
}

/**
 * Geocode an address via backend proxy (does NOT expose Google API key)
 */
export async function geocode(address: string): Promise<GeocodingResult | null> {
  try {
    const response = await api.post<ApiResponse<GeocodingResult>>("/geocoding/geocode", { address });
    return extractData(response);
  } catch {
    return null;
  }
}

/**
 * Get directions via backend proxy
 */
export async function getDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<DirectionsResult | null> {
  try {
    const response = await api.post<ApiResponse<DirectionsResult>>("/geocoding/directions", {
      origin,
      destination,
    });
    return extractData(response);
  } catch {
    return null;
  }
}

/**
 * Decode a Google encoded polyline into lat/lng array
 * (needed to draw route on Leaflet map)
 */
export function decodePolyline(encoded: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}
