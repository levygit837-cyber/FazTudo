import prisma from "../lib/prisma";

interface RecommendationParams {
  userId: number;
  limit?: number;
  offset?: number;
}

interface ScoredService {
  service: any;
  score: number;
  reasons: string[];
}

// Pesos do algoritmo
const WEIGHTS = {
  CATEGORY_AFFINITY: 0.4,
  RATING: 0.3,
  POPULARITY: 0.2,
  FRESHNESS: 0.1,
};

// Média bayesiana: evita profissionais com 1 review de 5 estrelas dominarem
function bayesianRating(
  rating: number,
  reviewCount: number,
  globalAvg: number,
  minReviews: number = 3,
): number {
  return (
    (rating * reviewCount + globalAvg * minReviews) /
    (reviewCount + minReviews)
  );
}

// Score de freshness: serviços mais novos ganham bonus
function freshnessScore(createdAt: Date): number {
  const now = new Date();
  const daysSinceCreation =
    (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceCreation <= 14) return 1.0;
  if (daysSinceCreation <= 60) return 1.0 - (daysSinceCreation - 14) / (60 - 14);
  return 0;
}

export const getRecommendations = async (
  params: RecommendationParams,
): Promise<{ recommendations: ScoredService[]; total: number }> => {
  const { userId, limit = 10, offset = 0 } = params;

  // 1. Buscar histórico de pedidos do usuário para afinidade de categoria
  const userOrders = await prisma.serviceOrder.findMany({
    where: {
      clientId: userId,
      status: { in: ["COMPLETED", "IN_PROGRESS", "ACCEPTED"] },
    },
    include: {
      serviceListing: {
        include: {
          category: {
            include: { parentCategory: true },
          },
        },
      },
    },
  });

  // 2. Construir mapa de afinidade por categoria
  const categoryAffinityMap = new Map<number, number>();
  const parentCategoryIds = new Set<number>();

  for (const order of userOrders) {
    if (order.serviceListing?.categoryId) {
      const catId = order.serviceListing.categoryId;
      categoryAffinityMap.set(catId, (categoryAffinityMap.get(catId) || 0) + 1);

      // Também considerar categoria pai para expandir recomendações
      if (order.serviceListing.category?.parentCategoryId) {
        parentCategoryIds.add(order.serviceListing.category.parentCategoryId);
      }
    }
  }

  // Buscar subcategorias irmãs (mesma categoria pai)
  const siblingCategories = parentCategoryIds.size > 0
    ? await prisma.serviceCategory.findMany({
        where: { parentCategoryId: { in: Array.from(parentCategoryIds) } },
        select: { id: true },
      })
    : [];

  const siblingCategoryIds = new Set(siblingCategories.map((c) => c.id));

  // 3. Buscar reviews negativas do usuário (para excluir profissionais)
  const negativeReviews = await prisma.review.findMany({
    where: { authorId: userId, rating: { lte: 2 } },
    select: { targetId: true },
  });
  const excludedProfessionalIds = new Set(negativeReviews.map((r) => r.targetId));

  // 4. Buscar serviços candidatos
  const candidates = await prisma.serviceListing.findMany({
    where: {
      isAvailable: true,
      NOT: { professionalId: userId },
    },
    include: {
      professional: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          ratingAverage: true,
          totalReviews: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          icon: true,
          parentCategoryId: true,
        },
      },
      _count: {
        select: { serviceOrders: true },
      },
    },
  });

  // Filtrar profissionais excluídos
  const filteredCandidates = candidates.filter(
    (c) => !excludedProfessionalIds.has(c.professional.id),
  );

  // 5. Calcular estatísticas globais
  const allProfessionals = await prisma.user.findMany({
    where: { role: "PROFESSIONAL", status: "ACTIVE" },
    select: { ratingAverage: true, totalReviews: true },
  });
  const globalAvgRating =
    allProfessionals.length > 0
      ? allProfessionals.reduce((sum, p) => sum + p.ratingAverage, 0) /
        allProfessionals.length
      : 3.5;

  // Popularidade: pedidos nos últimos 30 dias
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentOrderCounts = await prisma.serviceOrder.groupBy({
    by: ["serviceListingId"],
    where: {
      createdAt: { gte: thirtyDaysAgo },
      serviceListingId: { not: null },
    },
    _count: { id: true },
  });

  const popularityMap = new Map<number, number>();
  let maxPopularity = 1;
  for (const entry of recentOrderCounts) {
    if (entry.serviceListingId) {
      popularityMap.set(entry.serviceListingId, entry._count.id);
      if (entry._count.id > maxPopularity) maxPopularity = entry._count.id;
    }
  }

  // 6. Pontuar cada candidato
  const hasHistory = categoryAffinityMap.size > 0;
  const maxAffinity = hasHistory
    ? Math.max(...categoryAffinityMap.values())
    : 1;

  const scored: ScoredService[] = filteredCandidates.map((service) => {
    const reasons: string[] = [];
    let categoryScore = 0;
    let ratingScore = 0;
    let popularityScore = 0;
    let freshnessBonus = 0;

    // Afinidade por categoria
    if (hasHistory) {
      const directAffinity = categoryAffinityMap.get(service.categoryId) || 0;
      if (directAffinity > 0) {
        categoryScore = directAffinity / maxAffinity;
        reasons.push("Baseado nos seus pedidos anteriores");
      } else if (siblingCategoryIds.has(service.categoryId)) {
        categoryScore = 0.5; // Meio ponto para categoria irmã
        reasons.push("Categoria relacionada aos seus pedidos");
      }
    } else {
      // Sem histórico: dar pontuação neutra a todos
      categoryScore = 0.5;
    }

    // Rating (média bayesiana)
    const br = bayesianRating(
      service.professional.ratingAverage,
      service.professional.totalReviews,
      globalAvgRating,
    );
    ratingScore = Math.min(br / 5.0, 1.0); // Normalizar para 0-1
    if (service.professional.ratingAverage >= 4.5 && service.professional.totalReviews >= 5) {
      reasons.push("Profissional bem avaliado");
    }

    // Popularidade
    const servicePopularity = popularityMap.get(service.id) || 0;
    popularityScore = servicePopularity / maxPopularity;
    if (servicePopularity >= 3) {
      reasons.push("Popular entre clientes");
    }

    // Freshness
    freshnessBonus = freshnessScore(service.createdAt);
    if (freshnessBonus >= 0.8) {
      reasons.push("Novo na plataforma");
    }

    // Score final
    const finalScore =
      categoryScore * WEIGHTS.CATEGORY_AFFINITY +
      ratingScore * WEIGHTS.RATING +
      popularityScore * WEIGHTS.POPULARITY +
      freshnessBonus * WEIGHTS.FRESHNESS;

    if (reasons.length === 0) {
      reasons.push("Sugestao para voce");
    }

    return {
      service: {
        ...service,
        completedOrders: service._count.serviceOrders,
        _count: undefined,
      },
      score: finalScore,
      reasons,
    };
  });

  // 7. Ordenar por score e aplicar paginação
  scored.sort((a, b) => b.score - a.score);

  const total = scored.length;
  const paginated = scored.slice(offset, offset + limit);

  return { recommendations: paginated, total };
};
