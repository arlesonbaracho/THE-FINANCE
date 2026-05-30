import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIO } from 'socket.io'
import { startAlertWorkers } from './src/jobs/alerts'
import { startDashboardWorkers } from './src/jobs/dashboard'

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

  try {
    await startAlertWorkers(io)
    await startDashboardWorkers()
  } catch (err) {
    console.warn('> BullMQ workers not started (Redis unavailable?):', (err as Error).message)
    console.warn('> Start Redis to enable background alert jobs.')
  }

  const port = parseInt(process.env.PORT ?? '3000', 10)
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
