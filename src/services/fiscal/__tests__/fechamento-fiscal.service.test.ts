import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'

vi.mock('@/lib/prisma', () => ({ prisma: { nfProcessada: { findMany: vi.fn() } } }))

import { gerarFechamentoFiscal, nomePeriodo } from '../fechamento-fiscal.service'
import { prisma } from '@/lib/prisma'

const mp = prisma as any

const NOTAS = [
  { id: 'a', tipo: 'SAIDA', status: 'AUTORIZADA', xml: '<nfce1/>', chaveAcesso: 'CH-SAIDA-1', modelo: '65', numeroNf: '101', fornecedorNome: 'Cliente X', valorTotal: 50, dataEmissao: new Date('2026-05-10') },
  { id: 'b', tipo: 'ENTRADA', status: 'CAPTURADA', xml: '<nfe1/>', chaveAcesso: 'CH-ENT-1', modelo: '55', numeroNf: '5', fornecedorNome: 'Fornecedor Y', valorTotal: 200, dataEmissao: new Date('2026-05-12') },
  { id: 'c', tipo: 'SAIDA', status: 'CANCELADA', xml: '<nfce-canc/>', chaveAcesso: 'CH-SAIDA-2', modelo: '65', numeroNf: '102', fornecedorNome: 'Cliente Z', valorTotal: 30, dataEmissao: new Date('2026-05-15') },
  { id: 'd', tipo: 'SAIDA', status: 'AUTORIZADA', xml: null, chaveAcesso: 'CH-SEM-XML', modelo: '65', numeroNf: '103', fornecedorNome: 'Sem XML', valorTotal: 10, dataEmissao: new Date('2026-05-16') },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('gerarFechamentoFiscal', () => {
  it('monta ZIP com XMLs por tipo + relatório, contando e ignorando sem-XML', async () => {
    mp.nfProcessada.findMany.mockResolvedValue(NOTAS)

    const r = await gerarFechamentoFiscal({ tenantId: 't1', inicio: new Date(2026, 4, 1), fim: new Date(2026, 4, 31, 23, 59, 59) })

    // contadores
    expect(r.totalNotas).toBe(3) // a, b, c (d sem xml fora)
    expect(r.totalEntradas).toBe(1)
    expect(r.totalSaidas).toBe(2)
    expect(r.totalCanceladas).toBe(1)
    expect(r.ignoradas).toBe(1)

    // query tenant-scoped por dataEmissao + status
    const where = mp.nfProcessada.findMany.mock.calls[0][0].where
    expect(where.tenantId).toBe('t1')
    expect(where.dataEmissao.gte).toEqual(new Date(2026, 4, 1))
    expect(where.status.in).toEqual(['AUTORIZADA', 'CAPTURADA', 'CANCELADA'])

    // conteúdo do ZIP
    const zip = await JSZip.loadAsync(r.buffer)
    const nomes = Object.keys(zip.files)
    expect(nomes).toContain('saidas/CH-SAIDA-1.xml')
    expect(nomes).toContain('entradas/CH-ENT-1.xml')
    expect(nomes).toContain('saidas/CH-SAIDA-2.xml') // cancelada com XML entra
    expect(nomes).toContain('relatorio-fechamento-2026-05.xlsx')
    // sem-xml não entra
    expect(nomes.some((n) => n.includes('CH-SEM-XML'))).toBe(false)
  })

  it('relatório lista as notas com status e linha de total', async () => {
    mp.nfProcessada.findMany.mockResolvedValue(NOTAS)
    const r = await gerarFechamentoFiscal({ tenantId: 't1', inicio: new Date(2026, 4, 1), fim: new Date(2026, 4, 31, 23, 59, 59) })

    const zip = await JSZip.loadAsync(r.buffer)
    const xlsxBuf = await zip.file('relatorio-fechamento-2026-05.xlsx')!.async('nodebuffer')
    const wb = XLSX.read(xlsxBuf, { type: 'buffer' })
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Notas'], { header: 1 })

    expect(rows[0]).toContain('Chave de acesso')
    const flat = JSON.stringify(rows)
    expect(flat).toContain('Cancelada') // cancelada marcada
    expect(flat).toContain('CH-SAIDA-1')
    expect(flat).not.toContain('CH-SEM-XML')
    // linha de total
    const total = rows.find((row) => row.includes('TOTAL'))
    expect(total).toBeTruthy()
    expect(total).toContain(280) // 50 + 200 + 30
  })

  it('usa nome de arquivo por id quando chaveAcesso é nula', async () => {
    mp.nfProcessada.findMany.mockResolvedValue([
      { id: 'semchave', tipo: 'SAIDA', status: 'AUTORIZADA', xml: '<x/>', chaveAcesso: null, modelo: '65', numeroNf: '1', fornecedorNome: '', valorTotal: 1, dataEmissao: new Date('2026-05-02') },
    ])
    const r = await gerarFechamentoFiscal({ tenantId: 't1', inicio: new Date(2026, 4, 1), fim: new Date(2026, 4, 31, 23, 59, 59) })
    const zip = await JSZip.loadAsync(r.buffer)
    expect(Object.keys(zip.files)).toContain('saidas/semchave.xml')
  })
})

describe('nomePeriodo', () => {
  it('YYYY-MM para mês cheio', () => {
    expect(nomePeriodo(new Date(2026, 4, 1), new Date(2026, 4, 31, 23, 59, 59))).toBe('2026-05')
  })
  it('intervalo livre vira YYYYMMDD-YYYYMMDD', () => {
    expect(nomePeriodo(new Date(2026, 4, 3), new Date(2026, 4, 20))).toBe('20260503-20260520')
  })
})
