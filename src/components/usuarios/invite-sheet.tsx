'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Mail, Hash, Shield, BarChart2, DollarSign, ChefHat, Package, CheckCircle, Copy, Check } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import { OtpInput } from '@/components/usuarios/otp-input'
import type { RoleItem } from '@/components/usuarios/user-card'

// ── Cores ─────────────────────────────────────────────────────────────────────

const C = {
  greenBg: '#0d2b1f', green: '#2a9d6f', greenLight: '#4bc994',
  txt: '#e8f0ec', txt2: '#c8dcd2', muted: '#3d6050', border: '#1e3d2e',
}

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  tipoAcesso: z.enum(['email', 'pin']),
  email: z.string().optional(),
  pin: z.string().optional(),
  confirmPin: z.string().optional(),
  roleId: z.string().min(1, 'Selecione um cargo'),
}).superRefine((d, ctx) => {
  if (d.tipoAcesso === 'email') {
    if (!d.email || !z.string().email().safeParse(d.email).success) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Email inválido' })
    }
  }
  if (d.tipoAcesso === 'pin') {
    if (!d.pin || !/^\d{4}$/.test(d.pin)) {
      ctx.addIssue({ code: 'custom', path: ['pin'], message: 'PIN deve ter 4 dígitos' })
    }
    if (d.pin !== d.confirmPin) {
      ctx.addIssue({ code: 'custom', path: ['confirmPin'], message: 'PINs não coincidem' })
    }
  }
})

type FormData = z.infer<typeof schema>

// ── Role meta ─────────────────────────────────────────────────────────────────

type RoleIcon = React.ComponentType<{ size?: number; style?: React.CSSProperties }>

const ROLE_META: Record<string, { icon: RoleIcon; desc: string }> = {
  admin: { icon: Shield, desc: 'Acesso total ao sistema' },
  admin_restaurante: { icon: Shield, desc: 'Acesso total ao sistema' },
  gerente: { icon: BarChart2, desc: 'Estoque, financeiro, relatórios' },
  caixa: { icon: DollarSign, desc: 'Apenas PDV e vendas' },
  cozinheiro: { icon: ChefHat, desc: 'Apenas painel da cozinha' },
  estoquista: { icon: Package, desc: 'Apenas gestão de estoque' },
}

function getRoleMeta(name: string) {
  const key = name.toLowerCase().replace(/\s+/g, '_')
  for (const [k, v] of Object.entries(ROLE_META)) {
    if (key.includes(k)) return v
  }
  return { icon: Shield, desc: 'Cargo personalizado' }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: RoleItem[]
  onSuccess: () => void
}

