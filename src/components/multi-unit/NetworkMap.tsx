'use client'

interface Marcador {
  lat: number
  lng: number
  label: string
  performance: 'top' | 'mid' | 'baixo'
}

interface NetworkMapProps {
  marcadores: Marcador[]
  apiKey: string
}

const COR_PERFORMANCE: Record<string, string> = {
  top: 'green',
  mid: 'yellow',
  baixo: 'red',
}

export function NetworkMap({ marcadores, apiKey }: NetworkMapProps) {
  if (!apiKey || marcadores.length === 0) {
    return (
      <div
        style={{
          height: 300,
          borderRadius: 12,
          border: '1px solid var(--tf-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--tf-surface)',
          color: 'var(--tf-txt3)',
          fontSize: 13,
        }}
      >
        {!apiKey
          ? 'Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para exibir o mapa'
          : 'Nenhuma unidade com localização configurada'}
      </div>
    )
  }

  const markersParam = marcadores
    .map(
      (m) =>
        `color:${COR_PERFORMANCE[m.performance]}%7Clabel:${encodeURIComponent(m.label[0])}%7C${m.lat},${m.lng}`
    )
    .join('&markers=')

  const centro = `${marcadores[0].lat},${marcadores[0].lng}`
  const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${centro}&zoom=10&markers=${markersParam}`

  return (
    <iframe
      width="100%"
      height="300"
      style={{ borderRadius: 12, border: '1px solid var(--tf-border)', display: 'block' }}
      loading="lazy"
      allowFullScreen
      src={src}
      title="Mapa da Rede"
    />
  )
}
