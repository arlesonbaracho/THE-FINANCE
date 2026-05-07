import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface BaseLayoutProps {
  preview: string
  children: React.ReactNode
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>THE FINANCE</Text>
            <Text style={logoSub}>Sistema de Gestão para Restaurantes</Text>
          </Section>

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              Este é um email automático. Não responda a esta mensagem.
            </Text>
            <Text style={footerText}>
              © {new Date().getFullYear()} THE FINANCE — Todos os direitos reservados
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body: React.CSSProperties = {
  backgroundColor: '#09090b',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  margin: 0,
  padding: '40px 0',
}

const container: React.CSSProperties = {
  backgroundColor: '#18181b',
  border: '1px solid #27272a',
  borderRadius: '12px',
  margin: '0 auto',
  maxWidth: '520px',
  overflow: 'hidden',
}

const header: React.CSSProperties = {
  backgroundColor: '#09090b',
  borderBottom: '1px solid #27272a',
  padding: '24px 32px',
  textAlign: 'center',
}

const logo: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700',
  letterSpacing: '0.05em',
  margin: '0 0 4px',
}

const logoSub: React.CSSProperties = {
  color: '#71717a',
  fontSize: '11px',
  letterSpacing: '0.08em',
  margin: '0',
  textTransform: 'uppercase',
}

const content: React.CSSProperties = {
  padding: '32px',
}

const hr: React.CSSProperties = {
  borderColor: '#27272a',
  margin: '0',
}

const footer: React.CSSProperties = {
  padding: '20px 32px',
  textAlign: 'center',
}

const footerText: React.CSSProperties = {
  color: '#52525b',
  fontSize: '11px',
  lineHeight: '18px',
  margin: '0',
}
