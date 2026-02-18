/**
 * Layer IDs for the route drawn on top of the MapTiler base style.
 */
export const ROUTE_LAYER_IDS = {
  REMAINING: "faztudo-route-remaining",
  FADING: "faztudo-route-fading",
  SOURCE: "faztudo-route-source",
  FADING_SOURCE: "faztudo-route-fading-source",
} as const;

/**
 * Convert an array of [lat, lng] tuples to a GeoJSON LineString Feature.
 * MapLibre expects [lng, lat] order (GeoJSON standard).
 */
export function toGeoJSONLineString(
  points: Array<[number, number]>
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: points.map(([lat, lng]) => [lng, lat]),
    },
  };
}

/**
 * Empty GeoJSON FeatureCollection for clearing sources.
 */
export function emptyGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  };
}
