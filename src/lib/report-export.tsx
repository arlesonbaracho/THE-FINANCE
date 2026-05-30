'use client'

import React from 'react'

export function exportCSV(
  rows: Record<string, unknown>[],
  headers: { key: string; label: string }[],
  filename: string
) {
  const bom = '﻿'
  const headerLine = headers.map((h) => h.label).join(';')
  const dataLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h.key] ?? ''
        const str = String(val)
        return str.includes(';') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str
      })
      .join(';')
  )
  const csv = bom + [headerLine, ...dataLines].join('\n')
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`)
}

export async function exportExcel(
  sections: { name: string; headers: string[]; rows: (string | number | null)[][] }[],
  filename: string
) {
  const { utils, writeFile } = await import('xlsx')
  const wb = utils.book_new()

  const summaryData = sections.map((s) => ({ Relatório: s.name, 'Total linhas': s.rows.length }))
  utils.book_append_sheet(wb, utils.json_to_sheet(summaryData), 'Resumo Executivo')

  for (const section of sections) {
    const ws = utils.aoa_to_sheet([section.headers, ...section.rows])
    const range = utils.decode_range(ws['!ref'] ?? 'A1')
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = ws[utils.encode_cell({ r: 0, c: col })]
      if (cell) cell.s = { font: { bold: true } }
    }
    utils.book_append_sheet(wb, ws, section.name.slice(0, 31))
  }

  writeFile(wb, `${filename}.xlsx`)
}

export async function exportPDF(
  title: string,
  period: string,
  restaurantName: string,
  kpis: { label: string; value: string }[],
  tableHeaders: string[],
  tableRows: string[][]
) {
  const { pdf, Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer')

  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    subtitle: { fontSize: 11, color: '#666', marginBottom: 16 },
    section: { marginBottom: 16 },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 8, borderBottom: '1pt solid #ccc', paddingBottom: 4 },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    kpiCard: { border: '1pt solid #e0e0e0', padding: 8, borderRadius: 4, width: '45%' },
    kpiLabel: { fontSize: 9, color: '#666', marginBottom: 2 },
    kpiValue: { fontSize: 14, fontWeight: 'bold' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', padding: '4 6', borderBottom: '1pt solid #ccc' },
    tableRow: { flexDirection: 'row', padding: '4 6', borderBottom: '0.5pt solid #eee' },
    tableCell: { flex: 1, fontSize: 9 },
    footer: { position: 'absolute', bottom: 20, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
  })

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.title}>{restaurantName}</Text>
          <Text style={styles.subtitle}>{title} · {period} · Gerado em {new Date().toLocaleDateString('pt-BR')}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indicadores</Text>
          <View style={styles.kpiGrid}>
            {kpis.map((k, i) => (
              <View key={i} style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{k.label}</Text>
                <Text style={styles.kpiValue}>{k.value}</Text>
              </View>
            ))}
          </View>
        </View>
        {tableRows.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados</Text>
            <View style={styles.tableHeader}>
              {tableHeaders.map((h, i) => <Text key={i} style={styles.tableCell}>{h}</Text>)}
            </View>
            {tableRows.slice(0, 40).map((row, ri) => (
              <View key={ri} style={styles.tableRow}>
                {row.map((cell, ci) => <Text key={ci} style={styles.tableCell}>{cell}</Text>)}
              </View>
            ))}
          </View>
        )}
        <Text style={styles.footer}>THE FINANCE · Relatório gerado automaticamente</Text>
      </Page>
    </Document>
  )

  const blob = await pdf(doc).toBlob()
  triggerDownload(blob, `${title}.pdf`)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
