function Bone({ w, h, r = 6 }: { w: number | string; h: number; r?: number }) {
  return (
    <div
      className="animate-pulse"
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: 'var(--tf-border)',
        flexShrink: 0,
      }}
    />
  )
}

export default function DashboardLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Bone w={160} h={22} />
        <Bone w={260} h={13} r={4} />
      </div>

      {/* Stat cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              background: 'var(--tf-surface)',
              border: '1px solid var(--tf-border)',
              borderRadius: 12,
              padding: '20px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Bone w={100} h={12} r={4} />
              <Bone w={32} h={32} r={8} />
            </div>
            <Bone w={60} h={28} r={6} />
            <Bone w={120} h={11} r={4} />
          </div>
        ))}
      </div>

      {/* Toolbar skeleton */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Bone w={220} h={36} r={8} />
        <Bone w={140} h={36} r={8} />
        <div style={{ flex: 1 }} />
        <Bone w={120} h={36} r={8} />
      </div>

      {/* Table skeleton */}
      <div
        style={{
          background: 'var(--tf-surface)',
          border: '1px solid var(--tf-border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            padding: '12px 16px',
            borderBottom: '1px solid var(--tf-border)',
          }}
        >
          <Bone w={180} h={11} r={4} />
          <Bone w={120} h={11} r={4} />
          <Bone w={80} h={11} r={4} />
          <Bone w={80} h={11} r={4} />
        </div>
        {/* Data rows */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 16,
              padding: '14px 16px',
              borderBottom: '1px solid var(--tf-border)',
              alignItems: 'center',
            }}
          >
            <Bone w={32} h={32} r={16} />
            <Bone w={140} h={13} r={4} />
            <div style={{ flex: 1 }} />
            <Bone w={90} h={11} r={4} />
            <Bone w={60} h={22} r={6} />
            <Bone w={24} h={24} r={4} />
          </div>
        ))}
      </div>
    </div>
  )
}
