import React from "react";

// ── Base Skeleton ────────────────────────────────────────

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div className={`skeleton ${className}`} />
);

// ── Skeleton Text ────────────────────────────────────────

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ lines = 3, className = "" }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="skeleton h-4 rounded"
        style={{ width: i === lines - 1 ? "60%" : "100%" }}
      />
    ))}
  </div>
);

// ── Skeleton Avatar ──────────────────────────────────────

interface SkeletonAvatarProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const avatarSizes = { sm: "w-8 h-8", md: "w-12 h-12", lg: "w-16 h-16" };

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({ size = "md", className = "" }) => (
  <div className={`skeleton rounded-full ${avatarSizes[size]} ${className}`} />
);

// ── Skeleton Card ────────────────────────────────────────

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`card p-5 space-y-4 ${className}`}>
    <div className="flex items-center gap-3">
      <SkeletonAvatar size="sm" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </div>
    </div>
    <SkeletonText lines={2} />
    <div className="flex gap-2">
      <Skeleton className="h-8 w-20 rounded-lg" />
      <Skeleton className="h-8 w-16 rounded-lg" />
    </div>
  </div>
);

// ── Skeleton Stats Card ──────────────────────────────────

export const SkeletonStatsCard: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`card p-5 ${className}`}>
    <div className="flex items-center justify-between mb-3">
      <Skeleton className="h-4 w-24 rounded" />
      <Skeleton className="h-10 w-10 rounded-xl" />
    </div>
    <Skeleton className="h-8 w-20 rounded mb-1" />
    <Skeleton className="h-3 w-16 rounded" />
  </div>
);

// ── Skeleton Service Card ────────────────────────────────

export const SkeletonServiceCard: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`card overflow-hidden ${className}`}>
    <Skeleton className="h-48 w-full rounded-none" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-5 w-3/4 rounded" />
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-2/3 rounded" />
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <SkeletonAvatar size="sm" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>
    </div>
  </div>
);

// ── Skeleton Order Card ──────────────────────────────────

export const SkeletonOrderCard: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`card p-5 ${className}`}>
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-2/3 rounded" />
        <Skeleton className="h-4 w-1/3 rounded" />
      </div>
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <SkeletonAvatar size="sm" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>
      <Skeleton className="h-4 w-20 rounded" />
    </div>
  </div>
);

// ── Skeleton Table ───────────────────────────────────────

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  cols = 4,
  className = "",
}) => (
  <div className={`card overflow-hidden ${className}`}>
    {/* Header */}
    <div className="flex gap-4 p-4 border-b border-slate-200 dark:border-slate-700">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1 rounded" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, r) => (
      <div
        key={r}
        className="flex gap-4 p-4 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0"
      >
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton
            key={c}
            className={`h-4 rounded ${c === 0 ? "w-[30%]" : "flex-1"}`}
          />
        ))}
      </div>
    ))}
  </div>
);

// ── Skeleton Dashboard ───────────────────────────────────

export const SkeletonDashboard: React.FC = () => (
  <div className="space-y-8 animate-pulse">
    {/* Header */}
    <div className="space-y-2">
      <Skeleton className="h-8 w-48 rounded" />
      <Skeleton className="h-4 w-72 rounded" />
    </div>

    {/* Stats */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonStatsCard key={i} />
      ))}
    </div>

    {/* Quick actions */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Content area */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonOrderCard key={i} />
        ))}
      </div>
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  </div>
);

// ── Skeleton Profile ─────────────────────────────────────

export const SkeletonProfile: React.FC = () => (
  <div className="space-y-6 animate-pulse max-w-4xl mx-auto">
    {/* Header card */}
    <div className="card p-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="flex-1 space-y-3 text-center sm:text-left">
          <Skeleton className="h-7 w-48 rounded mx-auto sm:mx-0" />
          <div className="flex flex-wrap justify-center sm:justify-start gap-4">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <div className="flex flex-wrap justify-center sm:justify-start gap-4">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
    {/* Content */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  </div>
);
