function Bone({ w, h, r = 6 }: { w: number | string; h: number; r?: number }) {
  return (
    <div
      className="animate-pulse"
      style={{ width: w, height: h, borderRadius: r, background: 'var(--tf-border)', flexShrink: 0 }}
    />
  )
}

export default function ConfiguracoesLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Bone w={130} h={22} />
          <Bone w={210} h={13} r={4} />
        </div>
        <Bone w={140} h={36} r={8} />
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              background: 'var(--tf-surface)',
              border: '1px solid var(--tf-border)',
              borderRadius: 10,
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Bone w={90} h={11} r={4} />
            <Bone w={50} h={24} r={6} />
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Bone w={200} h={36} r={8} />
        <Bone w={120} h={36} r={8} />
        <Bone w={120} h={36} r={8} />
        <div style={{ flex: 1 }} />
        <Bone w={140} h={36} r={8} />
      </div>

      {/* List */}
      <div
        style={{
          background: 'var(--tf-surface)',
          border: '1px solid var(--tf-border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 14,
              padding: '14px 16px',
              borderBottom: '1px solid var(--tf-border)',
              alignItems: 'center',
            }}
          >
            <Bone w={36} h={36} r={18} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <Bone w={140} h={13} r={4} />
              <Bone w={180} h={11} r={4} />
            </div>
            <Bone w={60} h={22} r={6} />
            <Bone w={24} h={24} r={4} />
          </div>
        ))}
      </div>
    </div>
  )
}
