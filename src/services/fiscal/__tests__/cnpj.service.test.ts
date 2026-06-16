import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeCnpj, formatCnpj, isValidCnpj, lookupCnpj, buildFiscalData } from '../cnpj.service'

describe('normalizeCnpj', () => {
  it('remove máscara deixando só dígitos', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181')
  })
})

describe('formatCnpj', () => {
  it('formata 14 dígitos com máscara', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81')
  })
})

describe('isValidCnpj', () => {
  it('aceita um CNPJ válido', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
  })
  it('rejeita dígitos verificadores errados', () => {
    expect(isValidCnpj('11.222.333/0001-00')).toBe(false)
  })
  it('rejeita tamanho errado', () => {
    expect(isValidCnpj('1122233300018')).toBe(false)
  })
  it('rejeita todos os dígitos iguais', () => {
    expect(isValidCnpj('11111111111111')).toBe(false)
  })
})

describe('buildFiscalData', () => {
  it('preenche campos quando status ok', () => {
    const d = buildFiscalData({ status: 'ok', data: { razaoSocial: 'ACME', nomeFantasia: 'A', situacaoCadastral: 'ATIVA', ativo: true } })
    expect(d.razaoSocial).toBe('ACME')
    expect(d.cnpjVerifiedAt).toBeInstanceOf(Date)
  })
  it('cnpjVerifiedAt null quando unavailable', () => {
    const d = buildFiscalData({ status: 'unavailable' })
    expect(d.cnpjVerifiedAt).toBeNull()
  })
})

describe('lookupCnpj', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('retorna ok + dados quando BrasilAPI acha ativo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ razao_social: 'ACME LTDA', nome_fantasia: 'ACME', descricao_situacao_cadastral: 'ATIVA' }),
    }))
    const r = await lookupCnpj('11222333000181')
    expect(r.status).toBe('ok')
    if (r.status === 'ok') {
      expect(r.data.razaoSocial).toBe('ACME LTDA')
      expect(r.data.ativo).toBe(true)
    }
  })

  it('retorna inactive quando situação não é ATIVA', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ razao_social: 'X', descricao_situacao_cadastral: 'BAIXADA' }),
    }))
    const r = await lookupCnpj('11222333000181')
    expect(r.status).toBe('inactive')
  })

  it('retorna not_found em 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const r = await lookupCnpj('11222333000181')
    expect(r.status).toBe('not_found')
  })

  it('retorna unavailable quando fetch lança (API fora do ar)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const r = await lookupCnpj('11222333000181')
    expect(r.status).toBe('unavailable')
  })
})
