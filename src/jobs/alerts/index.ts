import { Queue, Worker } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import type { Server as SocketIOServer } from 'socket.io'
import { processEstoqueAlerts } from './estoque.job'
import { processFinanceiroAlerts } from './financeiro.job'
import { processOperacionalAlerts } from './operacional.job'

export async function startAlertWorkers(io: SocketIOServer): Promise<void> {
  const estoqueInterval = parseInt(process.env.ALERT_JOB_INTERVAL_MS ?? '3600000')
  const operacionalInterval = parseInt(process.env.KDS_ALERT_JOB_INTERVAL_MS ?? '1800000')

  const estoqueQueue = new Queue('alerts:estoque', { connection: redisConnectionOptions })
  await estoqueQueue.add('run', {}, { repeat: { every: estoqueInterval }, jobId: 'estoque-repeat' })
  new Worker('alerts:estoque', () => processEstoqueAlerts(io), { connection: redisConnectionOptions })

  const financeiroQueue = new Queue('alerts:financeiro', { connection: redisConnectionOptions })
  await financeiroQueue.add('run', {}, { repeat: { pattern: '0 23 * * *' }, jobId: 'financeiro-repeat' })
  new Worker('alerts:financeiro', () => processFinanceiroAlerts(io), { connection: redisConnectionOptions })

  const operacionalQueue = new Queue('alerts:operacional', { connection: redisConnectionOptions })
  await operacionalQueue.add('run', {}, { repeat: { every: operacionalInterval }, jobId: 'operacional-repeat' })
  new Worker('alerts:operacional', () => processOperacionalAlerts(io), { connection: redisConnectionOptions })

  console.log('> Alert workers started')
}
