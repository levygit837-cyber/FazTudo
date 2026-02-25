import { env } from "../config/env";
import { createLogger } from "../lib/logger";

const log = createLogger("geocoding");

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

interface DirectionsResult {
  distance: string;
  duration: string;
  polyline: string; // encoded polyline
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
    startLocation: { lat: number; lng: number };
    endLocation: { lat: number; lng: number };
  }>;
}

/**
 * Geocode an address using Google Geocoding API (server-side)
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const apiKey = env.PLACES_API_KEY;
    if (!apiKey) {
      log.warn("PLACES_API_KEY not configured");
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=pt-BR&region=BR`;
    const response = await fetch(url);
    const data: any = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    }

    log.warn({ status: data.status, address }, "Geocoding failed");
    return null;
  } catch (error) {
    log.error({ err: error, address }, "Geocoding error");
    return null;
  }
}

/**
 * Get directions between two points using Google Directions API (server-side)
 */
export async function getDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<DirectionsResult | null> {
  try {
    const apiKey = env.PLACES_API_KEY;
    if (!apiKey) {
      log.warn("PLACES_API_KEY not configured");
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${apiKey}&language=pt-BR&mode=driving`;
    const response = await fetch(url);
    const data: any = await response.json();

    if (data.status === "OK" && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];

      return {
        distance: leg.distance.text,
        duration: leg.duration.text,
        polyline: route.overview_polyline.points,
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || '',
          distance: step.distance.text,
          duration: step.duration.text,
          startLocation: step.start_location,
          endLocation: step.end_location,
        })),
      };
    }

    log.warn({ status: data.status }, "Directions failed");
    return null;
  } catch (error) {
    log.error({ err: error }, "Directions error");
    return null;
  }
}

interface ReverseGeocodingResult {
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

/**
 * Reverse geocode lat/lng to a structured address using Google Geocoding API
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodingResult | null> {
  try {
    const apiKey = env.PLACES_API_KEY;
    if (!apiKey) {
      log.warn("PLACES_API_KEY not configured");
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=pt-BR&result_type=street_address|route`;
    const response = await fetch(url);
    const data: any = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      const result = data.results[0];
      const components = result.address_components || [];

      const getComponent = (type: string): string => {
        const comp = components.find((c: any) => c.types.includes(type));
        return comp?.long_name || "";
      };

      return {
        street: getComponent("route"),
        number: getComponent("street_number"),
        neighborhood: getComponent("sublocality_level_1") || getComponent("sublocality"),
        city: getComponent("administrative_area_level_2") || getComponent("locality"),
        state: getComponent("administrative_area_level_1"),
        zipCode: getComponent("postal_code"),
        formattedAddress: result.formatted_address,
        lat,
        lng,
      };
    }

    log.warn({ status: data.status, lat, lng }, "Reverse geocoding failed");
    return null;
  } catch (error) {
    log.error({ err: error, lat, lng }, "Reverse geocoding error");
    return null;
  }
}
