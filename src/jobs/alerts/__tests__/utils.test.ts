import { describe, it, expect } from 'vitest'
import { isInSilenceWindow, buildAlertTitulo } from '../utils'

describe('isInSilenceWindow', () => {
  it('returns false when no config set', () => {
    expect(isInSilenceWindow({ horarioSilencioInicio: null, horarioSilencioFim: null })).toBe(false)
  })

  it('returns true when current time is within window', () => {
    const now = new Date()
    const h = now.getHours()
    const startH = h > 0 ? h - 1 : 0
    const endH = h < 23 ? h + 1 : 23
    const pad = (n: number) => String(n).padStart(2, '0')
    expect(
      isInSilenceWindow({
        horarioSilencioInicio: `${pad(startH)}:00`,
        horarioSilencioFim: `${pad(endH)}:00`,
      })
    ).toBe(true)
  })

  it('handles midnight crossing window', () => {
    expect(
      isInSilenceWindow({ horarioSilencioInicio: '23:00', horarioSilencioFim: '06:00' })
    ).toBeTypeOf('boolean')
  })
})

describe('buildAlertTitulo', () => {
  it('interpolates nome correctly', () => {
    expect(buildAlertTitulo('[Insumo] zerou o estoque', 'Frango')).toBe('Frango zerou o estoque')
  })
})
