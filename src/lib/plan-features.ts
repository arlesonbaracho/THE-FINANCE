export interface PlanFeatures {
  aiAgent: boolean
  advancedReports: boolean
  multiUnit: boolean
  prioritySupport: boolean
  exportReports: boolean
}

export const DEFAULT_FEATURES: PlanFeatures = {
  aiAgent: false,
  advancedReports: false,
  multiUnit: false,
  prioritySupport: false,
  exportReports: false,
}

export function parsePlanFeatures(raw: unknown): PlanFeatures {
  if (!raw || typeof raw !== 'object') return DEFAULT_FEATURES
  const f = raw as Record<string, unknown>
  return {
    aiAgent: Boolean(f.aiAgent),
    advancedReports: Boolean(f.advancedReports),
    multiUnit: Boolean(f.multiUnit),
    prioritySupport: Boolean(f.prioritySupport),
    exportReports: Boolean(f.exportReports),
  }
}

/** Routes that require a specific feature to be enabled */
export const FEATURE_PROTECTED_ROUTES: Record<string, keyof PlanFeatures> = {
  '/relatorios': 'advancedReports',
  '/ia': 'aiAgent',
  '/multi-unidade': 'multiUnit',
}
