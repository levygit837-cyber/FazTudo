import { createLogger } from "../lib/logger";

const log = createLogger("overpass");

const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

interface RoadAlert {
  id: string;
  type: string;
  lat: number;
  lng: number;
  description: string;
}

/**
 * Query Overpass API for road features along a route corridor.
 * Takes a decoded polyline (array of [lat, lng]) and a radius in meters.
 */
export async function getRouteAlerts(
  polyline: Array<[number, number]>,
  radiusMeters: number = 200
): Promise<RoadAlert[]> {
  try {
    // Sample polyline points (every 10th point to reduce query size)
    const sampledPoints = polyline.filter((_, i) => i % 10 === 0);
    if (sampledPoints.length === 0) return [];

    // Build bounding box from sampled points
    const lats = sampledPoints.map((p) => p[0]);
    const lngs = sampledPoints.map((p) => p[1]);
    const margin = radiusMeters / 111000; // rough degrees per meter
    const bbox = `${Math.min(...lats) - margin},${Math.min(...lngs) - margin},${Math.max(...lats) + margin},${Math.max(...lngs) + margin}`;

    const query = `
      [out:json][timeout:10][bbox:${bbox}];
      (
        node["traffic_calming"~"bump|hump|table"];
        node["highway"="traffic_signals"];
        node["hazard"="curve"];
        way["highway"="construction"];
        node["junction"="roundabout"];
        way["junction"="roundabout"];
        node["flood_prone"="yes"];
        way["surface"~"unpaved|gravel|dirt"];
      );
      out center body;
    `;

    const response = await fetch(OVERPASS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      log.warn({ status: response.status }, "Overpass API request failed");
      return [];
    }

    const data: any = await response.json();
    const alerts: RoadAlert[] = [];

    for (const element of data.elements || []) {
      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;
      if (!lat || !lng) continue;

      const tags = element.tags || {};
      let type: string;
      let description: string;

      if (tags.traffic_calming) {
        type = "speed_bump";
        const calming = tags.traffic_calming;
        description = calming === "bump" ? "Quebra-mola" : calming === "hump" ? "Lombada" : "Redutor de velocidade";
      } else if (tags.highway === "traffic_signals") {
        type = "traffic_signal";
        description = "Semaforo";
      } else if (tags.hazard === "curve") {
        type = "curve";
        description = "Curva perigosa";
      } else if (tags.highway === "construction") {
        type = "construction";
        description = "Obra na via";
      } else if (tags.junction === "roundabout") {
        type = "roundabout";
        description = "Rotatoria";
      } else if (tags.flood_prone === "yes") {
        type = "flood_prone";
        description = "Area sujeita a alagamento";
      } else if (tags.surface && ["unpaved", "gravel", "dirt"].includes(tags.surface)) {
        type = "unpaved";
        description = "Via nao pavimentada";
      } else {
        continue;
      }

      alerts.push({
        id: `${element.type}-${element.id}`,
        type,
        lat,
        lng,
        description,
      });
    }

    log.info({ alertCount: alerts.length, bbox }, "Route alerts fetched");
    return alerts;
  } catch (error) {
    log.error({ err: error }, "Overpass API error");
    return [];
  }
}
