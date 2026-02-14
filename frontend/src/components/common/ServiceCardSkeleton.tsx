import React from "react";
import { Skeleton, SkeletonAvatar } from "./Skeleton";

interface ServiceCardSkeletonProps {
  className?: string;
}

export const ServiceCardSkeleton: React.FC<ServiceCardSkeletonProps> = ({
  className = "",
}) => (
  <div
    className={`rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl ${className}`}
  >
    {/* Image skeleton with shimmer */}
    <div className="relative h-48 bg-slate-200 dark:bg-slate-800 animate-pulse">
      <div className="absolute inset-0 animate-shimmer shimmer-bg" />
      {/* Category badge skeleton */}
      <div className="absolute top-3 left-3">
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      {/* Favorite button skeleton */}
      <div className="absolute top-3 right-3">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>

    {/* Content */}
    <div className="p-4 sm:p-6 space-y-3">
      {/* Title */}
      <Skeleton className="h-5 w-3/4 rounded" />

      {/* Description */}
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-2/3 rounded" />
      </div>

      {/* Professional info */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <SkeletonAvatar size="sm" />
        </div>
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/50">
        <div className="space-y-1">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-6 w-20 rounded" />
        </div>
        <Skeleton className="h-4 w-24 rounded" />
      </div>
    </div>
  </div>
);

export default ServiceCardSkeleton;
