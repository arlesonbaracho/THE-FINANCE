import { prisma } from '@/lib/prisma'
import { FocusNfeAdapter } from './focus-nfe.adapter'
import type { FiscalProvider } from './fiscal-provider.types'
import { montarPayloadNfce } from './nfce-payload'

const STATUS_MAP: Record<string, 'AUTORIZADA' | 'PROCESSANDO' | 'REJEITADA' | 'CANCELADA'> = {
  autorizado: 'AUTORIZADA', processando: 'PROCESSANDO', erro: 'REJEITADA', cancelado: 'CANCELADA',
}

export async function emitirNfceParaPedido(
  pedidoId: string,
  tenantId: string,
  provider: FiscalProvider = new FocusNfeAdapter(),
): Promise<{ status: string; nfId: string | null }> {
  // Tenant-scoped: evita que um pedido de outro tenant seja emitido/consultado por palpite de ID
  const existente = await prisma.nfProcessada.findFirst({ where: { pedidoId, tenantId } })
  if (existente && (existente.status === 'AUTORIZADA' || existente.status === 'PROCESSANDO')) {
    return { status: existente.status, nfId: existente.id }
  }

  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, tenantId },
    include: { itens: { include: { product: true } }, pagamentos: true, tenant: { include: { fiscal: true } } },
  })
  if (!pedido?.tenant?.fiscal || !pedido.tenant.cnpj) return { status: 'ERRO', nfId: null }
  const f = pedido.tenant.fiscal
  const numero = f.proximoNumeroNfce ?? 1

  const payload = montarPayloadNfce({
    cnpjEmitente: pedido.tenant.cnpj,
    fiscal: {
      ncmPadrao: f.ncmPadrao ?? undefined, cfopPadrao: f.cfopPadrao ?? undefined,
      cstCsosnPadrao: f.cstCsosnPadrao ?? undefined, origemMercadoriaPadrao: f.origemMercadoriaPadrao ?? undefined,
      serie: f.serieNfce ?? 1, numero,
    },
    pedido: {
      total: pedido.total,
      itens: pedido.itens.map((it) => ({
        nome: it.product.name, quantidade: it.quantidade, precoUnitario: it.precoUnitario,
        ncm: it.product.ncm ?? undefined, cfop: it.product.cfop ?? undefined,
        cstCsosn: it.product.cstCsosn ?? undefined, origemMercadoria: it.product.origemMercadoria ?? undefined,
        unidadeTributavel: it.product.unidadeTributavel ?? undefined,
      })),
      pagamentos: pedido.pagamentos.map((p) => ({ formaPagamento: p.formaPagamento, valor: p.valor })),
    },
  })

  const ref = `nfce-${pedidoId}`
  const res = await provider.emitirNfce(ref, payload)
  const status = STATUS_MAP[res.status] ?? 'REJEITADA'

  const data = {
    tenantId: pedido.tenantId, origem: 'EMISSAO' as const, tipo: 'SAIDA' as const,
    status, pedidoId, refExterna: ref, processadoPor: 'nfce',
    chaveAcesso: res.chaveAcesso ?? null, danfeUrl: res.danfeUrl ?? null,
    protocoloAutorizacao: res.protocolo ?? null, motivoRejeicao: res.motivo ?? null,
  }
  const nf = await prisma.nfProcessada.upsert({ where: { pedidoId }, create: data, update: data })

  if (status === 'AUTORIZADA') {
    await prisma.tenantFiscal.update({ where: { tenantId: pedido.tenantId }, data: { proximoNumeroNfce: numero + 1 } })
  }
  return { status, nfId: nf.id }
}
