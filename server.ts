import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIO } from 'socket.io'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const io = new SocketIO(httpServer, {
    path: '/api/socket',
    cors: { origin: '*' },
  })

  // Store on global so API routes can emit events
  ;(global as { io?: SocketIO }).io = io

  io.on('connection', (socket) => {
    socket.on('join:tenant', (tenantId: string) => {
      socket.join(tenantId)
    })
  })

  const port = parseInt(process.env.PORT ?? '3000', 10)
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
