import { prisma } from '@/lib/prisma'
import { redisConnection } from '@/lib/bullmq'
import { subHours } from 'date-fns'

export interface PlatformMetrics {
  uptime24h: number
  latenciaMedia: number
  dbConexoes: number
  dbQueriesLentas: number
  redisMemoriaPercent: number
  redisHitRate: number
  aiTokensHoje: number
  aiErroPercent: number
  jobsFalhos: number
  webhooksIfoodFalhos24h: number
}

export async function calcularUptime(horas: number): Promise<number> {
  const desde = subHours(new Date(), horas)
  const logs = await prisma.platformHealthLog.findMany({
    where: { registradoEm: { gte: desde }, tipo: 'API' },
    select: { status: true },
  })
  if (logs.length === 0) return 100
  const ok = logs.filter((l) => l.status === 'OK').length
  return (ok / logs.length) * 100
}

export async function coletarMetricas(): Promise<PlatformMetrics> {
  const agora = new Date()
  const inicio24h = subHours(agora, 24)

  // Latência média dos últimos logs de API
  const logsApi = await prisma.platformHealthLog.findMany({
    where: { tipo: 'API', registradoEm: { gte: inicio24h } },
    select: { valor: true },
    orderBy: { registradoEm: 'desc' },
    take: 288,
  })
  const latenciaMedia =
    logsApi.length > 0
      ? logsApi.reduce((s, l) => s + Number(l.valor), 0) / logsApi.length
      : 0

  // DB — conexões ativas
  let dbConexoes = 0
  let dbQueriesLentas = 0
  try {
    const conResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) FROM pg_stat_activity WHERE state = 'active'
    `
    dbConexoes = Number(conResult[0]?.count ?? 0)
  } catch { /* pg_stat_activity pode não estar disponível */ }

  // Redis — memória e hit rate
  let redisMemoriaPercent = 0
  let redisHitRate = 100
  try {
    const info = await (redisConnection as unknown as { info: (s: string) => Promise<string> }).info('all')
    const usedMem = parseRedisInfo(info, 'used_memory')
    const maxMem = parseRedisInfo(info, 'maxmemory') || usedMem * 2
    const hits = parseRedisInfo(info, 'keyspace_hits')
    const misses = parseRedisInfo(info, 'keyspace_misses')
    redisMemoriaPercent = maxMem > 0 ? (usedMem / maxMem) * 100 : 0
    redisHitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 100
  } catch { /* Redis pode estar indisponível em dev */ }

  // AI usage hoje
  const hoje = new Date()
  const aiAgg = await prisma.aiUsage.aggregate({
    _sum: { tokensInput: true, tokensOutput: true },
    where: { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() },
  })
  const aiTokensHoje = (aiAgg._sum.tokensInput ?? 0) + (aiAgg._sum.tokensOutput ?? 0)

  // Webhooks iFood com falha nas últimas 24h
  const webhooksIfoodFalhos24h = await prisma.iFoodWebhookLog
    .findMany({
      where: { status: 'FALHOU', createdAt: { gte: inicio24h } },
      select: { id: true },
    })
    .then((r) => r.length)

  const uptime24h = await calcularUptime(24)

  return {
    uptime24h,
    latenciaMedia,
    dbConexoes,
    dbQueriesLentas,
    redisMemoriaPercent,
    redisHitRate,
    aiTokensHoje,
    aiErroPercent: 0,
    jobsFalhos: 0,
    webhooksIfoodFalhos24h,
  }
}

function parseRedisInfo(info: string, key: string): number {
  const match = new RegExp(`${key}:(\\d+)`).exec(info)
  return match ? parseInt(match[1], 10) : 0
}

function classificarStatus(
  tipo: string,
  valor: number
): 'OK' | 'ALERTA' | 'CRITICO' {
  const limites: Record<string, { alerta: number; critico: number; inversao?: boolean }> = {
    uptime:      { alerta: 95, critico: 50, inversao: true },
    latencia:    { alerta: 1000, critico: 3000 },
    dbConexoes:  { alerta: 50, critico: 100 },
    redisMemoria:{ alerta: 70, critico: 90 },
    hitRate:     { alerta: 70, critico: 50, inversao: true },
  }
  const limite = limites[tipo]
  if (!limite) return 'OK'
  if (limite.inversao) {
    if (valor < limite.critico) return 'CRITICO'
    if (valor < limite.alerta) return 'ALERTA'
  } else {
    if (valor >= limite.critico) return 'CRITICO'
    if (valor >= limite.alerta) return 'ALERTA'
  }
  return 'OK'
}

export async function salvarSnapshot(metricas: PlatformMetrics): Promise<void> {
  const registros = [
    { tipo: 'API' as const,      metrica: 'uptime_24h',        valor: metricas.uptime24h,            status: classificarStatus('uptime', metricas.uptime24h) },
    { tipo: 'API' as const,      metrica: 'latencia_media_ms',  valor: metricas.latenciaMedia,        status: classificarStatus('latencia', metricas.latenciaMedia) },
    { tipo: 'DATABASE' as const, metrica: 'conexoes_ativas',    valor: metricas.dbConexoes,           status: classificarStatus('dbConexoes', metricas.dbConexoes) },
    { tipo: 'REDIS' as const,    metrica: 'memoria_percent',    valor: metricas.redisMemoriaPercent,  status: classificarStatus('redisMemoria', metricas.redisMemoriaPercent) },
    { tipo: 'REDIS' as const,    metrica: 'hit_rate_percent',   valor: metricas.redisHitRate,         status: classificarStatus('hitRate', metricas.redisHitRate) },
    { tipo: 'AI' as const,       metrica: 'tokens_hoje',        valor: metricas.aiTokensHoje,         status: 'OK' as const },
    { tipo: 'WEBHOOK' as const,  metrica: 'ifood_falhos_24h',   valor: metricas.webhooksIfoodFalhos24h, status: metricas.webhooksIfoodFalhos24h > 10 ? 'ALERTA' as const : 'OK' as const },
  ]

  await Promise.all(
    registros.map((r) =>
      prisma.platformHealthLog.create({
        data: { tipo: r.tipo, metrica: r.metrica, valor: r.valor, status: r.status },
      })
    )
  )

  const criticos = registros.filter((r) => r.status === 'CRITICO')
  if (criticos.length > 0) {
    await prisma.adminNotification.create({
      data: {
        tipo: 'SAUDE_PLATAFORMA',
        titulo: `Métricas críticas: ${criticos.map((r) => r.metrica).join(', ')}`,
        descricao: criticos.map((r) => `${r.metrica}: ${r.valor}`).join('\n'),
        severidade: 'CRITICO',
      },
    })
  }
}
