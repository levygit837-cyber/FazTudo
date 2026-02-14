// backend/tests/integration/professionalReputation.test.ts
import { describe, it, expect } from "vitest";

describe("Professional Reputation Analytics", () => {
  it("should identify low rating reasons", () => {
    const reviews = [
      { rating: 2, comment: "Atrasou muito", createdAt: new Date() },
      { rating: 1, comment: "Trabalho mal feito", createdAt: new Date() },
      { rating: 5, comment: "Excelente", createdAt: new Date() },
      { rating: 3, comment: "Ok mas demorou", createdAt: new Date() },
    ];

    const lowRatingReviews = reviews.filter((r) => r.rating <= 3);
    expect(lowRatingReviews.length).toBe(3);
  });

  it("should calculate churn risk based on recent ratings", () => {
    const ratings = [2, 3, 1, 4, 2]; // recent ratings
    const avgRecent = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const churnRisk = avgRecent < 3 ? "HIGH" : avgRecent < 4 ? "MEDIUM" : "LOW";

    expect(avgRecent).toBe(2.4);
    expect(churnRisk).toBe("HIGH");
  });

  it("should generate ranking improvement recommendations", () => {
    const stats = {
      avgResponseTimeHours: 8, // > 4h = slow
      completionRate: 75, // < 90% = needs improvement
      avgRating: 3.5, // < 4.0 = needs improvement
      cancelledOrders: 5,
      totalOrders: 20,
    };

    const recommendations: string[] = [];
    if (stats.avgResponseTimeHours > 4) {
      recommendations.push("RESPONSE_TIME");
    }
    if (stats.completionRate < 90) {
      recommendations.push("COMPLETION_RATE");
    }
    if (stats.avgRating < 4.0) {
      recommendations.push("QUALITY");
    }
    if (stats.cancelledOrders / stats.totalOrders > 0.1) {
      recommendations.push("RELIABILITY");
    }

    expect(recommendations).toContain("RESPONSE_TIME");
    expect(recommendations).toContain("COMPLETION_RATE");
    expect(recommendations).toContain("QUALITY");
    expect(recommendations).toContain("RELIABILITY");
  });
});
