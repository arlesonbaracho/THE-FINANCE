function Bone({ w, h, r = 6 }: { w: number | string; h: number; r?: number }) {
  return (
    <div
      className="animate-pulse"
      style={{ width: w, height: h, borderRadius: r, background: 'var(--tf-border)', flexShrink: 0 }}
    />
  )
}

export default function RestauranteLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Bone w={180} h={22} />
          <Bone w={260} h={13} r={4} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--tf-border)', paddingBottom: 12 }}>
        {[100, 80, 140].map((w, i) => (
          <Bone key={i} w={w} h={34} r={8} />
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Bone w={160} h={36} r={8} />
        <div style={{ flex: 1 }} />
        <Bone w={120} h={36} r={8} />
      </div>

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              background: 'var(--tf-surface)',
              border: '1px solid var(--tf-border)',
              borderRadius: 10,
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Bone w={60} h={22} r={6} />
              <Bone w={50} h={22} r={6} />
            </div>
            <Bone w="80%" h={13} r={4} />
            <Bone w="60%" h={11} r={4} />
          </div>
        ))}
      </div>
    </div>
  )
}
