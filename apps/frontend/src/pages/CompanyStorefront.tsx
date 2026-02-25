import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { Building2, Star, Users } from "lucide-react";
import { companyStorefrontService } from "../services/companyStorefrontService";
import { TierBadge } from "../components/company/TierBadge";
import { formatCurrency } from "../utils/formatters";
import type { PublicStorefront } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MemberAvatar({
  name,
  image,
}: {
  name: string;
  image?: string;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        title={name}
        className="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-slate-800 -ml-2 first:ml-0"
      />
    );
  }
  return (
    <div
      title={name}
      className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-semibold border-2 border-white dark:border-slate-800 -ml-2 first:ml-0"
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CompanyStorefront: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const [storefront, setStorefront] = useState<PublicStorefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const id = parseInt(companyId ?? "", 10);
    if (isNaN(id)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    companyStorefrontService
      .getPublicStorefront(id)
      .then((res) => {
        if (res.success && res.data) {
          setStorefront(res.data);
        } else {
          setNotFound(true);
        }
      })
      .catch((err: { response?: { status?: number } }) => {
        if (err?.response?.status === 404) setNotFound(true);
        else setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── 404 ──────────────────────────────────────────────────────────────────

  if (notFound || !storefront) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
        <Building2 className="h-16 w-16 text-slate-300 dark:text-slate-600" />
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Empresa não encontrada
        </h1>
        <p className="text-slate-500 max-w-sm">
          A página que você está procurando não existe ou foi removida.
        </p>
        <Link to="/" className="btn btn-primary mt-2">
          Voltar ao início
        </Link>
      </div>
    );
  }

  const { company, ordersCount } = storefront;

  // ── Block helpers ─────────────────────────────────────────────────────────

  const heroBlock = company.storefrontBlocks.find(
    (b) => b.type === "HERO" && b.isActive,
  );
  const aboutBlock = company.storefrontBlocks.find(
    (b) => b.type === "ABOUT" && b.isActive,
  );
  const testimonialsBlock = company.storefrontBlocks.find(
    (b) => b.type === "TESTIMONIALS" && b.isActive,
  );

  const activeSections = company.storefrontSections
    .filter((s) => s.isActive)
    .sort((a, b) => a.order - b.order);

  const heroImage = heroBlock?.content?.heroImageUrl as string | undefined;
  const heroHeadline = heroBlock?.content?.headline as string | undefined;
  const heroSubtext = heroBlock?.content?.subtext as string | undefined;
  const heroBgColor = heroBlock?.content?.bgColor as string | undefined;

  const aboutHeadline = aboutBlock?.content?.headline as string | undefined;
  const aboutBody = aboutBlock?.content?.body as string | undefined;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ── HERO Block ───────────────────────────────────────────────────────── */}
      {heroBlock && (
        <div
          className="relative w-full overflow-hidden"
          style={{
            background: heroImage
              ? `url(${heroImage}) center/cover no-repeat`
              : heroBgColor ?? "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
            minHeight: "280px",
          }}
        >
          {/* Overlay for readability when there's an image */}
          {heroImage && (
            <div className="absolute inset-0 bg-black/45" />
          )}
          <div className="relative z-10 container mx-auto px-4 py-20 text-center text-white">
            {heroHeadline && (
              <h1 className="text-4xl md:text-5xl font-extrabold drop-shadow-md">
                {heroHeadline}
              </h1>
            )}
            {heroSubtext && (
              <p className="mt-4 text-lg md:text-xl text-white/85 max-w-2xl mx-auto drop-shadow">
                {heroSubtext}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        {/* ── Company Header Card ────────────────────────────────────────────── */}
        <div className="card p-6">
          <div className="flex items-start gap-5 flex-wrap">
            {/* Logo / Avatar */}
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={company.companyName}
                className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {company.companyName}
                </h1>
                <TierBadge tier={company.tier} size="md" />
              </div>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {ordersCount.toLocaleString("pt-BR")}
                </span>{" "}
                {ordersCount === 1 ? "pedido concluído" : "pedidos concluídos"}
              </p>

              {company.description && (
                <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {company.description}
                </p>
              )}

              {/* Team members */}
              {company.members && company.members.length > 0 && (
                <div className="mt-4 flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div className="flex items-center ml-2">
                    {company.members.slice(0, 8).map((m) => (
                      <MemberAvatar
                        key={m.id}
                        name={m.user?.name ?? "Membro"}
                        image={m.user?.profileImage}
                      />
                    ))}
                    {company.members.length > 8 && (
                      <span className="ml-3 text-xs text-slate-500 dark:text-slate-400">
                        +{company.members.length - 8} membros
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── ABOUT Block ───────────────────────────────────────────────────── */}
        {aboutBlock && (aboutHeadline || aboutBody) && (
          <div className="card p-6">
            {aboutHeadline && (
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
                {aboutHeadline}
              </h2>
            )}
            {aboutBody && (
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                {aboutBody}
              </p>
            )}
          </div>
        )}

        {/* ── Storefront Sections ───────────────────────────────────────────── */}
        {activeSections.map((section) => {
          const activeItems = section.items.filter(
            (item) => item.listing,
          );
          if (activeItems.length === 0) return null;

          return (
            <div key={section.id}>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {section.title}
                </h2>
                {section.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {section.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeItems.map((item) => {
                  const listing = item.listing!;
                  return (
                    <div
                      key={item.id}
                      className="card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
                    >
                      {item.isFeatured && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full w-fit">
                          <Star className="h-3 w-3 fill-current" /> Destaque
                        </span>
                      )}
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {listing.title}
                      </h3>
                      {listing.category?.name && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                          {listing.category.name}
                        </p>
                      )}
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 flex-1">
                        {listing.description}
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(listing.price)}
                        </span>
                        <Link
                          to={`/services/${listing.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          Contratar
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ── TESTIMONIALS Block ────────────────────────────────────────────── */}
        {testimonialsBlock && company.pinnedTestimonials.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
              O que dizem sobre nós
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {company.pinnedTestimonials
                .sort((a, b) => a.order - b.order)
                .map((pt) => {
                  const review = pt.review;
                  if (!review) return null;
                  return (
                    <div
                      key={pt.id}
                      className="card p-5 flex flex-col gap-3"
                    >
                      {/* Stars */}
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating
                                ? "text-amber-400 fill-amber-400"
                                : "text-slate-200 dark:text-slate-700"
                            }`}
                          />
                        ))}
                      </div>

                      {review.comment && (
                        <p className="text-slate-700 dark:text-slate-300 text-sm italic leading-relaxed">
                          "{review.comment}"
                        </p>
                      )}

                      {review.author && (
                        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-slate-700">
                          {review.author.profileImage ? (
                            <img
                              src={review.author.profileImage}
                              alt={review.author.name}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                              {getInitials(review.author.name)}
                            </div>
                          )}
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {review.author.name}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyStorefront;
