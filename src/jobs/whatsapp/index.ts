import { Queue, Worker } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import type { Server as SocketIOServer } from 'socket.io'
import { processDailyReportJob } from './whatsapp-daily-report.job'

export async function startWhatsAppWorkers(_io: SocketIOServer): Promise<void> {
  const dailyQueue = new Queue('whatsapp-daily-report', { connection: redisConnectionOptions })
  await dailyQueue.add(
    'daily-report',
    {},
    { repeat: { pattern: '0 23 * * *' }, jobId: 'whatsapp-daily-report-cron' }
  )

  new Worker('whatsapp-daily-report', processDailyReportJob, {
    connection: redisConnectionOptions,
  })

  console.log('> WhatsApp workers started')
}
