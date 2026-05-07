import { Button, Heading, Link, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'

interface AdminPasswordResetProps {
  resetLink: string
  ip: string
}

export function AdminPasswordResetEmail({ resetLink, ip }: AdminPasswordResetProps) {
  return (
    <BaseLayout preview="[SUPER ADMIN] Recuperação de senha — THE FINANCE">
      <Heading style={h1}>Recuperação de senha — Super Admin</Heading>

      <div style={alert}>
        <Text style={alertText}>⚠ ACESSO DE ALTA SEGURANÇA</Text>
        <Text style={alertSubText}>Esta operação afeta o painel administrativo completo do sistema.</Text>
      </div>

      <Text style={text}>
        Uma solicitação de redefinição de senha foi iniciada para a conta Super Admin.
      </Text>

      <div style={infoBox}>
        <Text style={infoRow}><strong style={label}>IP de origem:</strong> {ip}</Text>
        <Text style={infoRow}><strong style={label}>Validade:</strong> 15 minutos</Text>
      </div>

      <Text style={text}>
        Clique no botão abaixo para redefinir sua senha de acesso administrativo.
        Após a redefinição, sua autenticação em dois fatores (2FA) será reiniciada.
      </Text>

      <Button href={resetLink} style={button}>
        Redefinir senha de Admin
      </Button>

      <Text style={hint}>Ou copie e cole no navegador:</Text>
      <Link href={resetLink} style={link}>{resetLink}</Link>

      <Text style={warning}>
        Se você não solicitou esta redefinição, alguém pode estar tentando acessar indevidamente o sistema administrativo. Ignore este email — o link expirará em 15 minutos.
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

const alert: React.CSSProperties = {
  backgroundColor: '#2d1a00',
  border: '1px solid #92400e',
  borderRadius: '6px',
  marginBottom: '20px',
  padding: '12px 16px',
}

const alertText: React.CSSProperties = {
  color: '#fbbf24',
  fontSize: '13px',
  fontWeight: '700',
  margin: '0 0 4px',
}

const alertSubText: React.CSSProperties = {
  color: '#d97706',
  fontSize: '12px',
  margin: '0',
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
  padding: '14px 16px',
}

const infoRow: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '13px',
  margin: '0 0 6px',
}

const label: React.CSSProperties = { color: '#f4f4f5' }

const button: React.CSSProperties = {
  backgroundColor: '#dc2626',
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
  backgroundColor: '#3f1515',
  border: '1px solid #7f1d1d',
  borderRadius: '6px',
  color: '#fca5a5',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '24px 0 0',
  padding: '12px 16px',
}
