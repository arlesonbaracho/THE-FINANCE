import { describe, it, expect } from 'vitest'
import { normalizeCnpj, formatCnpj, isValidCnpj } from '../cnpj.service'

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
