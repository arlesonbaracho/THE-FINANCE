'use client'

import { useSession } from 'next-auth/react'
import { useMemo } from 'react'
import { parsePlanFeatures, type PlanFeatures } from '@/lib/plan-features'

export interface UsePlanFeaturesResult {
  features: PlanFeatures
  status: string | null
  isTrialActive: boolean
  isBlocked: boolean
  trialDaysLeft: number | null
  can: (feature: keyof PlanFeatures) => boolean
}

export function usePlanFeatures(): UsePlanFeaturesResult {
  const { data: session } = useSession()

  return useMemo(() => {
    const rawFeatures = (session?.user as { planFeatures?: unknown })?.planFeatures
    const status = (session?.user as { subscriptionStatus?: string })?.subscriptionStatus ?? null
    const trialEndsAt = (session?.user as { trialEndsAt?: string })?.trialEndsAt

    const features = parsePlanFeatures(rawFeatures)
    const isBlocked = status === 'SUSPENDED' || status === 'CANCELLED'
    const isTrialActive = status === 'TRIAL'

    let trialDaysLeft: number | null = null
    if (isTrialActive && trialEndsAt) {
      const diff = new Date(trialEndsAt).getTime() - Date.now()
      trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }

    return {
      features,
      status,
      isTrialActive,
      isBlocked,
      trialDaysLeft,
      can: (feature: keyof PlanFeatures) => features[feature],
    }
  }, [session])
}
