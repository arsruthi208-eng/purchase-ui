import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardApi, type ProductionReport, type DepartmentStatus, type ProductionReportOrder } from '../api/dashboard'
import { PRODUCTION_STAGES, STAGE_LABELS } from '../api/schoolOrders'

const PAGE_SIZE = 100
const DEPTS = ['cutting', 'unit', 'kaja', 'ironing', 'packing', 'dispatch'] as const
const DEPT_LABEL: Record<string, string> = {
  cutting: 'Cutting',
  unit: 'Unit',
  kaja: 'Kaja',
  ironing: 'Ironing',
  packing: 'Packing',
  dispatch: 'Dispatch',
}

const ALL_STAGES: { code: string; label: string }[] = [
  { code: 'PENDING', label: STAGE_LABELS.PENDING },
  ...PRODUCTION_STAGES.map(code => ({ code, label: STAGE_LABELS[code] })),
]

type FlatRow = {
  key: string
  order: ProductionReportOrder
  itemId: string
  styleId: string
  styleName: string
  gender: string
  standard: string
  orderedQuantity: number
  lineStage: string
  departments: Record<string, DepartmentStatus>
}

function deptOf(lineDepts: DepartmentStatus[], code: string): DepartmentStatus {
  return lineDepts.find(d => d.code === code) ?? {
    code, label: DEPT_LABEL[code] ?? code, status: 'NOT_STARTED', statusLabel: 'Not started', quantity: 0, documentNumber: null,
  }
}

function lineStageFrom(depts: Record<string, DepartmentStatus>): string {
  const d = (code: string) => depts[code]?.status
  if (d('dispatch') === 'CONFIRMED') return 'DISPATCHED'
  if (d('packing') === 'CONFIRMED') return 'PACKED'
  if (d('ironing') === 'CONFIRMED') return 'IRONED'
  if (d('ironing') === 'DRAFT') return 'IRONING'
  if (d('kaja') === 'CONFIRMED') return 'STITCHED'
  if (d('unit') === 'CONFIRMED') return 'SENT_TO_UNIT'
  if (d('cutting') === 'CONFIRMED') return 'CUT'
  if (d('cutting') === 'DRAFT') return 'CUTTING'
  return 'PENDING'
}

