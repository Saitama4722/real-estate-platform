/**
 * Loading skeletons for the results grid, shown while a filter/sort/page
 * navigation is pending. The block geometry copies the real PropertyCard
 * (rounded-xl surface, 4:3 photo, px-4 pt-3.5 pb-4 body with price → specs →
 * address rows) so nothing shifts when data lands. Shimmer comes from the
 * shared .ctr-skel class; under reduced motion it renders as a static wash.
 */
export function CatalogSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl bg-surface-raised shadow-sm"
        >
          <div className="ctr-skel aspect-[4/3] w-full" />
          <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-4">
            <div className="ctr-skel h-6 w-2/5 rounded-md" />
            <div className="ctr-skel h-4 w-4/5 rounded-md" />
            <div className="ctr-skel h-4 w-3/5 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
