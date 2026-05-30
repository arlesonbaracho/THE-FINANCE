'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { getSocket } from '@/lib/socket-client'
import { useDashboardStore } from '@/stores/dashboard.store'
import { KpiGrid } from '@/components/dashboard/KpiGrid'
import { SalesChart } from '@/components/dashboard/SalesChart'
import { WeeklyHeatmap } from '@/components/dashboard/WeeklyHeatmap'
import { CriticalStockPanel } from '@/components/dashboard/CriticalStockPanel'
import { AlertsHighlight } from '@/components/dashboard/AlertsHighlight'
import { DashboardCaixa } from '@/components/dashboard/DashboardCaixa'
import { useAlerts } from '@/components/alerts/AlertsProvider'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

function getSaudacao(nome: string): string {
  const h = new Date().getHours()
  const periodo = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${periodo}, ${nome}!`
}

function formatDataHoje(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

type GraficoResponse = {
  diaAtual: number[]
  semanaPassada: number | null
}

type HeatmapCell = { media: number; pedidos: number }

export default function DashboardPage() {
  const { data: session } = useSession()
  const role = session?.user?.role
  // STAFF without ADMIN/MANAGER role sees simplified caixa view
  const isCaixa = role === 'STAFF'

  const nome = session?.user?.name?.split(' ')[0] ?? 'usuário'
  const { unreadCount } = useAlerts()

  const { kpis, setKpis, applyDelta, grafico, setGrafico, appendGrafico } =
    useDashboardStore()

  // KPIs — load once, update via socket
  const { data: kpisData } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: (): Promise<typeof kpis> =>
      fetch('/api/dashboard/kpis').then((r) => r.json()),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: !isCaixa,
  })

  // Grafico — load once, update via socket
  const { data: graficoData } = useQuery<GraficoResponse>({
    queryKey: ['dashboard-grafico'],
    queryFn: () => fetch('/api/dashboard/grafico').then((r) => r.json()),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: !isCaixa,
  })

  // Heatmap — cached 1h in Redis + React Query staleTime
  const { data: heatmapData } = useQuery<HeatmapCell[][]>({
    queryKey: ['dashboard-heatmap'],
    queryFn: () => fetch('/api/dashboard/heatmap').then((r) => r.json()),
    staleTime: 3_600_000,
    enabled: !isCaixa,
  })

  // Hydrate store from initial fetch
  useEffect(() => {
    if (kpisData) setKpis(kpisData)
  }, [kpisData, setKpis])

  useEffect(() => {
    if (graficoData?.diaAtual) {
      setGrafico(
        graficoData.diaAtual.map((v: number, i: number) => ({ hora: i, valor: v }))
      )
    }
  }, [graficoData, setGrafico])

  // Real-time dashboard updates via socket
  useEffect(() => {
    if (isCaixa) return
    const socket = getSocket()

    const handleDashboard = (payload: { tipo: string; total?: number }) => {
      if (payload.tipo === 'pedido_finalizado' && payload.total != null) {
        applyDelta({ total: payload.total })
        const hora = new Date().getHours()
        const currentTotal = (kpis?.totalVendas ?? 0) + payload.total
        appendGrafico(hora, currentTotal)
      }
    }

    socket.on('dashboard:atualizar', handleDashboard)
    return () => {
      socket.off('dashboard:atualizar', handleDashboard)
    }
  }, [isCaixa, applyDelta, appendGrafico, kpis?.totalVendas])

  // Caixa simplified view
  if (isCaixa) {
    return <DashboardCaixa />
  }

  const hoje = formatDataHoje()

  return (
    <div className="space-y-6">
      {/* Banner de alertas críticos */}
      {unreadCount > 0 && (
        <Link
          href="/alertas"
          className="flex items-center gap-3 rounded-xl p-4"
          style={{
            background: 'var(--tf-red-bg)',
            border: '1px solid var(--tf-red-bd)',
          }}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--tf-red)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--tf-red)' }}>
            {unreadCount} alerta{unreadCount !== 1 ? 's' : ''} não lido
            {unreadCount !== 1 ? 's' : ''} precisam da sua atenção
          </p>
        </Link>
      )}

      {/* Saudação */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--tf-txt)', margin: 0 }}>
          {getSaudacao(nome)}
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--tf-txt3)', marginTop: 3 }}>
          {hoje.charAt(0).toUpperCase() + hoje.slice(1)}
        </p>
      </div>

      {/* KPI Grid */}
      {kpis ? (
        <KpiGrid data={kpis} />
      ) : (
        <div
          className="h-40 animate-pulse rounded-xl"
          style={{ background: 'var(--tf-surface2)' }}
        />
      )}

      {/* Gráfico de vendas + Estoque crítico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SalesChart
            diaAtual={grafico.map((p) => p.valor)}
            semanaPassada={graficoData?.semanaPassada ?? null}
          />
        </div>
        <CriticalStockPanel />
      </div>

      {/* Heatmap semanal */}
      {heatmapData && <WeeklyHeatmap data={heatmapData} />}

      {/* Alertas em destaque */}
      <AlertsHighlight />
    </div>
  )
}
