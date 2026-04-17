export function CardSkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card animate-pulse">
      <div className="aspect-square bg-surface-container" />
      <div className="p-4 space-y-2.5">
        <div className="h-3 bg-surface-container rounded-full w-16" />
        <div className="h-4 bg-surface-container rounded-full w-full" />
        <div className="h-4 bg-surface-container rounded-full w-3/4" />
        <div className="h-3 bg-surface-container rounded-full w-12" />
        <div className="h-5 bg-surface-container rounded-full w-20" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="w-full h-[500px] lg:h-[600px] bg-surface-container animate-pulse rounded-b-3xl" />
  );
}

export function TextSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-surface-container rounded-full animate-pulse"
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

export function CircleSkeleton({ size = 80 }) {
  return (
    <div
      className="rounded-full bg-surface-container animate-pulse"
      style={{ width: size, height: size }}
    />
  );
}
