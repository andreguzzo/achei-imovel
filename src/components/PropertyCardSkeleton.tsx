import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder that mirrors the PropertyCard layout while results load. */
const PropertyCardSkeleton = () => (
  <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
    <Skeleton className="aspect-[4/3] w-full rounded-none" />
    <div className="flex flex-1 flex-col gap-2 p-4">
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-4 pt-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="mt-1 h-5 w-28" />
      <Skeleton className="mt-2 h-9 w-full" />
    </div>
  </div>
);

export const PropertyCardSkeletonGrid = ({ count = 6, className }: { count?: number; className?: string }) => (
  <div className={className ?? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"}>
    {Array.from({ length: count }).map((_, i) => (
      <PropertyCardSkeleton key={i} />
    ))}
  </div>
);

export default PropertyCardSkeleton;
