import { prisma } from '@/lib/prisma'
import type { PurchaseOrder } from '@prisma/client'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import * as XLSX from 'xlsx'
import { createElement } from 'react'

export async function gerarPedidoConsolidado(
  brandId: string,
  fornecedorId: string,
  createdBy: string
): Promise<PurchaseOrder> {
  const tenants = await prisma.tenant.findMany({
    where: { brandId },
    select: { id: true },
  })
  const tenantIds = tenants.map((t) => t.id)

  // Buscar alertas de estoque ativos em todas as unidades
  const alertas = await prisma.alert.findMany({
    where: {
      tenantId: { in: tenantIds },
      tipo: 'ESTOQUE',
      status: 'NAO_LIDO',
    },
    select: { tenantId: true, metadata: true },
  })

  // Agrupar por insumoId
  const grouped = new Map<
    string,
    { total: number; unit: string; dist: Record<string, number> }
  >()
  for (const alerta of alertas) {
    const meta = alerta.metadata as { ingredientId?: string; quantidadeNecessaria?: number; unit?: string }
    if (!meta.ingredientId) continue
    const cur = grouped.get(meta.ingredientId) ?? { total: 0, unit: meta.unit ?? 'UN', dist: {} }
    cur.total += meta.quantidadeNecessaria ?? 0
    cur.dist[alerta.tenantId] = (cur.dist[alerta.tenantId] ?? 0) + (meta.quantidadeNecessaria ?? 0)
    grouped.set(meta.ingredientId, cur)
  }

  const itens = Array.from(grouped.entries()).map(([insumoId, data]) => ({
    insumoId,
    quantidadeTotal: data.total,
    unidadeMedida: data.unit,
    distribuicaoPorUnidade: data.dist,
  }))

  return prisma.purchaseOrder.create({
    data: {
      brandId,
      fornecedorId,
      createdBy,
      status: 'RASCUNHO',
      valorTotal: 0,
      itens: { create: itens },
    },
  })
}

export async function exportarPDF(purchaseOrderId: string): Promise<Buffer> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      fornecedor: true,
      itens: { include: { insumo: true } },
    },
  })
  if (!po) throw new Error('Pedido não encontrado')

  const styles = StyleSheet.create({
    page: { padding: 32, fontSize: 10 },
    title: { fontSize: 16, marginBottom: 16 },
    row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 4 },
    col: { flex: 1 },
  })

  const doc = createElement(
    Document,
    null,
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      createElement(Text, { style: styles.title }, `Pedido de Compra #${po.id.slice(-6)}`),
      createElement(Text, null, `Fornecedor: ${po.fornecedor.name}`),
      createElement(Text, null, `Status: ${po.status}`),
      createElement(
        View,
        { style: { marginTop: 16 } },
        ...po.itens.map((item) =>
          createElement(
            View,
            { key: item.id, style: styles.row },
            createElement(Text, { style: styles.col }, item.insumo.name),
            createElement(Text, { style: styles.col }, `${item.quantidadeTotal} ${item.unidadeMedida}`)
          )
        )
      )
    )
  )

  return renderToBuffer(doc)
}

export async function exportarExcel(purchaseOrderId: string): Promise<Buffer> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      fornecedor: true,
      itens: { include: { insumo: true } },
    },
  })
  if (!po) throw new Error('Pedido não encontrado')

  const rows = po.itens.map((item) => ({
    Insumo: item.insumo.name,
    'Quantidade Total': Number(item.quantidadeTotal),
    'Unidade de Medida': item.unidadeMedida,
    'Custo Unitário Estimado': item.custoUnitarioEstimado ? Number(item.custoUnitarioEstimado) : '',
    Distribuição: JSON.stringify(item.distribuicaoPorUnidade),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido de Compra')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
