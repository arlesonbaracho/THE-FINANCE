'use client'

import { useState } from 'react'
import { RefreshCw, Download, ChevronDown } from 'lucide-react'
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom'

export type DateRange = { startDate: string; endDate: string }

type Props = {
  period: Period
  startDate: string
  endDate: string
  lastRefreshed: Date | null
  onPeriodChange: (period: Period, range: DateRange) => void
  onRefresh: () => void
  onExportCSV: () => void
  onExportExcel: () => void
  onExportPDF: () => void
}

function fmt(d: Date) {
  return d.toISOString().split('T')[0]
}

export function getPeriodRange(period: Period): DateRange {
  const now = new Date()
  switch (period) {
    case 'today':
      return { startDate: fmt(now), endDate: fmt(now) }
    case 'yesterday': {
      const y = subDays(now, 1)
      return { startDate: fmt(y), endDate: fmt(y) }
    }
    case 'week':
      return { startDate: fmt(startOfWeek(now, { locale: ptBR })), endDate: fmt(endOfWeek(now, { locale: ptBR })) }
    case 'month':
      return { startDate: fmt(startOfMonth(now)), endDate: fmt(endOfMonth(now)) }
    case 'year':
      return { startDate: fmt(startOfYear(now)), endDate: fmt(endOfYear(now)) }
    default:
      return { startDate: fmt(now), endDate: fmt(now) }
  }
}

const PRESETS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mês' },
  { id: 'year', label: 'Este ano' },
  { id: 'custom', label: 'Personalizado' },
]

export function ReportFilters({ period, startDate, endDate, lastRefreshed, onPeriodChange, onRefresh, onExportCSV, onExportExcel, onExportPDF }: Props) {
  const [showExport, setShowExport] = useState(false)

  function handlePreset(p: Period) {
    if (p === 'custom') {
      onPeriodChange('custom', { startDate, endDate })
      return
    }
    onPeriodChange(p, getPeriodRange(p))
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        padding: '10px 16px',
        borderBottom: '1px solid var(--tf-border)',
        background: 'var(--tf-surface)',
        flexShrink: 0,
      }}
    >
      {/* Period presets */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePreset(preset.id)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: period === preset.id ? 600 : 400,
              color: period === preset.id ? 'var(--tf-primary)' : 'var(--tf-txt2)',
              background: period === preset.id ? 'var(--tf-primary-bg)' : 'transparent',
              border: `1px solid ${period === preset.id ? 'var(--tf-primary-bd)' : 'var(--tf-border)'}`,
              cursor: 'pointer',
              transition: 'all 120ms',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onPeriodChange('custom', { startDate: e.target.value, endDate })}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--tf-border)',
              background: 'var(--tf-input-bg)',
              color: 'var(--tf-txt)',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <span style={{ color: 'var(--tf-txt3)', fontSize: 12 }}>até</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => onPeriodChange('custom', { startDate, endDate: e.target.value })}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--tf-border)',
              background: 'var(--tf-input-bg)',
              color: 'var(--tf-txt)',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Last refreshed */}
      {lastRefreshed && (
        <span style={{ fontSize: 11, color: 'var(--tf-txt3)' }}>
          Atualizado {format(lastRefreshed, 'HH:mm', { locale: ptBR })}
        </span>
      )}

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        title="Atualizar dados"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 10px',
          borderRadius: 6,
          fontSize: 12,
          color: 'var(--tf-txt2)',
          background: 'transparent',
          border: '1px solid var(--tf-border)',
          cursor: 'pointer',
        }}
      >
        <RefreshCw size={12} />
        Atualizar
      </button>

      {/* Export dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowExport((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            borderRadius: 6,
            fontSize: 12,
            color: 'var(--tf-txt)',
            background: 'var(--tf-primary)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Download size={12} />
          Exportar
          <ChevronDown size={11} />
        </button>

        {showExport && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowExport(false)} />
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 4,
                background: 'var(--tf-surface)',
                border: '1px solid var(--tf-border)',
                borderRadius: 8,
                padding: 4,
                zIndex: 50,
                minWidth: 140,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              }}
            >
              {[
                { label: 'PDF', action: () => { onExportPDF(); setShowExport(false) } },
                { label: 'Excel (.xlsx)', action: () => { onExportExcel(); setShowExport(false) } },
                { label: 'CSV', action: () => { onExportCSV(); setShowExport(false) } },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '7px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    color: 'var(--tf-txt)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tf-surface2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
