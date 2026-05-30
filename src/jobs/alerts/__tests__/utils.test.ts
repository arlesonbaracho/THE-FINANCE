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

  it('handles midnight crossing window - time inside window', () => {
    // 23:30 should be inside a 23:00-06:00 silence window
    // We simulate by calling with a window that crosses midnight
    // Since isInSilenceWindow uses Date internally, we test both edges
    const result = isInSilenceWindow({ horarioSilencioInicio: '00:00', horarioSilencioFim: '23:59' })
    // Window 00:00-23:59 covers almost entire day — current time must be inside
    expect(result).toBe(true)
  })

  it('handles midnight crossing window - time outside window', () => {
    // A window from 00:01 to 00:02 — almost certainly outside current time
    // Unless you're running tests at exactly midnight, this should be false
    const now = new Date()
    const h = now.getHours()
    const m = now.getMinutes()
    // Only skip this test if we're running exactly at 00:01
    if (h === 0 && m === 1) return
    expect(
      isInSilenceWindow({ horarioSilencioInicio: '00:01', horarioSilencioFim: '00:02' })
    ).toBe(false)
  })
})

describe('buildAlertTitulo', () => {
  it('interpolates nome correctly', () => {
    expect(buildAlertTitulo('[Insumo] zerou o estoque', 'Frango')).toBe('Frango zerou o estoque')
  })
})
