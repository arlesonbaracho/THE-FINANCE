import { Button, Heading, Link, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'

interface PasswordResetProps {
  resetLink: string
  expiresInMinutes: number
  userName?: string
}

export function PasswordResetEmail({ resetLink, expiresInMinutes, userName }: PasswordResetProps) {
  return (
    <BaseLayout preview="Recuperação de senha — THE FINANCE">
      <Heading style={h1}>Recuperar sua senha</Heading>
      <Text style={text}>
        {userName ? `Olá, ${userName}` : 'Olá'}! Recebemos uma solicitação para redefinir a senha da sua conta no THE FINANCE.
      </Text>
      <Text style={text}>
        Clique no botão abaixo para criar uma nova senha. Este link é válido por{' '}
        <strong style={{ color: '#f4f4f5' }}>{expiresInMinutes} minutos</strong>.
      </Text>

      <Button href={resetLink} style={button}>
        Redefinir minha senha
      </Button>

      <Text style={hint}>
        Ou copie e cole este link no seu navegador:
      </Text>
      <Link href={resetLink} style={link}>{resetLink}</Link>

      <Text style={warning}>
        Se você não solicitou a recuperação de senha, ignore este email. Sua senha permanece a mesma.
      </Text>
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

const warning: React.CSSProperties = {
  backgroundColor: '#27272a',
  borderLeft: '3px solid #f97316',
  borderRadius: '4px',
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '24px 0 0',
  padding: '12px 16px',
}
