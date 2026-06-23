'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'tf-cookie-notice'

export function CookieNotice() {
  const [dismissed, setDismissed] = useState(true) // start hidden to avoid SSR flash

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== 'ok') {
        setDismissed(false)
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — stay hidden
    }
  }, [])

  function handleDismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, 'ok')
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#1f2937',
        color: '#f9fafb',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        flexWrap: 'wrap',
        fontSize: 14,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.25)',
      }}
    >
      <p style={{ margin: 0, lineHeight: 1.5 }}>
        Usamos apenas cookies essenciais para o funcionamento do sistema.{' '}
        <Link
          href="/privacidade"
          style={{ color: '#4ade80', textDecoration: 'underline', whiteSpace: 'nowrap' }}
        >
          Saiba mais
        </Link>
      </p>
      <button
        onClick={handleDismiss}
        style={{
          background: '#16a34a',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '8px 20px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Entendi
      </button>
    </div>
  )
}
