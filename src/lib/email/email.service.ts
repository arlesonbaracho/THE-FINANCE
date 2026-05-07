import { Resend } from 'resend'
import { render } from '@react-email/render'
import { PasswordResetEmail } from './templates/password-reset'
import { PasswordChangedEmail } from './templates/password-changed'
import { AccountLockedEmail } from './templates/account-locked'
import { WelcomeInviteEmail } from './templates/welcome-invite'
import { AdminPasswordResetEmail } from './templates/admin-password-reset'

const FROM = process.env.EMAIL_FROM ?? 'THE FINANCE <noreply@thefinance.app>'

// Instanciação lazy — evita erro no build quando RESEND_API_KEY não está definida
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? 'placeholder')
  return _resend
}

function isDev() {
  return !process.env.RESEND_API_KEY || process.env.NODE_ENV === 'development'
}

async function send(to: string, subject: string, html: string) {
  if (isDev()) {
    console.log(`\n📧 [EMAIL DEV] To: ${to}\nSubject: ${subject}\n`)
    return { id: 'dev-mode' }
  }
  const { data, error } = await getResend().emails.send({ from: FROM, to, subject, html })
  if (error) throw new Error(`Email send failed: ${error.message}`)
  return data
}

export const emailService = {
  async sendPasswordReset(to: string, resetLink: string, expiresInMinutes: number, userName?: string) {
    const html = await render(PasswordResetEmail({ resetLink, expiresInMinutes, userName }))
    return send(to, 'Recuperação de senha — THE FINANCE', html)
  },

  async sendPasswordChanged(to: string, ip: string, timestamp: string, userName?: string) {
    const html = await render(PasswordChangedEmail({ ip, timestamp, userName }))
    return send(to, 'Sua senha foi alterada — THE FINANCE', html)
  },

  async sendAccountLocked(to: string, unlockTime: Date, userName?: string) {
    const formatted = unlockTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const html = await render(AccountLockedEmail({ unlockTime: formatted, userName }))
    return send(to, 'Conta temporariamente bloqueada — THE FINANCE', html)
  },

  async sendWelcomeInvite(to: string, inviteLink: string, restaurantName: string, role: string) {
    const html = await render(WelcomeInviteEmail({ inviteLink, restaurantName, role }))
    return send(to, `Convite para ${restaurantName} — THE FINANCE`, html)
  },

  async sendAdminPasswordReset(to: string, resetLink: string, ip: string) {
    const html = await render(AdminPasswordResetEmail({ resetLink, ip }))
    return send(to, '[SUPER ADMIN] Recuperação de senha — THE FINANCE', html)
  },
}
