import { Heading, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'

interface AccountLockedProps {
  userName?: string
  unlockTime: string
}

export function AccountLockedEmail({ userName, unlockTime }: AccountLockedProps) {
  return (
    <BaseLayout preview="Conta temporariamente bloqueada — THE FINANCE">
      <Heading style={h1}>Conta temporariamente bloqueada</Heading>
      <Text style={text}>
        {userName ? `Olá, ${userName}` : 'Olá'}! Detectamos múltiplas tentativas de login inválidas na sua conta.
      </Text>
      <Text style={text}>
        Por segurança, sua conta foi bloqueada temporariamente até:{' '}
        <strong style={{ color: '#f4f4f5' }}>{unlockTime}</strong>
      </Text>
      <Text style={text}>
        Se você foi quem tentou acessar, basta aguardar o desbloqueio automático.
        Se não reconhece estas tentativas, considere alterar sua senha assim que seu acesso for restaurado.
      </Text>
      <Text style={footer}>
        Para desbloqueio imediato, contate o administrador do seu restaurante.
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

const footer: React.CSSProperties = {
  backgroundColor: '#27272a',
  borderRadius: '6px',
  color: '#71717a',
  fontSize: '12px',
  margin: '8px 0 0',
  padding: '12px 16px',
}
