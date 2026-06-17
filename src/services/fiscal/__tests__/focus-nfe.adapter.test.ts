import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FocusNfeAdapter } from '../focus-nfe.adapter'

describe('FocusNfeAdapter.consultarNotasDestinadas', () => {
  beforeEach(() => { vi.restoreAllMocks(); process.env.FOCUS_NFE_TOKEN = 'tok'; process.env.FOCUS_NFE_BASE_URL = 'https://homolog.focusnfe.test' })

  it('mapeia a resposta da Focus para NotaDestinada[]', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { chave_nfe: '352..44d', numero: '123', nome_emitente: 'ACME LTDA', valor_total: '150.50', data_emissao: '2026-06-01', modelo: '55' },
      ]),
    }))
    const adapter = new FocusNfeAdapter()
    const r = await adapter.consultarNotasDestinadas({ cnpj: '11222333000181' })
    expect(r).toHaveLength(1)
    expect(r[0].chaveAcesso).toBe('352..44d')
    expect(r[0].valorTotal).toBe(150.5)
    expect(r[0].modelo).toBe('NFe')
  })

  it('retorna [] quando a Focus responde vazio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ([]) }))
    const adapter = new FocusNfeAdapter()
    expect(await adapter.consultarNotasDestinadas({ cnpj: '11222333000181' })).toEqual([])
  })

  it('lança erro quando a Focus falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'err' }))
    const adapter = new FocusNfeAdapter()
    await expect(adapter.consultarNotasDestinadas({ cnpj: '11222333000181' })).rejects.toThrow()
  })
})
