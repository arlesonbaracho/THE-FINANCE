import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { NfStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/** Status que entram no fechamento (têm valor fiscal e, em regra, XML). */
const STATUS_FECHAMENTO: NfStatus[] = [NfStatus.AUTORIZADA, NfStatus.CAPTURADA, NfStatus.CANCELADA]

export type ResultadoFechamento = {
  buffer: Buffer
  totalNotas: number
  totalEntradas: number
  totalSaidas: number
  totalCanceladas: number
  /** Notas no período/status mas sem XML — não entram no ZIP. */
  ignoradas: number
}

type NotaFechamento = {
  id: string
  tipo: string | null
  status: string
  xml: string | null
  chaveAcesso: string | null
  modelo: string | null
  numeroNf: string | null
  fornecedorNome: string | null
  valorTotal: unknown
  dataEmissao: Date | null
}

const STATUS_LABEL: Record<string, string> = {
  AUTORIZADA: 'Autorizada',
  CAPTURADA: 'Capturada',
  CANCELADA: 'Cancelada',
}

function tipoLabel(tipo: string | null): string {
  return tipo === 'SAIDA' ? 'Saída' : 'Entrada'
}

function pastaPorTipo(tipo: string | null): string {
  return tipo === 'SAIDA' ? 'saidas' : 'entradas'
}

function nomeArquivoXml(nota: NotaFechamento): string {
  return `${nota.chaveAcesso ?? nota.id}.xml`
}

function valorNumero(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function dataBR(d: Date | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('pt-BR')
}

/**
 * Monta o pacote de fechamento fiscal (ZIP) do período: XMLs das notas
 * (entradas + saídas) organizados por tipo + um relatório .xlsx de apoio.
 * Tenant-scoped. `inicio`/`fim` já resolvidos pelo chamador.
 */
export async function gerarFechamentoFiscal({
  tenantId,
  inicio,
  fim,
}: {
  tenantId: string
  inicio: Date
  fim: Date
}): Promise<ResultadoFechamento> {
  const notas = (await prisma.nfProcessada.findMany({
    where: {
      tenantId,
      dataEmissao: { gte: inicio, lte: fim },
      status: { in: STATUS_FECHAMENTO },
    },
    orderBy: { dataEmissao: 'asc' },
    select: {
      id: true,
      tipo: true,
      status: true,
      xml: true,
      chaveAcesso: true,
      modelo: true,
      numeroNf: true,
      fornecedorNome: true,
      valorTotal: true,
      dataEmissao: true,
    },
  })) as NotaFechamento[]

  const validas = notas.filter((n) => n.xml != null && n.xml !== '')
  const ignoradas = notas.length - validas.length

  // ── Relatório .xlsx ──────────────────────────────────────────────
  const header = ['Modelo', 'Tipo', 'Número', 'Chave de acesso', 'Data emissão', 'Fornecedor/Destinatário', 'Valor total', 'Status']
  const linhas = validas.map((n) => [
    n.modelo ?? '',
    tipoLabel(n.tipo),
    n.numeroNf ?? '',
    n.chaveAcesso ?? '',
    dataBR(n.dataEmissao),
    n.fornecedorNome ?? '',
    valorNumero(n.valorTotal),
    STATUS_LABEL[n.status] ?? n.status,
  ])
  const totalValor = validas.reduce((s, n) => s + valorNumero(n.valorTotal), 0)
  const rodape = ['', '', '', '', '', 'TOTAL', totalValor, '']

  const ws = XLSX.utils.aoa_to_sheet([header, ...linhas, rodape])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Notas')
  const xlsxBuffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  // ── ZIP ──────────────────────────────────────────────────────────
  const periodo = nomePeriodo(inicio, fim)
  const zip = new JSZip()
  for (const n of validas) {
    zip.file(`${pastaPorTipo(n.tipo)}/${nomeArquivoXml(n)}`, n.xml as string)
  }
  zip.file(`relatorio-fechamento-${periodo}.xlsx`, xlsxBuffer)
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  return {
    buffer,
    totalNotas: validas.length,
    totalEntradas: validas.filter((n) => n.tipo !== 'SAIDA').length,
    totalSaidas: validas.filter((n) => n.tipo === 'SAIDA').length,
    totalCanceladas: validas.filter((n) => n.status === 'CANCELADA').length,
    ignoradas,
  }
}

/** YYYY-MM se for mês cheio; senão YYYYMMDD-YYYYMMDD. Exportado p/ a rota nomear o arquivo. */
export function nomePeriodo(inicio: Date, fim: Date): string {
  const i = new Date(inicio)
  const f = new Date(fim)
  const mesmoMes = i.getFullYear() === f.getFullYear() && i.getMonth() === f.getMonth()
  const ehMesCheio =
    mesmoMes && i.getDate() === 1 && f.getDate() === new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate()
  if (ehMesCheio) {
    return `${i.getFullYear()}-${String(i.getMonth() + 1).padStart(2, '0')}`
  }
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `${fmt(i)}-${fmt(f)}`
}
