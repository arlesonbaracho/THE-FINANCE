import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/api/socket',
      autoConnect: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 5000,
      timeout: 5000,
    })
    socket.on('connect_error', () => { /* silently ignore — server.ts may not be running */ })
  }
  return socket
}
