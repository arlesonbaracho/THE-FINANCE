import type { Metadata } from 'next'
import { Inter, Manrope, Cabin, Instrument_Serif } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' })
const cabin = Cabin({ subsets: ['latin'], variable: '--font-cabin', display: 'swap' })
const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'THE FINANCE — Gestão completa para restaurantes',
  description:
    'Sistema de gestão para restaurantes com estoque inteligente, agente de IA, cardápio digital, KDS e financeiro integrado. Comece grátis.',
  openGraph: {
    title: 'THE FINANCE',
    description:
      'Sistema de gestão para restaurantes com estoque inteligente, agente de IA, cardápio digital, KDS e financeiro integrado. Comece grátis.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://thefinance.com.br',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${inter.className} ${inter.variable} ${manrope.variable} ${cabin.variable} ${instrumentSerif.variable}`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
