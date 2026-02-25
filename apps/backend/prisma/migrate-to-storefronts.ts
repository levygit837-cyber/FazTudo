/**
 * Migration script: Convert existing ServiceListings into Storefronts
 *
 * For each user who owns ServiceListings:
 * 1. Create a Storefront with name=user.name, slug=slugify(user.name)
 * 2. Create a "Geral" StorefrontCategory
 * 3. Convert each ServiceListing into a StorefrontService inside "Geral"
 * 4. Update totalServices counter
 *
 * Run: cd apps/backend && npm run db:migrate-storefronts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || "postgresql://faztudo:faztudo_dev_2026@localhost:5432/faztudo",
});
const prisma = new PrismaClient({ adapter });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function main() {
  console.log("=".repeat(50));
  console.log("MIGRATION: ServiceListing → Storefront");
  console.log("=".repeat(50));
  console.log("");

  // Find all users who have ServiceListings
  const usersWithListings = await prisma.user.findMany({
    where: {
      serviceListings: { some: {} },
    },
    include: {
      serviceListings: {
        include: { category: true },
      },
      storefront: true,
    },
  });

  console.log(`Found ${usersWithListings.length} user(s) with ServiceListings`);

  let created = 0;
  let skipped = 0;

  for (const user of usersWithListings) {
    // Skip if user already has a storefront
    if (user.storefront) {
      console.log(`  SKIP: ${user.name} (id:${user.id}) — already has storefront`);
      skipped++;
      continue;
    }

    console.log(`\n  Processing: ${user.name} (id:${user.id}) — ${user.serviceListings.length} listings`);

    // Generate unique slug
    let baseSlug = slugify(user.name);
    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.storefront.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    // Determine main category from most common listing category
    const categoryCounts = new Map<number, number>();
    for (const listing of user.serviceListings) {
      const parentId = listing.category?.parentCategoryId ?? listing.categoryId;
      categoryCounts.set(parentId, (categoryCounts.get(parentId) || 0) + 1);
    }
    let mainCategoryId: number | null = null;
    let maxCount = 0;
    for (const [catId, count] of categoryCounts) {
      if (count > maxCount) {
        maxCount = count;
        mainCategoryId = catId;
      }
    }

    // Create storefront + "Geral" category + services in a transaction
    await prisma.$transaction(async (tx) => {
      const storefront = await tx.storefront.create({
        data: {
          userId: user.id,
          name: user.name,
          slug,
          description: user.bio || null,
          mainCategoryId,
          isActive: true,
          isPublished: true, // auto-publish since they had public listings
        },
      });

      console.log(`    Created storefront: "${storefront.name}" (slug: ${slug})`);

      // Create a "Geral" category
      const geralCategory = await tx.storefrontCategory.create({
        data: {
          storefrontId: storefront.id,
          name: "Geral",
          order: 0,
        },
      });

      // Convert each listing to a StorefrontService
      for (let i = 0; i < user.serviceListings.length; i++) {
        const listing = user.serviceListings[i]!;

        // Parse images from JSON if needed
        let images: any = null;
        if (listing.images) {
          try {
            images = typeof listing.images === "string"
              ? JSON.parse(listing.images)
              : listing.images;
          } catch {
            images = null;
          }
        }

        await tx.storefrontService.create({
          data: {
            categoryId: geralCategory.id,
            title: listing.title,
            description: listing.description,
            price: listing.price,
            images,
            isAvailable: listing.isAvailable,
            order: i,
          },
        });

        console.log(`    + Service: "${listing.title}" (R$${listing.price})`);
      }

      // Update totalServices
      await tx.storefront.update({
        where: { id: storefront.id },
        data: { totalServices: user.serviceListings.length },
      });
    });

    created++;
  }

  console.log("\n" + "=".repeat(50));
  console.log(`DONE: ${created} storefront(s) created, ${skipped} skipped`);
  console.log("=".repeat(50));
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
