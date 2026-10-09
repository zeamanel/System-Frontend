import './Skeleton.css'

/** Shimmering placeholder block for loading states. */
export function SkeletonBlock({
  width,
  height = 14,
  shape = 'line',
}: {
  width?: string
  height?: number
  shape?: 'line' | 'box' | 'circle'
}) {
  return (
    <span
      className={`skeleton skeleton--${shape}`}
      style={{ width: width ?? '100%', height }}
      aria-hidden="true"
    />
  )
}

/** A stack of placeholder lines for panel loading states. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <span className="skeleton-text">
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonBlock
          key={index}
          width={index === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </span>
  )
}
