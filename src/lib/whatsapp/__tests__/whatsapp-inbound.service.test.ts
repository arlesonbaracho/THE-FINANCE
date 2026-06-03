import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { whatsAppContato: { findFirst: vi.fn() } },
}))
vi.mock('@/lib/bullmq', () => ({
  redisConnection: { get: vi.fn() },
}))
vi.mock('../evolution.service', () => ({
  enviarMensagem: vi.fn().mockResolvedValue(true),
}))
vi.mock('../whatsapp-bot.service', () => ({
  interpretarComando: vi.fn(),
  processarConfirmacao: vi.fn(),
}))

import { processarMensagem } from '../whatsapp-inbound.service'
import { prisma } from '@/lib/prisma'
import { redisConnection } from '@/lib/bullmq'
import { enviarMensagem } from '../evolution.service'
import { interpretarComando, processarConfirmacao } from '../whatsapp-bot.service'

const db = prisma as unknown as { whatsAppContato: { findFirst: ReturnType<typeof vi.fn> } }
const redis = redisConnection as unknown as { get: ReturnType<typeof vi.fn> }
const enviar = enviarMensagem as ReturnType<typeof vi.fn>
const interpretar = interpretarComando as ReturnType<typeof vi.fn>
const confirmar = processarConfirmacao as ReturnType<typeof vi.fn>

function makePayload(jid: string, text: string, fromMe = false) {
  return { event: 'messages.upsert', data: { key: { remoteJid: jid, fromMe }, message: { conversation: text } } }
}

describe('processarMensagem', () => {
  beforeEach(() => { vi.clearAllMocks(); redis.get.mockResolvedValue(null) })

  it('ignores echo (fromMe=true)', async () => {
    await processarMensagem(makePayload('5511@s.whatsapp.net', 'Oi', true) as never)
    expect(db.whatsAppContato.findFirst).not.toHaveBeenCalled()
  })

  it('ignores group JIDs (@g.us)', async () => {
    await processarMensagem(makePayload('123456789@g.us', 'Oi') as never)
    expect(db.whatsAppContato.findFirst).not.toHaveBeenCalled()
  })

  it('ignores unknown event types', async () => {
    const payload = { event: 'connection.update', data: { key: { remoteJid: '5511@s.whatsapp.net', fromMe: false } } }
    await processarMensagem(payload as never)
    expect(db.whatsAppContato.findFirst).not.toHaveBeenCalled()
  })

  it('ignores unknown numbers silently', async () => {
    db.whatsAppContato.findFirst.mockResolvedValue(null)
    await processarMensagem(makePayload('5511@s.whatsapp.net', 'Oi') as never)
    expect(enviar).not.toHaveBeenCalled()
  })

  it('sends permission denial when permiteComandos is false', async () => {
    db.whatsAppContato.findFirst.mockResolvedValue({ tenantId: 't1', permiteComandos: false })
    await processarMensagem(makePayload('5511@s.whatsapp.net', 'Novo insumo') as never)
    expect(enviar).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('permissão'), 't1')
    expect(interpretar).not.toHaveBeenCalled()
  })

  it('calls interpretarComando for regular text with permission', async () => {
    db.whatsAppContato.findFirst.mockResolvedValue({ tenantId: 't1', permiteComandos: true })
    await processarMensagem(makePayload('5511@s.whatsapp.net', 'Novo insumo: Farinha') as never)
    expect(interpretar).toHaveBeenCalledWith('t1', '+5511', 'Novo insumo: Farinha')
  })

  it('calls processarConfirmacao when session exists and text is SIM', async () => {
    db.whatsAppContato.findFirst.mockResolvedValue({ tenantId: 't1', permiteComandos: true })
    redis.get.mockResolvedValue('{"intencao":"NOVO_INSUMO"}')
    await processarMensagem(makePayload('5511@s.whatsapp.net', 'SIM') as never)
    expect(confirmar).toHaveBeenCalledWith('t1', '+5511', 'SIM')
  })

  it('calls interpretarComando for SIM when no active session', async () => {
    db.whatsAppContato.findFirst.mockResolvedValue({ tenantId: 't1', permiteComandos: true })
    redis.get.mockResolvedValue(null)
    await processarMensagem(makePayload('5511@s.whatsapp.net', 'SIM') as never)
    expect(interpretar).toHaveBeenCalled()
    expect(confirmar).not.toHaveBeenCalled()
  })

  it('ignores empty text after trim', async () => {
    db.whatsAppContato.findFirst.mockResolvedValue({ tenantId: 't1', permiteComandos: true })
    await processarMensagem(makePayload('5511@s.whatsapp.net', '   ') as never)
    expect(interpretar).not.toHaveBeenCalled()
    expect(confirmar).not.toHaveBeenCalled()
  })
})
