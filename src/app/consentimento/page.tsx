'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConsentimentoPage() {
  const router = useRouter()
  const [aceito, setAceito] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleAceitar() {
    if (!aceito) return
    setCarregando(true)
    setErro(null)
    try {
      const res = await fetch('/api/consentimento', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErro(body?.error ?? 'Erro ao registrar consentimento. Tente novamente.')
        return
      }
      router.push('/dashboard')
    } catch {
      setErro('Erro de rede. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-md p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Nossos documentos foram atualizados
          </h1>
          <p className="text-muted-foreground text-sm">
            Para continuar usando o THE FINANCE, e necessario que voce revise e aceite as versoes
            mais recentes da nossa Politica de Privacidade e dos Termos de Uso.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          <li>
            <a
              href="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 text-sm font-medium"
            >
              Politica de Privacidade
            </a>
          </li>
          <li>
            <a
              href="/termos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 text-sm font-medium"
            >
              Termos de Uso
            </a>
          </li>
        </ul>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={aceito}
            onChange={(e) => setAceito(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span className="text-sm text-foreground">
            Li e aceito a Politica de Privacidade e os Termos de Uso nas versoes vigentes.
          </span>
        </label>

        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}

        <button
          onClick={handleAceitar}
          disabled={!aceito || carregando}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {carregando ? 'Registrando...' : 'Aceitar e continuar'}
        </button>
      </div>
    </main>
  )
}
