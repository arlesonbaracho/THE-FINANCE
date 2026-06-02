import { createServer } from 'http'
import { createConnection } from 'net'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIO } from 'socket.io'

function isRedisAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
    let host = 'localhost'
    let port = 6379
    try {
      const u = new URL(redisUrl)
      host = u.hostname
      port = parseInt(u.port || '6379', 10)
    } catch { /* use defaults */ }

    const socket = createConnection(port, host)
    socket.setTimeout(1000)
    socket.on('connect', () => { socket.destroy(); resolve(true) })
    socket.on('error', () => { socket.destroy(); resolve(false) })
    socket.on('timeout', () => { socket.destroy(); resolve(false) })
  })
}

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const io = new SocketIO(httpServer, {
    path: '/api/socket',
    cors: { origin: '*' },
  })

  ;(global as { io?: SocketIO }).io = io

  io.on('connection', (socket) => {
    socket.on('join:tenant', (tenantId: string) => {
      socket.join(tenantId)
    })
  })

  const redisOk = await isRedisAvailable()
  if (redisOk) {
    const { startAlertWorkers } = await import('./src/jobs/alerts')
    const { startDashboardWorkers } = await import('./src/jobs/dashboard')
    const { startAiWorkers } = await import('./src/jobs/ai')
    const { startIFoodWorkers } = await import('./src/jobs/ifood')
    const { startWhatsAppWorkers } = await import('./src/jobs/whatsapp')
    await startAlertWorkers(io)
    await startDashboardWorkers()
    await startAiWorkers(io)
    await startIFoodWorkers(io)
    await startWhatsAppWorkers(io)
  } else {
    console.warn('> Redis not available — BullMQ workers skipped. Run redis-server to enable alert jobs.')
  }

  const port = parseInt(process.env.PORT ?? '3000', 10)
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
