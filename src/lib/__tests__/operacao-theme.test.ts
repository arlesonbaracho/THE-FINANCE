import { describe, it, expect } from 'vitest'
import { temaOperacao, funcaoMeta } from '../operacao-theme'

describe('temaOperacao', () => {
  it('caixa = paleta dourada', () => {
    expect(temaOperacao('caixa').accent).toBe('#b48a2a')
    expect(temaOperacao('caixa').pageBg).toBe('#131009')
  })
  it('cozinha = paleta verde', () => {
    expect(temaOperacao('cozinha').green).toBe('#2a9d6f')
    expect(temaOperacao('cozinha').pageBg).toBe('#0f1714')
  })
  it('garcom = paleta roxa', () => {
    expect(temaOperacao('garcom').accent).toBe('#6d4fc2')
    expect(temaOperacao('garcom').pageBg).toBe('#0f0d18')
  })
})

describe('funcaoMeta', () => {
  it('retorna avatar e label por função', () => {
    expect(funcaoMeta('caixa').avatar).toBe('/Caixa.png')
    expect(funcaoMeta('cozinha').avatar).toBe('/Cozinheiro.png')
    expect(funcaoMeta('garcom').avatar).toBe('/Garçom.png')
  })
})
