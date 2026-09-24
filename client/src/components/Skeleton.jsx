export function Skeleton({ className = '' }) {
  return (
    <div
      className={`skeleton-shimmer rounded-md ${className}`}
      aria-hidden="true"
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-graphite-700 bg-graphite-900 p-5 shadow-panel">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function RepositoryCardSkeleton() {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-graphite-700 bg-graphite-900 p-5 shadow-panel">
      <div>
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-4/5" />
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-8 flex-1 rounded-lg" />
        <Skeleton className="h-8 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

export function IssueRowSkeleton() {
  return (
    <div className="rounded-xl border border-graphite-700 bg-graphite-900 p-4 shadow-panel">
      <div className="flex items-center gap-2 mb-2.5">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 6 }) {
  return (
    <tr className="border-b border-graphite-700/60">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}
