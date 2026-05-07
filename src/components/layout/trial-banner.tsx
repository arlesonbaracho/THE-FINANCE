'use client'

import { usePlanFeatures } from '@/hooks/usePlanFeatures'
import { AlertTriangle } from 'lucide-react'

export function TrialBanner() {
  const { isTrialActive, trialDaysLeft } = usePlanFeatures()

  if (!isTrialActive) return null

  const urgent = (trialDaysLeft ?? 99) <= 3

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 text-sm font-medium ${
        urgent ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          {trialDaysLeft === 0
            ? 'Seu período de teste encerrou hoje.'
            : `Período de teste: ${trialDaysLeft} dia(s) restante(s).`}
        </span>
      </div>
      <a
        href="/planos"
        className="rounded border border-white/60 px-3 py-0.5 text-xs hover:bg-white/20 transition"
      >
        Fazer upgrade
      </a>
    </div>
  )
}
