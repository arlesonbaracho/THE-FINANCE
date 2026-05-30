'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ReportSidebar, type ReportId } from '@/components/relatorios/report-sidebar'
import { ReportFilters, type Period, type DateRange, getPeriodRange } from '@/components/relatorios/report-filters'
import { OverviewReport } from '@/components/relatorios/overview-report'
import { ProductsReport } from '@/components/relatorios/products-report'
import { ComparisonReport } from '@/components/relatorios/comparison-report'
import { OperatorsReport } from '@/components/relatorios/operators-report'
import { StockTurnoverReport } from '@/components/relatorios/stock-turnover-report'
import { AbcCurveReport } from '@/components/relatorios/abc-curve-report'
import { CmvReport } from '@/components/relatorios/cmv-report'
import { KitchenReport } from '@/components/relatorios/kitchen-report'
import { invalidateCache } from '@/lib/client-cache'
import { exportCSV, exportExcel, exportPDF } from '@/lib/report-export'

const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])

const REPORT_TITLES: Record<ReportId, string> = {
  overview: 'Visão Geral de Vendas',
  products: 'Vendas por Produto',
  operators: 'Vendas por Operador',
  comparison: 'Comparativo de Períodos',
  'stock-turnover': 'Giro de Estoque',
  'abc-curve': 'Curva ABC de Insumos',
  cmv: 'CMV Detalhado',
  kitchen: 'Desempenho da Cozinha',
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function RelatoriosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [activeReport, setActiveReport] = useState<ReportId>('overview')
  const [period, setPeriod] = useState<Period>('month')
  const [startDate, setStartDate] = useState(() => getPeriodRange('month').startDate)
  const [endDate, setEndDate] = useState(() => getPeriodRange('month').endDate)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Last overview data reference for export
  const [overviewData, setOverviewData] = useState<{ kpis: { totalVendas: number; numPedidos: number; ticketMedio: number; cmvTotal: number; cmvPct: number } } | null>(null)

  // Permission check
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.role || !ALLOWED_ROLES.has(session.user.role)) {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  function handlePeriodChange(p: Period, range: DateRange) {
    setPeriod(p)
    setStartDate(range.startDate)
    setEndDate(range.endDate)
    setRefreshKey((k) => k + 1)
  }

  const handleRefresh = useCallback(() => {
    // Invalidate all report cache keys
    invalidateCache(
      `/api/relatorios/vendas?startDate=${startDate}&endDate=${endDate}`,
      `/api/relatorios/produtos?startDate=${startDate}&endDate=${endDate}`,
      `/api/relatorios/operadores?startDate=${startDate}&endDate=${endDate}`,
      `/api/relatorios/estoque/giro?startDate=${startDate}&endDate=${endDate}`,
      `/api/relatorios/estoque/abc?startDate=${startDate}&endDate=${endDate}`,
      `/api/relatorios/cmv?startDate=${startDate}&endDate=${endDate}`,
      `/api/relatorios/cozinha?startDate=${startDate}&endDate=${endDate}`,
    )
    setRefreshKey((k) => k + 1)
    setLastRefreshed(new Date())
  }, [startDate, endDate])

  function handleExportCSV() {
    if (!overviewData) return
    exportCSV(
      [{ totalVendas: fmt(overviewData.kpis.totalVendas), numPedidos: overviewData.kpis.numPedidos, ticketMedio: fmt(overviewData.kpis.ticketMedio), cmv: fmt(overviewData.kpis.cmvTotal), cmvPct: `${overviewData.kpis.cmvPct.toFixed(1)}%` }],
      [
        { key: 'totalVendas', label: 'Total vendas' },
        { key: 'numPedidos', label: 'Nº pedidos' },
        { key: 'ticketMedio', label: 'Ticket médio' },
        { key: 'cmv', label: 'CMV' },
        { key: 'cmvPct', label: 'CMV %' },
      ],
      `relatorio-${activeReport}-${startDate}`
    )
  }

  async function handleExportExcel() {
    if (!overviewData) return
    await exportExcel(
      [
        {
          name: REPORT_TITLES[activeReport],
          headers: ['Total vendas', 'Nº pedidos', 'Ticket médio', 'CMV', 'CMV %'],
          rows: [[fmt(overviewData.kpis.totalVendas), overviewData.kpis.numPedidos, fmt(overviewData.kpis.ticketMedio), fmt(overviewData.kpis.cmvTotal), `${overviewData.kpis.cmvPct.toFixed(1)}%`]],
        },
      ],
      `relatorio-${activeReport}-${startDate}`
    )
  }

  async function handleExportPDF() {
    if (!overviewData) return
    await exportPDF(
      REPORT_TITLES[activeReport],
      `${startDate} até ${endDate}`,
      session?.user?.name ?? 'Restaurante',
      [
        { label: 'Total de Vendas', value: fmt(overviewData.kpis.totalVendas) },
        { label: 'Nº de Pedidos', value: String(overviewData.kpis.numPedidos) },
        { label: 'Ticket Médio', value: fmt(overviewData.kpis.ticketMedio) },
        { label: 'CMV', value: `${fmt(overviewData.kpis.cmvTotal)} (${overviewData.kpis.cmvPct.toFixed(1)}%)` },
      ],
      [],
      []
    )
  }

  if (status === 'loading') return null

  const reportProps = { startDate, endDate, key: `${activeReport}-${startDate}-${endDate}-${refreshKey}` }

  return (
    <div style={{ display: 'flex', height: '100%', margin: '-24px', overflow: 'hidden' }}>
      {/* Inner sidebar */}
      <ReportSidebar active={activeReport} onSelect={setActiveReport} />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Filters bar */}
        <ReportFilters
          period={period}
          startDate={startDate}
          endDate={endDate}
          lastRefreshed={lastRefreshed}
          onPeriodChange={handlePeriodChange}
          onRefresh={handleRefresh}
          onExportCSV={handleExportCSV}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
        />

        {/* Report title */}
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tf-txt)', margin: 0 }}>
            {REPORT_TITLES[activeReport]}
          </h2>
          <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginTop: 2 }}>
            {startDate === endDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR') : `${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} – ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`}
          </p>
        </div>

        {/* Report content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
          {activeReport === 'overview' && (
            <OverviewReport {...reportProps} onDataReady={setOverviewData} />
          )}
          {activeReport === 'products' && <ProductsReport {...reportProps} />}
          {activeReport === 'comparison' && <ComparisonReport key={reportProps.key} />}
          {activeReport === 'operators' && <OperatorsReport {...reportProps} />}
          {activeReport === 'stock-turnover' && <StockTurnoverReport {...reportProps} />}
          {activeReport === 'abc-curve' && <AbcCurveReport {...reportProps} />}
          {activeReport === 'cmv' && <CmvReport {...reportProps} />}
          {activeReport === 'kitchen' && <KitchenReport {...reportProps} />}
        </div>
      </div>
    </div>
  )
}
