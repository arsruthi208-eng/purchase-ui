import * as XLSX from 'xlsx-js-style'
import type { PoDetail } from '../api/purchaseOrders'
import { shortUnit } from './units'

const NAVY = '0F1F4D'
const BAND = 'E8EDF7'
const ZEBRA = 'F6F8FC'

type Style = Record<string, unknown>
const thin = { style: 'thin', color: { rgb: 'B8C2D6' } }
const border = { top: thin, bottom: thin, left: thin, right: thin }
const f = (extra: object = {}) => ({ name: 'Calibri', sz: 10, ...extra })
const fill = (rgb: string) => ({ patternType: 'solid', fgColor: { rgb } })

const S = {
  company: { font: f({ sz: 16, bold: true, color: { rgb: 'FFFFFF' } }), fill: fill(NAVY), alignment: { horizontal: 'center', vertical: 'center' } } as Style,
  companySub: { font: f({ sz: 10, color: { rgb: 'FFFFFF' } }), fill: fill(NAVY), alignment: { horizontal: 'center', vertical: 'center' } } as Style,
  title: { font: f({ sz: 13, bold: true, color: { rgb: NAVY } }), fill: fill(BAND), border, alignment: { horizontal: 'center', vertical: 'center' } } as Style,
  meta: { font: f({ italic: true, color: { rgb: '475569' } }), alignment: { horizontal: 'center' } } as Style,
  head: { font: f({ bold: true, color: { rgb: 'FFFFFF' } }), fill: fill(NAVY), border, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } } as Style,
  foot: { font: f({ bold: true, color: { rgb: 'FFFFFF' } }), fill: fill(NAVY), border, alignment: { vertical: 'center' } } as Style,
}

const cell = (z: boolean, extra: Style = {}, align: 'left' | 'center' | 'right' = 'left'): Style => ({
  font: f(), border, alignment: { horizontal: align, vertical: 'center', wrapText: true },
  ...(z ? { fill: fill(ZEBRA) } : {}), ...extra,
})

const statusStyle = (st?: string): Style => {
  const map: Record<string, [string, string]> = {
    DRAFT: ['F1F5F9', '475569'],
    OPEN: ['DBEAFE', '1D4ED8'],
    PARTIALLY_RECEIVED: ['FEF3C7', 'B45309'],
    RECEIVED: ['DCFCE7', '15803D'],
    CLOSED: ['DCFCE7', '15803D'],
  }
  const [bg, fg] = map[st ?? ''] ?? ['FFFFFF', '475569']
  return { font: f({ bold: true, color: { rgb: fg } }), fill: fill(bg), border, alignment: { horizontal: 'center', vertical: 'center' } }
}

type Cell = { v: string | number; t?: string; s?: Style }
const c = (v: string | number, s: Style): Cell => ({ v, t: typeof v === 'number' ? 'n' : 's', s })

function dmy(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}-${m}-${y}` : iso
}

function todayIso(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function formatQty(qty: number, uom: string): string {
  const unit = shortUnit(uom)
  const text = Number.isInteger(qty) ? qty.toLocaleString('en-IN') : qty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return unit ? `${text} ${unit}` : text
}

function fabricLabel(name?: string, colour?: string): string {
  const base = name?.trim() || '—'
  const col = colour?.trim()
  return col ? `${base} (${col})` : base
}

/** Professionally formatted single-sheet summary of all fabric PO lines. */
export function exportFabricPoSummary(details: PoDetail[]) {
  const heads = ['S.No', 'School Name', 'Purchase Party', 'Date', 'Item', 'Fabric', 'Quantity', 'Status']
  const colCount = heads.length

  const pad = (cell0: Cell, style: Style): Cell[] => [cell0, ...Array.from({ length: colCount - 1 }, () => c('', style))]
  const rows: Cell[][] = [
    pad(c('Apple Uniformm', S.company), S.company),
    pad(c('FABRIC PURCHASE ORDER SUMMARY', S.title), S.title),
    pad(c(`All fabric POs · Generated ${dmy(todayIso())}`, S.meta), S.meta),
    [],
  ]
  const merges: XLSX.Range[] = [0, 1, 2].map(r => ({ s: { r, c: 0 }, e: { r, c: colCount - 1 } }))
  const headerRow = rows.length
  rows.push(heads.map(h => c(h, S.head)))

  // Newest POs first (by poDate desc, then poNumber)
  const sorted = [...details].sort((a, b) => {
    const d = b.poDate.localeCompare(a.poDate)
    return d !== 0 ? d : b.poNumber.localeCompare(a.poNumber)
  })

  let sn = 0
  for (const po of sorted) {
    const school = (po.schoolName
      || po.schoolOrders?.map(o => o.schoolName).filter(Boolean).join(', ')
      || '—')
    const party = po.purchasePartyName || '—'
    const date = dmy(po.poDate)
    const fabricItems = (po.items ?? []).filter(it => it.fabricId || it.fabricName)
    if (fabricItems.length === 0) continue

    for (const item of fabricItems) {
      const z = sn % 2 === 1
      sn += 1
      rows.push([
        c(sn, cell(z, {}, 'center')),
        c(school, cell(z)),
        c(party, cell(z, { font: f({ bold: true, color: { rgb: NAVY } }) })),
        c(date, cell(z, {}, 'center')),
        c(item.fabricType?.trim() || '—', cell(z)),
        c(fabricLabel(item.fabricName, item.colourName), cell(z)),
        c(formatQty(item.orderedQuantity, item.unitOfMeasure), cell(z, {}, 'right')),
        c(po.status, statusStyle(po.status)),
      ])
    }
  }

  rows.push([
    c('', S.foot),
    c(`TOTAL (${sn} line${sn === 1 ? '' : 's'} across ${sorted.length} PO${sorted.length === 1 ? '' : 's'})`, S.foot),
    c('', S.foot), c('', S.foot), c('', S.foot), c('', S.foot), c('', S.foot), c('', S.foot),
  ])

  const ws = XLSX.utils.aoa_to_sheet(rows as unknown as XLSX.CellObject[][])
  ws['!cols'] = [7, 28, 28, 12, 18, 32, 14, 16].map(wch => ({ wch }))
  ws['!merges'] = merges
  ws['!rows'] = rows.map((_, i) => (i === 0 ? { hpt: 28 } : i === 1 ? { hpt: 24 } : i === headerRow ? { hpt: 30 } : {}))
  ws['!views'] = [{ state: 'frozen', ySplit: headerRow + 1, showGridLines: false }] as never
  ;(ws as Record<string, unknown>)['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 0 }
  ;(ws as Record<string, unknown>)['!sheetPr'] = { pageSetUpPr: { fitToPage: true } }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Fabric PO Summary')
  XLSX.writeFile(wb, `Fabric_PO_Summary_${todayIso()}.xlsx`)
}
