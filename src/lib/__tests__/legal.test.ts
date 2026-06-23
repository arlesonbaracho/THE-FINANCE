import { describe, it, expect } from 'vitest'
import { precisaReconsentir } from '../legal'

const vigentes = [
  { documento: 'POLITICA' as const, versao: '2026-06-22' },
  { documento: 'TERMOS' as const, versao: '2026-06-22' },
]

describe('precisaReconsentir', () => {
  it('true quando falta um documento aceito', () => {
    expect(precisaReconsentir([{ documento: 'POLITICA', versao: '2026-06-22' }], vigentes)).toBe(true)
  })
  it('true quando a versão aceita é mais antiga', () => {
    expect(precisaReconsentir([
      { documento: 'POLITICA', versao: '2026-01-01' },
      { documento: 'TERMOS', versao: '2026-06-22' },
    ], vigentes)).toBe(true)
  })
  it('false quando todas as versões vigentes foram aceitas', () => {
    expect(precisaReconsentir([
      { documento: 'POLITICA', versao: '2026-06-22' },
      { documento: 'TERMOS', versao: '2026-06-22' },
    ], vigentes)).toBe(false)
  })
  it('considera a maior versão aceita por documento', () => {
    expect(precisaReconsentir([
      { documento: 'POLITICA', versao: '2026-01-01' },
      { documento: 'POLITICA', versao: '2026-06-22' },
      { documento: 'TERMOS', versao: '2026-06-22' },
    ], vigentes)).toBe(false)
  })
})
