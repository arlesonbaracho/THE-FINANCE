import { Heading, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'

interface PasswordChangedProps {
  userName?: string
  ip: string
  timestamp: string
}

export function PasswordChangedEmail({ userName, ip, timestamp }: PasswordChangedProps) {
  return (
    <BaseLayout preview="Sua senha foi alterada — THE FINANCE">
      <Heading style={h1}>Senha alterada com sucesso</Heading>
      <Text style={text}>
        {userName ? `Olá, ${userName}` : 'Olá'}! A senha da sua conta no THE FINANCE foi alterada.
      </Text>

      <div style={infoBox}>
        <Text style={infoRow}><strong style={label}>Data e hora:</strong> {timestamp}</Text>
        <Text style={infoRow}><strong style={label}>IP de origem:</strong> {ip}</Text>
      </div>

      <Text style={warning}>
        Se você não realizou esta alteração, entre em contato imediatamente com o administrador do seu restaurante ou acesse o sistema para recuperar o acesso.
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

const infoBox: React.CSSProperties = {
  backgroundColor: '#27272a',
  borderRadius: '8px',
  margin: '0 0 20px',
  padding: '16px',
}

const infoRow: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '13px',
  margin: '0 0 6px',
}

const label: React.CSSProperties = { color: '#f4f4f5' }

const warning: React.CSSProperties = {
  backgroundColor: '#3f1515',
  border: '1px solid #7f1d1d',
  borderRadius: '6px',
  color: '#fca5a5',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
  padding: '12px 16px',
}
