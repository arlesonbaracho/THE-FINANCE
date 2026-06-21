import { describe, it, expect } from 'vitest'
import { melhorMatchPorNome } from '../match-nome'

describe('melhorMatchPorNome', () => {
  it('retorna null para lista vazia', () => {
    expect(melhorMatchPorNome('arroz', [])).toBeNull()
  })
  it('acha o melhor candidato com score alto para nome igual', () => {
    const r = melhorMatchPorNome('Arroz', [{ id: '1', name: 'Arroz' }, { id: '2', name: 'Feijão' }])
    expect(r?.id).toBe('1')
    expect(r?.score).toBe(100)
  })
  it('escolhe o mais parecido entre vários', () => {
    const r = melhorMatchPorNome('X-Burguer', [{ id: '1', name: 'Refrigerante' }, { id: '2', name: 'X-Burger' }])
    expect(r?.id).toBe('2')
    expect(r!.score).toBeGreaterThan(80)
  })
})
