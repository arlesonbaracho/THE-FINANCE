function Bone({ w, h, r = 6 }: { w: number | string; h: number; r?: number }) {
  return (
    <div
      className="animate-pulse"
      style={{ width: w, height: h, borderRadius: r, background: 'var(--tf-border)', flexShrink: 0 }}
    />
  )
}

export default function DashboardHomeLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Bone w={120} h={22} />
        <Bone w={240} h={13} r={4} />
      </div>

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
    </div>
  )
}
