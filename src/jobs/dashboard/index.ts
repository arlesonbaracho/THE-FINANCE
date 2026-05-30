import { Queue, Worker } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import { processDashboardSnapshot } from './snapshot.job'

export async function startDashboardWorkers(): Promise<void> {
  const snapshotQueue = new Queue('dashboard-snapshot', { connection: redisConnectionOptions })
  await snapshotQueue.add('run', {}, { repeat: { pattern: '50 23 * * *' }, jobId: 'snapshot-repeat' })
  new Worker('dashboard-snapshot', () => processDashboardSnapshot(), { connection: redisConnectionOptions })
  console.log('> Dashboard workers started')
}
