'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'cnpjGateSeen'
const GRACE_DAYS = 14

interface TenantMe {
  cnpj: string | null
  createdAt: string
}

export function CnpjGate() {
  const [data, setData] = useState<TenantMe | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    fetch('/api/tenant/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TenantMe | null) => {
        setData(d)
        setLoaded(true)
        if (d && !d.cnpj) {
          const days = Math.floor(
            (Date.now() - new Date(d.createdAt).getTime()) / 86_400_000,
          )
          const alreadySeen = sessionStorage.getItem(STORAGE_KEY) === '1'
          if (days > GRACE_DAYS || !alreadySeen) {
            setModalVisible(true)
            sessionStorage.setItem(STORAGE_KEY, '1')
          }
        }
      })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded || !data || data.cnpj) return null

  const days = Math.floor(
    (Date.now() - new Date(data.createdAt).getTime()) / 86_400_000,
  )
  const isBlocking = days > GRACE_DAYS

  return (
    <>
      {/* Persistent banner (grace period only) */}
      {!isBlocking && !bannerDismissed && (
        <div
          role="alert"
          style={{
            background: 'var(--tf-yellow-bg)',
            border: '1px solid var(--tf-yellow-bd)',
            color: 'var(--tf-txt)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            gap: '12px',
            fontSize: '14px',
          }}
        >
          <span>
            <strong style={{ color: 'var(--tf-yellow)' }}>Atenção:</strong>{' '}
            Complete o CNPJ da sua empresa para continuar usando todos os
            recursos.{' '}
            <a
              href="/configuracoes/restaurante"
              style={{
                color: 'var(--tf-primary)',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              Configurar agora
            </a>
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label="Fechar aviso"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--tf-txt2)',
              fontSize: '18px',
              lineHeight: 1,
              padding: '0 4px',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Modal */}
      {modalVisible && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cnpj-gate-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
          }}
        >
          <div
            style={{
              background: 'var(--tf-surface)',
              border: '1px solid var(--tf-border)',
              borderRadius: '12px',
              padding: '32px 28px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '36px',
                marginBottom: '12px',
                lineHeight: 1,
              }}
            >
              🏢
            </div>
            <h2
              id="cnpj-gate-title"
              style={{
                color: 'var(--tf-txt)',
                fontSize: '18px',
                fontWeight: 700,
                marginBottom: '10px',
              }}
            >
              {isBlocking
                ? 'CNPJ obrigatório'
                : 'Complete o cadastro da empresa'}
            </h2>
            <p
              style={{
                color: 'var(--tf-txt2)',
                fontSize: '14px',
                marginBottom: '24px',
                lineHeight: 1.5,
              }}
            >
              {isBlocking
                ? 'O prazo de carência expirou. Informe o CNPJ da sua empresa para continuar usando a plataforma.'
                : `Você tem ${GRACE_DAYS - days} dia(s) para informar o CNPJ da sua empresa. Após esse prazo, o acesso ficará restrito.`}
            </p>
            <a
              href="/configuracoes/restaurante"
              style={{
                display: 'inline-block',
                background: 'var(--tf-primary)',
                color: 'var(--tf-primary-txt)',
                fontWeight: 600,
                fontSize: '14px',
                padding: '10px 28px',
                borderRadius: '8px',
                textDecoration: 'none',
                marginBottom: isBlocking ? 0 : '12px',
              }}
            >
              Configurar CNPJ
            </a>
            {!isBlocking && (
              <div>
                <button
                  onClick={() => setModalVisible(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--tf-txt2)',
                    fontSize: '13px',
                    padding: '4px 8px',
                    textDecoration: 'underline',
                  }}
                >
                  Lembrar depois
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
