export default function RelatoriosLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '2px solid var(--tf-border)',
          borderTopColor: 'var(--tf-primary)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
