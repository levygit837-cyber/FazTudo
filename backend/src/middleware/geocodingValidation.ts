import { z } from "zod";

const latitudeSchema = z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90");
const longitudeSchema = z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180");

const latLngSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
});

export const geocodeSchema = z.object({
  address: z.string().min(1, "Address is required").max(500, "Address too long"),
});

export const reverseGeocodeSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export const directionsSchema = z.object({
  origin: latLngSchema,
  destination: latLngSchema,
});

export const routeAlertsSchema = z.object({
  polyline: z
    .array(z.tuple([z.number(), z.number()]))
    .min(2, "Polyline must have at least 2 points")
    .max(500, "Polyline must have at most 500 points"),
  radius: z.number().min(50).max(5000).default(200),
});
