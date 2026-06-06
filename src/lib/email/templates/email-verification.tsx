import { Heading, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'

interface EmailVerificationProps {
  code: string
  name?: string
  expiresInMinutes: number
}

export function EmailVerificationEmail({ code, name, expiresInMinutes }: EmailVerificationProps) {
  return (
    <BaseLayout preview={`Seu código de verificação: ${code}`}>
      <Heading style={h1}>Confirme seu email</Heading>
      <Text style={text}>
        {name ? `Olá, ${name}` : 'Olá'}! Para concluir o cadastro no THE FINANCE, use o código abaixo.
      </Text>
      <Text style={text}>
        Digite este código na tela de verificação:
      </Text>

      <div style={codeBox}>
        <Text style={codeText}>{code}</Text>
      </div>

      <Text style={expiry}>
        Este código expira em <strong style={{ color: '#f4f4f5' }}>{expiresInMinutes} minutos</strong>.
      </Text>

      <Text style={warning}>
        Se você não tentou criar uma conta no THE FINANCE, ignore este email. Nenhuma ação é necessária.
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

const codeBox: React.CSSProperties = {
  backgroundColor: '#09090b',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  margin: '8px 0 24px',
  padding: '20px',
  textAlign: 'center',
}

const codeText: React.CSSProperties = {
  color: '#f4f4f5',
  fontSize: '36px',
  fontWeight: '700',
  letterSpacing: '0.3em',
  margin: '0',
  fontFamily: 'monospace',
}

const expiry: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '13px',
  margin: '0 0 20px',
}

const warning: React.CSSProperties = {
  backgroundColor: '#27272a',
  borderLeft: '3px solid #f97316',
  borderRadius: '4px',
  color: '#a1a1aa',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0',
  padding: '12px 16px',
}
