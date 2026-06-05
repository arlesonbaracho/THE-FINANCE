import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      tenantId: string
      tenantName: string
      brandId?: string | null
      customRoleId?: string
      avatarUrl?: string
      subscriptionStatus?: string | null
      trialEndsAt?: string | null
      planFeatures?: unknown
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    tenantId?: string
    tenantName?: string
    brandId?: string | null
    customRoleId?: string
    avatarUrl?: string
    subscriptionStatus?: string | null
    trialEndsAt?: string | null
    planFeatures?: unknown
    passwordChangedAt?: string | null
  }
}
