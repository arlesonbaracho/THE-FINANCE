import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, slugify } from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats zero', () => {
    expect(formatCurrency(0)).toContain('0')
  })

  it('formats a positive value', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1.234')
    expect(result).toContain('56')
  })

  it('includes R$ symbol', () => {
    expect(formatCurrency(10)).toContain('R$')
  })
})

describe('formatDate', () => {
  it('returns a formatted string', () => {
    const result = formatDate(new Date('2025-01-15T12:00:00Z'))
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('accepts a date string', () => {
    const result = formatDate('2025-06-01T00:00:00Z')
    expect(typeof result).toBe('string')
  })
})

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('RESTAURANTE')).toBe('restaurante')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('Sabor do Norte')).toBe('sabor-do-norte')
  })

  it('removes accents', () => {
    expect(slugify('Macarrão')).toBe('macarrao')
  })

  it('removes special characters', () => {
    expect(slugify('Café & Bistrô!')).toBe('cafe-bistro')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('a  b')).toBe('a-b')
  })

  it('handles already slugified string', () => {
    expect(slugify('sabor-do-norte')).toBe('sabor-do-norte')
  })
})
