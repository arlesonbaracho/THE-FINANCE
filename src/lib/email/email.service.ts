import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { render } from '@react-email/render'
import { PasswordResetEmail } from './templates/password-reset'
import { PasswordChangedEmail } from './templates/password-changed'
import { AccountLockedEmail } from './templates/account-locked'
import { WelcomeInviteEmail } from './templates/welcome-invite'
import { AdminPasswordResetEmail } from './templates/admin-password-reset'

const FROM = process.env.EMAIL_FROM ?? 'THE FINANCE <noreply@thefinance.app>'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? 'placeholder')
  return _resend
}

async function send(to: string, subject: string, html: string) {
  // Prioridade 1: Resend
  if (process.env.RESEND_API_KEY) {
    const { data, error } = await getResend().emails.send({ from: FROM, to, subject, html })
    if (error) throw new Error(`Resend failed: ${error.message}`)
    return data
  }

  // Prioridade 2: SMTP via Nodemailer (Gmail, Brevo, Mailgun, etc.)
  if (process.env.EMAIL_SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST,
      port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
      secure: process.env.EMAIL_SMTP_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_SMTP_PASS,
      },
    })
    const info = await transporter.sendMail({ from: FROM, to, subject, html })
    return { id: info.messageId }
  }

  // Sem provider configurado — loga no console
  console.log(`\n📧 [EMAIL DEV] To: ${to}\nSubject: ${subject}\n`)
  return { id: 'dev-mode' }
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
