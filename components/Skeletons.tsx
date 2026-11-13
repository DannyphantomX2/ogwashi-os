const bar = "rounded-md bg-stone-200 motion-safe:animate-pulse";

export function FarmerCardSkeleton() {
  return (
    <li
      aria-hidden="true"
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-2/3 space-y-2">
          <div className={`${bar} h-5 w-3/4`} />
          <div className={`${bar} h-4 w-1/3`} />
        </div>
        <div className={`${bar} h-6 w-16 rounded-full`} />
      </div>
      <div className="mt-4 flex gap-8">
        <div className="space-y-2">
          <div className={`${bar} h-3 w-12`} />
          <div className={`${bar} h-4 w-24`} />
        </div>
        <div className="space-y-2">
          <div className={`${bar} h-3 w-16`} />
          <div className={`${bar} h-4 w-12`} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className={`${bar} h-11 rounded-xl`} />
        <div className={`${bar} h-11 rounded-xl`} />
        <div className={`${bar} h-11 rounded-xl`} />
      </div>
    </li>
  );
}

export function FarmerListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading farmers">
      <ul
        aria-hidden="true"
        className="grid gap-3 p-4 pb-28 sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: count }, (_, i) => (
          <FarmerCardSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div aria-hidden="true" className="bg-white px-4 pb-3 pt-4">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-stone-100 p-3">
            <div className={`${bar} h-3 w-16`} />
            <div className={`${bar} mt-2 h-7 w-14`} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${bar} h-11 w-28 shrink-0 rounded-full`} />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" className="min-h-dvh">
      <div
        aria-hidden="true"
        className="flex items-center justify-between bg-green-800 px-4 py-4"
      >
        <div className="h-6 w-40 rounded-md bg-green-700 motion-safe:animate-pulse" />
        <div className="h-6 w-20 rounded-md bg-green-700 motion-safe:animate-pulse" />
      </div>
      <StatsSkeleton />
      <div
        aria-hidden="true"
        className="border-b border-stone-200 bg-white px-4 py-3"
      >
        <div className={`${bar} h-11 w-full rounded-xl`} />
        <div className="mt-2 flex gap-2">
          <div className={`${bar} h-11 flex-1 rounded-xl`} />
          <div className={`${bar} h-11 flex-1 rounded-xl`} />
        </div>
      </div>
      <FarmerListSkeleton />
    </div>
  );
}
