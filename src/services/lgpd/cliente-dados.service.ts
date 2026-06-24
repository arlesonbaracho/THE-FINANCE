import { prisma } from '@/lib/prisma'

export type DadosCliente = {
  reservas: unknown[]
  contatosWhatsapp: unknown[]
  logsWhatsapp: unknown[]
}

export function normalizarTelefone(t: string): string {
  return (t ?? '').replace(/\D/g, '')
}

export async function buscarDadosCliente(
  tenantId: string,
  telefone: string,
  nome?: string,
): Promise<DadosCliente> {
  const telNorm = normalizarTelefone(telefone)
  const nomeNorm = nome?.trim().toLowerCase()
  if (telNorm.length < 4 && !nomeNorm) {
    return { reservas: [], contatosWhatsapp: [], logsWhatsapp: [] }
  }

  const [reservas, contatos, logs] = await Promise.all([
    prisma.reserva.findMany({ where: { tenantId } }),
    prisma.whatsAppContato.findMany({ where: { tenantId } }),
    prisma.whatsAppLog.findMany({ where: { tenantId } }),
  ])

  const casaTel = (campo: string | null | undefined) =>
    telNorm.length >= 4 && normalizarTelefone(campo ?? '').includes(telNorm)

  return {
    reservas: (reservas as Array<{ contato: string | null; clienteNome: string | null }>).filter(
      (r) => casaTel(r.contato) || (!!nomeNorm && (r.clienteNome ?? '').toLowerCase().includes(nomeNorm)),
    ),
    contatosWhatsapp: (contatos as Array<{ numero: string }>).filter((c) => casaTel(c.numero)),
    logsWhatsapp: (logs as Array<{ destinatario: string }>).filter((l) => casaTel(l.destinatario)),
  }
}

export async function excluirDadosCliente(
  tenantId: string,
  telefone: string,
  nome?: string,
): Promise<{ reservas: number; contatos: number; logs: number }> {
  const achados = await buscarDadosCliente(tenantId, telefone, nome)
  const ids = (arr: unknown[]) => arr.map((x) => (x as { id: string }).id)

  const [r, c, l] = await Promise.all([
    prisma.reserva.deleteMany({ where: { id: { in: ids(achados.reservas) }, tenantId } }),
    prisma.whatsAppContato.deleteMany({ where: { id: { in: ids(achados.contatosWhatsapp) }, tenantId } }),
    prisma.whatsAppLog.deleteMany({ where: { id: { in: ids(achados.logsWhatsapp) }, tenantId } }),
  ])
  return { reservas: r.count, contatos: c.count, logs: l.count }
}
