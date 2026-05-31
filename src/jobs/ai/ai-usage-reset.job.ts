import { resetarUsoMensal } from '@/services/ai/ai-usage.service'

export async function resetAiUsage(): Promise<void> {
  console.log('[ai-usage-reset] Starting monthly reset...')
  await resetarUsoMensal()
  console.log('[ai-usage-reset] Monthly reset complete')
}