function StatusCell({ dept }: { dept: DepartmentStatus }) {
  const done = dept.status === 'CONFIRMED'
  const draft = dept.status === 'DRAFT'
  const bg = done ? '#dcfce7' : draft ? '#fef9c3' : '#f1f5f9'
  const color = done ? '#166534' : draft ? '#854d0e' : '#94a3b8'
  const mark = done ? '●' : draft ? '◐' : '○'
  const title = [dept.statusLabel, dept.quantity > 0 ? `${dept.quantity} pcs` : null, dept.documentNumber]
    .filter(Boolean).join(' · ')
  return (
    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }} title={title}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 12, background: bg, color, fontWeight: 700, fontSize: 12,
      }}>
        <span style={{ fontSize: 9 }}>{mark}</span>
        {dept.quantity > 0 ? dept.quantity.toLocaleString() : '—'}
      </span>
    </td>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [report, setReport] = useState<ProductionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [orderId, setOrderId] = useState('')
  const [styleId, setStyleId] = useState('')
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    dashboardApi.productionReport()
      .then(setReport)
      .catch(() => setReport({ orders: [] }))
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo<FlatRow[]>(() => {
    if (!report) return []
    return report.orders.flatMap(order =>
      order.items.map(item => {
        const departments = Object.fromEntries(DEPTS.map(code => [code, deptOf(item.departments, code)]))
        return {
          key: item.itemId,
          order,
          itemId: item.itemId,
          styleId: item.styleId,
          styleName: item.styleName,
          gender: item.gender,
          standard: item.standard,
          orderedQuantity: item.orderedQuantity,
          departments,
          lineStage: lineStageFrom(departments),
        }
      })
    )
  }, [report])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(row => {
      if (orderId && row.order.orderId !== orderId) return false
      if (styleId && row.styleId !== styleId) return false
      if (stage && row.lineStage !== stage) return false
      if (!q) return true
      return (
        row.order.orderNumber.toLowerCase().includes(q) ||
        row.order.schoolName.toLowerCase().includes(q) ||
        row.styleName.toLowerCase().includes(q) ||
        row.standard.toLowerCase().includes(q)
      )
    })
  }, [rows, orderId, styleId, query, stage])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const orders = report?.orders ?? []
  const styleOptions = useMemo(() => {
    const source = orderId ? rows.filter(r => r.order.orderId === orderId) : rows
    const seen = new Map<string, string>()
    source.forEach(r => { if (!seen.has(r.styleId)) seen.set(r.styleId, r.styleName) })
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, orderId])

  const onOrderChange = (id: string) => { setOrderId(id); setStyleId(''); setPage(1) }
  const onStyleChange = (id: string) => { setStyleId(id); setPage(1) }
  const onQueryChange = (v: string) => { setQuery(v); setPage(1) }
  const onStageChange = (v: string) => { setStage(v); setPage(1) }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Live style status by department — filter by school order</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.3fr) minmax(200px, 1.2fr) minmax(180px, 1fr) minmax(140px, 0.9fr)', gap: 10, flex: 1, minWidth: 280 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>School order</label>
              <select value={orderId} onChange={e => onOrderChange(e.target.value)}>
                <option value="">All school orders ({orders.length})</option>
                {orders.map(o => (
                  <option key={o.orderId} value={o.orderId}>
                    {o.orderNumber} — {o.schoolName} ({o.itemCount} styles)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Style</label>
              <select value={styleId} onChange={e => onStyleChange(e.target.value)}>
                <option value="">All styles ({styleOptions.length})</option>
                {styleOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Order stage</label>
              <select value={stage} onChange={e => onStageChange(e.target.value)}>
                <option value="">All stages</option>
                {ALL_STAGES.map(st => (
                  <option key={st.code} value={st.code}>{st.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Search</label>
              <input
                placeholder="School, style, std…"
                value={query}
                onChange={e => onQueryChange(e.target.value)}
              />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 8, whiteSpace: 'nowrap' }}>
            {filtered.length.toLocaleString()} style lines
            {filtered.length > PAGE_SIZE && ` · page ${safePage}/${pageCount}`}
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading production report…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No style lines match the current filters.</div>
        ) : (
          <>
            <div style={{ maxHeight: 'calc(100vh - 260px)', overflow: 'auto' }}>
              <table style={{ minWidth: 1100 }}>
                <thead>
                  <tr>
                    {['Order', 'School', 'Style', 'Gender', 'Std', 'Qty', 'Cutting', 'Unit', 'Kaja', 'Ironing', 'Packing', 'Dispatch'].map(h => (
                      <th key={h} style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--off-white)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(row => (
                    <tr
                      key={row.key}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/school-orders/${row.order.orderId}`)}
                    >
                      <td style={{ fontWeight: 700, color: 'var(--navy)', whiteSpace: 'nowrap' }}>
                        {row.order.orderNumber}
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{STAGE_LABELS[row.lineStage] ?? row.lineStage}</div>
                      </td>
                      <td>{row.order.schoolName}</td>
                      <td style={{ fontWeight: 600 }}>{row.styleName}</td>
                      <td>
                        <span style={{
                          fontSize: 11, padding: '1px 7px', borderRadius: 10, fontWeight: 700,
                          background: row.gender === 'BOYS' ? '#dbeafe' : row.gender === 'GIRLS' ? '#fce7f3' : '#dcfce7',
                        }}>{row.gender}</span>
                      </td>
                      <td>{row.standard}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.orderedQuantity.toLocaleString()}</td>
                      {DEPTS.map(code => <StatusCell key={code} dept={row.departments[code]} />)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-secondary" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
                  <button className="btn btn-sm btn-secondary" disabled={safePage >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
