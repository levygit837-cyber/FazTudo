import { describe, it, expect } from "vitest";
import { calculateBearing } from "../src/utils/geo";

describe("calculateBearing", () => {
  it("returns 0 for due north", () => {
    const bearing = calculateBearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(bearing).toBeCloseTo(0, 0);
  });

  it("returns 90 for due east", () => {
    const bearing = calculateBearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(bearing).toBeCloseTo(90, 0);
  });

  it("returns 180 for due south", () => {
    const bearing = calculateBearing({ lat: 1, lng: 0 }, { lat: 0, lng: 0 });
    expect(bearing).toBeCloseTo(180, 0);
  });

  it("returns 270 for due west", () => {
    const bearing = calculateBearing({ lat: 0, lng: 1 }, { lat: 0, lng: 0 });
    expect(bearing).toBeCloseTo(270, 0);
  });
});
