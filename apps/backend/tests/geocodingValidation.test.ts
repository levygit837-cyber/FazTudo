import { describe, it, expect } from "vitest";
import { geocodeSchema, directionsSchema, reverseGeocodeSchema, routeAlertsSchema } from "../src/middleware/geocodingValidation";

describe("geocodingValidation", () => {
  describe("geocodeSchema", () => {
    it("accepts valid address", () => {
      const result = geocodeSchema.safeParse({ address: "Rua da Paz, 123, Iguatu" });
      expect(result.success).toBe(true);
    });

    it("rejects empty address", () => {
      const result = geocodeSchema.safeParse({ address: "" });
      expect(result.success).toBe(false);
    });

    it("rejects non-string address", () => {
      const result = geocodeSchema.safeParse({ address: 123 });
      expect(result.success).toBe(false);
    });

    it("rejects address longer than 500 chars", () => {
      const result = geocodeSchema.safeParse({ address: "a".repeat(501) });
      expect(result.success).toBe(false);
    });
  });

  describe("reverseGeocodeSchema", () => {
    it("accepts valid lat/lng", () => {
      const result = reverseGeocodeSchema.safeParse({ latitude: -6.3629, longitude: -39.2943 });
      expect(result.success).toBe(true);
    });

    it("rejects latitude out of range", () => {
      const result = reverseGeocodeSchema.safeParse({ latitude: 91, longitude: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects longitude out of range", () => {
      const result = reverseGeocodeSchema.safeParse({ latitude: 0, longitude: 181 });
      expect(result.success).toBe(false);
    });

    it("rejects non-number latitude", () => {
      const result = reverseGeocodeSchema.safeParse({ latitude: "abc", longitude: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe("directionsSchema", () => {
    it("accepts valid origin and destination", () => {
      const result = directionsSchema.safeParse({
        origin: { lat: -6.36, lng: -39.29 },
        destination: { lat: -6.37, lng: -39.30 },
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing destination", () => {
      const result = directionsSchema.safeParse({
        origin: { lat: -6.36, lng: -39.29 },
      });
      expect(result.success).toBe(false);
    });

    it("rejects lat out of range in origin", () => {
      const result = directionsSchema.safeParse({
        origin: { lat: -91, lng: 0 },
        destination: { lat: 0, lng: 0 },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("routeAlertsSchema", () => {
    it("accepts valid polyline with default radius", () => {
      const result = routeAlertsSchema.safeParse({
        polyline: [[-6.36, -39.29], [-6.37, -39.30]],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.radius).toBe(200);
      }
    });

    it("rejects polyline with less than 2 points", () => {
      const result = routeAlertsSchema.safeParse({
        polyline: [[-6.36, -39.29]],
      });
      expect(result.success).toBe(false);
    });

    it("rejects radius greater than 5000", () => {
      const result = routeAlertsSchema.safeParse({
        polyline: [[-6.36, -39.29], [-6.37, -39.30]],
        radius: 10000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects polyline with more than 500 points", () => {
      const points = Array.from({ length: 501 }, (_, i) => [-6.36 + i * 0.001, -39.29]);
      const result = routeAlertsSchema.safeParse({ polyline: points });
      expect(result.success).toBe(false);
    });
  });
});
