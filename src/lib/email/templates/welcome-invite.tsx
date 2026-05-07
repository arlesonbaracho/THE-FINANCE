import { Button, Heading, Link, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'

interface WelcomeInviteProps {
  inviteLink: string
  restaurantName: string
  role: string
}

export function WelcomeInviteEmail({ inviteLink, restaurantName, role }: WelcomeInviteProps) {
  return (
    <BaseLayout preview={`Você foi convidado para ${restaurantName} — THE FINANCE`}>
      <Heading style={h1}>Convite para o THE FINANCE</Heading>
      <Text style={text}>
        Você foi convidado para se juntar ao restaurante{' '}
        <strong style={{ color: '#f4f4f5' }}>{restaurantName}</strong> como{' '}
        <strong style={{ color: '#f97316' }}>{role}</strong>.
      </Text>
      <Text style={text}>
        Clique no botão abaixo para criar sua conta. O link é válido por{' '}
        <strong style={{ color: '#f4f4f5' }}>48 horas</strong>.
      </Text>

      <Button href={inviteLink} style={button}>
        Aceitar convite
      </Button>

      <Text style={hint}>
        Ou copie e cole este link no seu navegador:
      </Text>
      <Link href={inviteLink} style={link}>{inviteLink}</Link>
    </BaseLayout>
  )
}

const h1: React.CSSProperties = {
  color: '#f4f4f5',
  fontSize: '22px',
  fontWeight: '700',
  margin: '0 0 16px',
}

const text: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 16px',
}

const button: React.CSSProperties = {
  backgroundColor: '#f97316',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  margin: '8px 0 24px',
  padding: '12px 28px',
  textDecoration: 'none',
}

const hint: React.CSSProperties = {
  color: '#71717a',
  fontSize: '12px',
  margin: '0 0 6px',
}

const link: React.CSSProperties = {
  color: '#f97316',
  fontSize: '12px',
  wordBreak: 'break-all',
}
