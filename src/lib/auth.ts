import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/email/email.service'

const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,
    updateAge: 60 * 60,
  },
  pages: {
    signIn: '/auth/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Credenciais inválidas')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: {
            tenant: { include: { subscription: { include: { plan: true } } } },
            customRole: true,
          },
        })

        // Always run bcrypt to prevent timing attacks
        const dummyHash = '$2a$12$dummyhashtopreventtimingattacks.padpadpadpa'
        const passwordToCheck = user?.password ?? dummyHash
        const isPasswordValid = await bcrypt.compare(credentials.password, passwordToCheck)

        // Check lockout AFTER bcrypt (timing-safe)
        if (user && user.lockedUntil && user.lockedUntil > new Date()) {
          const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
          throw new Error(`Conta bloqueada. Tente novamente em ${minutes} minuto${minutes !== 1 ? 's' : ''}.`)
        }

        if (!user || !user.password || !isPasswordValid) {
          // Increment failed attempts if user exists
          if (user) {
            const newCount = user.failedLoginAttempts + 1
            const shouldLock = newCount >= MAX_FAILED_ATTEMPTS
            const lockedUntil = shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null

            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: newCount,
                ...(lockedUntil && { lockedUntil }),
              },
            })

            // Log failed attempt
            if (user.tenantId) {
              await prisma.userAccessLog.create({
                data: { userId: user.id, tenantId: user.tenantId, action: 'login_failed' },
              }).catch(() => {})
            }

            if (shouldLock) {
              // Send lockout email (non-blocking)
              if (user.email) {
                emailService.sendAccountLocked(user.email, lockedUntil!, user.name ?? undefined).catch(() => {})
              }
              throw new Error(`Conta bloqueada por ${LOCK_DURATION_MS / 60000} minutos após múltiplas tentativas.`)
            }

            const remaining = MAX_FAILED_ATTEMPTS - newCount
            throw new Error(`Credenciais inválidas. ${remaining} tentativa${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`)
          }
          throw new Error('Credenciais inválidas')
        }

        if (user.status === 'INACTIVE') {
          throw new Error('Usuário desativado. Contate o administrador.')
        }

        if (!user.tenant?.active) {
          throw new Error('Conta inativa. Entre em contato com o suporte.')
        }

        // Successful login — reset failed attempts
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null, ultimoAcesso: new Date() },
        })

        // Log success
        if (user.tenantId) {
          await prisma.userAccessLog.create({
            data: { userId: user.id, tenantId: user.tenantId, action: 'login' },
          }).catch(() => {})
        }

        const sub = user.tenant?.subscription
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant?.name,
          brandId: user.tenant?.brandId ?? null,
          customRoleId: user.customRoleId,
          avatarUrl: user.avatarUrl,
          subscriptionStatus: sub?.status ?? null,
          trialEndsAt: sub?.trialEndsAt?.toISOString() ?? null,
          planFeatures: sub?.plan?.features ?? null,
          passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const u = user as {
          role?: string; tenantId?: string; tenantName?: string
          customRoleId?: string; avatarUrl?: string
          subscriptionStatus?: string | null; trialEndsAt?: string | null
          planFeatures?: unknown; passwordChangedAt?: string | null
        }
        token.role = u.role
        token.tenantId = u.tenantId
        token.tenantName = u.tenantName
        token.brandId = (u as { brandId?: string | null }).brandId ?? null
        token.customRoleId = u.customRoleId
        token.avatarUrl = u.avatarUrl
        token.subscriptionStatus = u.subscriptionStatus
        token.trialEndsAt = u.trialEndsAt
        token.planFeatures = u.planFeatures
        token.passwordChangedAt = u.passwordChangedAt
      }

      // On token refresh, verify password hasn't been changed (session invalidation)
      if (trigger === 'update' || (!user && token.sub)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub as string },
            select: { passwordChangedAt: true, status: true, lockedUntil: true },
          })
          if (!dbUser || dbUser.status === 'INACTIVE') return {} as typeof token

          if (dbUser.passwordChangedAt && token.passwordChangedAt) {
            const dbTs = dbUser.passwordChangedAt.toISOString()
            if (dbTs !== token.passwordChangedAt) return {} as typeof token
          }
          if (dbUser.passwordChangedAt && !token.passwordChangedAt) {
            return {} as typeof token
          }
        } catch { /* allow on DB error */ }
      }

      return token
    },
    async session({ session, token }) {
      if (!token.sub) return session
      if (session.user) {
        session.user.id = token.sub
        session.user.role = token.role as string
        session.user.tenantId = token.tenantId as string
        session.user.tenantName = token.tenantName as string
        session.user.brandId = token.brandId as string | null | undefined
        session.user.customRoleId = token.customRoleId as string | undefined
        session.user.avatarUrl = token.avatarUrl as string | undefined
        ;(session.user as Record<string, unknown>).subscriptionStatus = token.subscriptionStatus
        ;(session.user as Record<string, unknown>).trialEndsAt = token.trialEndsAt
        ;(session.user as Record<string, unknown>).planFeatures = token.planFeatures
      }
      return session
    },
  },
}
