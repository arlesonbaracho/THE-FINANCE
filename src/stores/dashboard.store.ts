import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

type GraficoPoint = { hora: number; valor: number }

type KpiData = {
  totalVendas: number
  totalPedidos: number
  pedidosAbertos: number
  ticketMedio: number
  cmvTotal: number
  cmvPercentual: number
  benchmark: number
  maisVendido: { nome: string; qtd: number } | null
  topOperador: string | null
  variacaoVendas: number | null
  variacaoTicket: number | null
}

type DashboardState = {
  kpis: KpiData | null
  grafico: GraficoPoint[]
  setKpis: (kpis: KpiData) => void
  applyDelta: (delta: { total: number }) => void
  setGrafico: (pontos: GraficoPoint[]) => void
  appendGrafico: (hora: number, acumulado: number) => void
}

export const useDashboardStore = create<DashboardState>()(
  immer((set) => ({
    kpis: null,
    grafico: [],
    setKpis: (kpis) =>
      set((s) => {
        s.kpis = kpis
      }),
    applyDelta: (delta) =>
      set((s) => {
        if (!s.kpis) return
        s.kpis.totalVendas += delta.total
        s.kpis.totalPedidos += 1
        s.kpis.pedidosAbertos = Math.max(0, s.kpis.pedidosAbertos - 1)
        s.kpis.ticketMedio =
          s.kpis.totalPedidos > 0
            ? s.kpis.totalVendas / s.kpis.totalPedidos
            : 0
      }),
    setGrafico: (pontos) =>
      set((s) => {
        s.grafico = pontos
      }),
    appendGrafico: (hora, acumulado) =>
      set((s) => {
        const idx = s.grafico.findIndex((p) => p.hora === hora)
        if (idx >= 0) {
          s.grafico[idx].valor = acumulado
        } else {
          s.grafico.push({ hora, valor: acumulado })
        }
      }),
  }))
)
