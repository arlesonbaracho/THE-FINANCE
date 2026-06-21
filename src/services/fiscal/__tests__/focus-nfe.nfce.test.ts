import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FocusNfeAdapter } from '../focus-nfe.adapter'

describe('FocusNfeAdapter NFC-e', () => {
  beforeEach(() => { vi.restoreAllMocks(); process.env.FOCUS_NFE_TOKEN = 'tok'; process.env.FOCUS_NFE_BASE_URL = 'https://h.test' })

  it('emitirNfce mapeia autorizado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'autorizado', chave_nfe: 'CHAVE', caminho_danfe: '/d.pdf', caminho_xml_nota_fiscal: '/n.xml', protocolo: '123' }),
    }))
    const r = await new FocusNfeAdapter().emitirNfce('ref1', { foo: 1 })
    expect(r.status).toBe('autorizado')
    expect(r.chaveAcesso).toBe('CHAVE')
    expect(r.protocolo).toBe('123')
  })

  it('emitirNfce mapeia erro/rejeição com motivo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'erro_autorizacao', mensagem_sefaz: 'Rejeição 999' }),
    }))
    const r = await new FocusNfeAdapter().emitirNfce('ref1', {})
    expect(r.status).toBe('erro')
    expect(r.motivo).toContain('999')
  })

  it('cancelarNfce mapeia cancelado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'cancelado' }) }))
    const r = await new FocusNfeAdapter().cancelarNfce('ref1', 'engano')
    expect(r.status).toBe('cancelado')
  })
})