export function InviteSheet({ open, onOpenChange, roles, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [expandedPerms, setExpandedPerms] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ email: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipoAcesso: 'email', nome: '', email: '', pin: '', confirmPin: '', roleId: '' },
  })

  const tipoAcesso = watch('tipoAcesso')
  const roleId = watch('roleId')
  const selectedRole = roles.find((r) => r.id === roleId)

  const cozRoles = roles.filter((r) => r.name.toLowerCase().includes('cozinheiro'))
  const visibleRoles = tipoAcesso === 'pin'
    ? (cozRoles.length > 0 ? cozRoles : roles)
    : roles

  function handleTypeChange(tipo: 'email' | 'pin') {
    setValue('tipoAcesso', tipo)
    setValue('pin', '')
    setValue('confirmPin', '')
    setValue('roleId', '')
    if (tipo === 'pin') {
      const cozinheiro = roles.find((r) => r.name.toLowerCase().includes('cozinheiro'))
      if (cozinheiro) setValue('roleId', cozinheiro.id)
    }
  }

  function handleClose(v: boolean) {
    if (!v) { reset(); setExpandedPerms(false); setInviteResult(null); setCopied(false) }
    onOpenChange(v)
  }

  async function onSubmit(data: FormData) {
    setSubmitting(true)
    try {
      let body: Record<string, unknown>
      if (data.tipoAcesso === 'pin') {
        body = { nome: data.nome, pin: data.pin, confirmPin: data.confirmPin, roleId: data.roleId }
      } else {
        body = { email: data.email, roleId: data.roleId }
      }
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Erro ao convidar'); return }

      if (data.tipoAcesso === 'pin') {
        toast.success(`Cozinheiro ${data.nome} cadastrado com sucesso`)
        handleClose(false)
        onSuccess()
      } else {
        setInviteResult({ email: data.email!, url: json.inviteUrl as string })
        onSuccess()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14,
    background: 'var(--tf-input-bg)', border: '1px solid var(--tf-border-color)',
    color: 'var(--tf-txt)', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="sm:max-w-[460px] overflow-y-auto flex flex-col">
        <SheetHeader style={{ paddingBottom: 0 }}>
          <SheetTitle style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 18, color: 'var(--tf-txt)' }}>
            Convidar funcionário
          </SheetTitle>
        </SheetHeader>

        {inviteResult ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 16px', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: C.greenBg, border: `2px solid ${C.green}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <CheckCircle size={24} style={{ color: C.greenLight }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.txt, margin: 0 }}>Convite criado!</p>
              <p style={{ fontSize: 12, color: C.muted, margin: '6px 0 0', lineHeight: 1.5 }}>
                Tentamos enviar um email para{' '}
                <strong style={{ color: C.txt2 }}>{inviteResult.email}</strong>.
                <br />Compartilhe o link abaixo caso o email não chegue.
              </p>
            </div>

            <div style={{ background: C.greenBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Link de convite (válido por 48h)
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <p style={{ fontSize: 11, color: C.greenLight, fontFamily: 'monospace', margin: 0, flex: 1, wordBreak: 'break-all', lineHeight: 1.6 }}>
                  {inviteResult.url}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(inviteResult.url)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                    background: copied ? C.green : 'transparent',
                    border: `1px solid ${C.green}`,
                    color: copied ? '#fff' : C.greenLight,
                    cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'all 0.15s',
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
              Envie este link por WhatsApp, Slack ou qualquer outro canal. O funcionário acessará o link para criar sua senha.
            </p>
          </div>
        ) : (

        <form onSubmit={handleSubmit(onSubmit)} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, padding: '0 16px 8px' }}>
          {/* Nome */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tf-txt2)', marginBottom: 6 }}>
              Nome completo *
            </label>
            <input {...register('nome')} placeholder="João Silva" style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--tf-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--tf-primary-bg)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--tf-border-color)'; e.currentTarget.style.boxShadow = 'none' }}
            />
            {errors.nome && <p style={{ fontSize: 12, color: 'var(--tf-red)', marginTop: 4 }}>{errors.nome.message}</p>}
          </div>

          {/* Tipo de acesso */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tf-txt2)', marginBottom: 8 }}>
              Tipo de acesso *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(['email', 'pin'] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => handleTypeChange(tipo)}
                  style={{
                    padding: '12px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    border: tipoAcesso === tipo ? '2px solid var(--tf-primary)' : '2px solid var(--tf-border-color)',
                    background: tipoAcesso === tipo ? 'var(--tf-primary-bg)' : 'var(--tf-surface)',
                  }}
                >
                  {tipo === 'email' ? <Mail size={20} style={{ color: tipoAcesso === 'email' ? 'var(--tf-primary)' : 'var(--tf-txt3)' }} /> : <Hash size={20} style={{ color: tipoAcesso === 'pin' ? 'var(--tf-primary)' : 'var(--tf-txt3)' }} />}
                  <span style={{ fontSize: 13, fontWeight: 500, color: tipoAcesso === tipo ? 'var(--tf-primary)' : 'var(--tf-txt2)' }}>
                    {tipo === 'email' ? 'Acesso por email' : 'Acesso por PIN'}
                  </span>
                  {tipo === 'pin' && (
                    <span style={{ fontSize: 11, color: 'var(--tf-txt3)' }}>somente cozinheiro</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Campos condicionais */}
          {tipoAcesso === 'email' ? (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tf-txt2)', marginBottom: 6 }}>
                Email *
              </label>
              <input {...register('email')} type="email" placeholder="joao@email.com" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--tf-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--tf-primary-bg)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--tf-border-color)'; e.currentTarget.style.boxShadow = 'none' }}
              />
              {errors.email && <p style={{ fontSize: 12, color: 'var(--tf-red)', marginTop: 4 }}>{errors.email.message}</p>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Controller
                control={control}
                name="pin"
                render={({ field }) => (
                  <div>
                    <OtpInput value={field.value ?? ''} onChange={field.onChange} label="PIN (4 dígitos) *" />
                    {errors.pin && <p style={{ fontSize: 12, color: 'var(--tf-red)', marginTop: 6 }}>{errors.pin.message}</p>}
                  </div>
                )}
              />
              <Controller
                control={control}
                name="confirmPin"
                render={({ field }) => (
                  <div>
                    <OtpInput value={field.value ?? ''} onChange={field.onChange} label="Confirmar PIN *" />
                    {errors.confirmPin && <p style={{ fontSize: 12, color: 'var(--tf-red)', marginTop: 6 }}>{errors.confirmPin.message}</p>}
                  </div>
                )}
              />
              <p style={{ fontSize: 12, color: 'var(--tf-txt3)', margin: 0, lineHeight: 1.5 }}>
                O cozinheiro usará este PIN para acessar o painel da cozinha. Nenhum email necessário.
              </p>
            </div>
          )}

          {/* Cargo */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tf-txt2)', marginBottom: 8 }}>
              Cargo *
            </label>
            {visibleRoles.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>
                {tipoAcesso === 'pin' ? 'Nenhum cargo de cozinheiro encontrado.' : 'Nenhum cargo disponível.'}
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {visibleRoles.map((role) => {
                  const meta = getRoleMeta(role.name)
                  const selected = roleId === role.id
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setValue('roleId', role.id, { shouldValidate: true })}
                      style={{
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        position: 'relative',
                        border: selected ? '2px solid var(--tf-primary)' : '2px solid var(--tf-border-color)',
                        background: selected ? 'var(--tf-primary-bg)' : 'var(--tf-surface)',
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}
                    >
                      <meta.icon size={16} style={{ color: selected ? 'var(--tf-primary)' : 'var(--tf-txt3)' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: selected ? 'var(--tf-primary)' : 'var(--tf-txt)' }}>
                        {role.name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--tf-txt3)', lineHeight: 1.3 }}>
                        {meta.desc}
                      </span>
                      {selected && (
                        <span style={{
                          position: 'absolute', top: 6, right: 6,
                          width: 16, height: 16, borderRadius: '50%',
                          background: 'var(--tf-primary)', color: 'white',
                          fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            {errors.roleId && <p style={{ fontSize: 12, color: 'var(--tf-red)', marginTop: 4 }}>{errors.roleId.message}</p>}
          </div>

          {/* Permission preview */}
          {selectedRole && selectedRole.permissions && (
            <div style={{ background: 'var(--tf-surface2)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--tf-border-light)' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--tf-txt2)', margin: '0 0 6px' }}>Permissões deste cargo</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {((expandedPerms ? selectedRole.permissions : selectedRole.permissions.slice(0, 4)) as string[]).map((p) => (
                  <span key={p} style={{ fontSize: 12, color: 'var(--tf-txt3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--tf-green-ok)' }}>✓</span> {p.replace('.', ' → ')}
                  </span>
                ))}
              </div>
              {selectedRole.permissions.length > 4 && (
                <button type="button" onClick={() => setExpandedPerms((v) => !v)}
                  style={{ fontSize: 12, color: 'var(--tf-primary)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 6, padding: 0 }}>
                  {expandedPerms ? 'Ver menos ↑' : `Ver todas (${selectedRole.permissions.length}) →`}
                </button>
              )}
            </div>
          )}
        </form>
        )}

        <SheetFooter style={{ flexDirection: 'column', gap: 8, padding: '12px 16px' }}>
          {inviteResult ? (
            <button
              type="button"
              onClick={() => handleClose(false)}
              style={{
                width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: C.green, color: '#fff',
                fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 15,
              }}
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={submitting}
                style={{
                  width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                  background: 'var(--tf-primary)', color: 'var(--tf-primary-txt)',
                  fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: submitting ? 0.8 : 1,
                }}
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {tipoAcesso === 'email' ? 'Enviar convite' : 'Cadastrar'}
              </button>
              <button
                type="button"
                onClick={() => handleClose(false)}
                style={{
                  width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                  background: 'none', color: 'var(--tf-txt3)', cursor: 'pointer', fontSize: 14,
                }}
              >
                Cancelar
              </button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
