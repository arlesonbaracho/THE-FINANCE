'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

type DemoForm = {
  name: string; email: string; phone: string
  restaurant: string; employees: string; message: string
}

export function DemoModal({ onClose }: { onClose: () => void }) {
  const [form, setForm]       = useState<DemoForm>({ name: '', email: '', phone: '', restaurant: '', employees: '', message: '' })
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const overlayRef            = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', fn); document.body.style.overflow = '' }
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => { setLoading(false); setSent(true) }, 1200)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 8, padding: '12px 16px',
    fontFamily: 'var(--font-inter)', fontSize: 14, color: '#fff', outline: 'none',
    transition: 'border-color 0.2s',
  }

  return (
    <div ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflowY: 'auto',
      }}
    >
      <div className="lp-mobile-menu" style={{
        background: '#111', border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 20, padding: '40px 36px', maxWidth: 480, width: '100%',
        position: 'relative', margin: 'auto',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20, background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'color 0.2s', padding: 4,
        }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
        ><X size={20} /></button>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(74,222,128,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 24, color: 'var(--lp-neon)',
            }}>✓</div>
            <h3 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: 26, color: '#fff', margin: '0 0 8px' }}>
              Agendado com sucesso!
            </h3>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              Entraremos em contato em até 2 horas pelo WhatsApp.
            </p>
          </div>
        ) : (
          <>
            <h3 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: 28, color: '#fff', margin: '0 0 6px' }}>
              Agende sua demonstração gratuita
            </h3>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: 14, color: 'var(--lp-gray-400)', margin: '0 0 28px' }}>
              Nossa equipe mostra o sistema completo em 30 minutos.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'name',       label: 'Nome completo',          placeholder: 'João Silva',              type: 'text' },
                { key: 'email',      label: 'Email',                   placeholder: 'joao@restaurante.com',    type: 'email' },
                { key: 'phone',      label: 'Telefone / WhatsApp',     placeholder: '(84) 9 9999-9999',        type: 'tel' },
                { key: 'restaurant', label: 'Nome do restaurante',     placeholder: 'Sabor do Norte',          type: 'text' },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ fontFamily: 'var(--font-manrope)', fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.65)', display: 'block', marginBottom: 5 }}>
                    {field.label} *
                  </label>
                  <input
                    type={field.type} required
                    value={form[field.key as keyof DemoForm]}
                    onChange={(e) => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--lp-neon)')}
                    onBlur={(e)  => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontFamily: 'var(--font-manrope)', fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.65)', display: 'block', marginBottom: 5 }}>
                  Número de funcionários
                </label>
                <select value={form.employees}
                  onChange={(e) => setForm(prev => ({ ...prev, employees: e.target.value }))}
                  style={{ ...inputStyle, color: form.employees ? '#fff' : 'rgba(255,255,255,0.35)', cursor: 'pointer' }}
                >
                  <option value="" style={{ background: '#111' }}>Selecionar</option>
                  {['1-5','6-15','16-30','30+'].map(v => (
                    <option key={v} value={v} style={{ background: '#111' }}>
                      {v} funcionários
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontFamily: 'var(--font-manrope)', fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.65)', display: 'block', marginBottom: 5 }}>
                  Mensagem (opcional)
                </label>
                <textarea value={form.message}
                  onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Conte um pouco sobre seu restaurante..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--lp-neon)')}
                  onBlur={(e)  => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                />
              </div>

              <button type="submit" disabled={loading} style={{
                marginTop: 4,
                fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 16,
                color: '#fff', background: 'var(--lp-btn-green)', border: 'none',
                borderRadius: 10, padding: '14px', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, transition: 'background 0.2s, opacity 0.2s',
                boxShadow: '0 4px 20px rgba(22,163,74,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
              }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--lp-btn-green-dark)' }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'var(--lp-btn-green)' }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      animation: 'lp-spin 0.8s linear infinite', display: 'inline-block',
                    }} />
                    Enviando...
                  </>
                ) : 'Confirmar agendamento'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
