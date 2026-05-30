export default function Loading() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-lg animate-pulse"
          style={{ background: 'var(--tf-surface2)' }}
        />
      ))}
    </div>
  )
}
