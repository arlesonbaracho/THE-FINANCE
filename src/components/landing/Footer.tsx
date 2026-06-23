import Link from 'next/link'
import { TFMark } from '@/components/ui/tf-mark'

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Produto',
    links: [
      { label: 'Funcionalidades', href: '#' },
      { label: 'Planos', href: '#' },
      { label: 'Novidades', href: '#' },
      { label: 'Roadmap', href: '#' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Contato', href: '#' },
      { label: 'Trabalhe conosco', href: '#' },
    ],
  },
  {
    title: 'Suporte',
    links: [
      { label: 'Central de ajuda', href: '#' },
      { label: 'Documentação', href: '#' },
      { label: 'Status', href: '#' },
      { label: 'Política de Privacidade', href: '/privacidade' },
      { label: 'Termos', href: '/termos' },
    ],
  },
]

const linkStyle: React.CSSProperties = {
  fontFamily: 'var(--font-inter)',
  fontSize: 14,
  color: 'rgba(255,255,255,0.55)',
  textDecoration: 'none',
  transition: 'color 0.2s',
}

export function Footer() {
  return (
    <footer style={{
      background: '#0d0d0d',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '56px clamp(24px,6vw,120px) 32px',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 40, marginBottom: 48,
      }}>
        {/* brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <TFMark size={32} main="#4ADE80" accent="#16a34a" />
            <span style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 17,
              color: '#fff', letterSpacing: '0.04em',
            }}>THE FINANCE</span>
          </div>
          <p style={{ fontFamily: 'var(--font-inter)', fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.4)', margin: '0 0 16px', maxWidth: 240 }}>
            Sistema de gestão completo para restaurantes e lanchonetes.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Dados protegidos', 'SSL'].map((b) => (
              <span key={b} style={{
                fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 999, padding: '3px 10px',
              }}>{b}</span>
            ))}
          </div>
        </div>

        {COLS.map((col) => (
          <div key={col.title}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 12,
              color: 'rgba(255,255,255,0.35)', margin: '0 0 16px',
              textTransform: 'uppercase', letterSpacing: '0.12em',
            }}>{col.title}</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {col.links.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} style={linkStyle}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#fff')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)')}
                  >{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24,
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
          © 2026 THE FINANCE · Todos os direitos reservados
        </p>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
          Feito com ♥ para restaurantes brasileiros
        </p>
      </div>
    </footer>
  )
}
