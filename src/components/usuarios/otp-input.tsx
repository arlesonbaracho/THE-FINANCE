'use client'

import { useRef } from 'react'

interface OtpInputProps {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  label?: string
}

export function OtpInput({ value, onChange, disabled, label }: OtpInputProps) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  function handleChange(idx: number, char: string) {
    const digit = char.replace(/\D/g, '').slice(-1)
    const next = value.split('')
    next[idx] = digit
    const newVal = next.join('').slice(0, 4)
    onChange(newVal.padEnd(4, ''))
    if (digit && idx < 3) refs[idx + 1]?.current?.focus()
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (!value[idx] && idx > 0) {
        const next = value.split('')
        next[idx - 1] = ''
        onChange(next.join(''))
        refs[idx - 1]?.current?.focus()
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (text) {
      onChange(text.padEnd(4, ''))
      const focusIdx = Math.min(text.length, 3)
      refs[focusIdx]?.current?.focus()
    }
    e.preventDefault()
  }

  const digits = [value[0] || '', value[1] || '', value[2] || '', value[3] || '']

  return (
    <div>
      {label && (
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tf-txt2)', marginBottom: 8 }}>
          {label}
        </label>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={refs[idx]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              width: 52, height: 52, borderRadius: 8, textAlign: 'center',
              fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-manrope)',
              color: 'var(--tf-txt)', background: 'var(--tf-input-bg)',
              border: `2px solid ${digit ? 'var(--tf-primary)' : 'var(--tf-border-color)'}`,
              outline: 'none', cursor: disabled ? 'not-allowed' : 'text',
              opacity: disabled ? 0.5 : 1,
            }}
          />
        ))}
      </div>
    </div>
  )
}
