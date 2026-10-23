import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Printer, Download } from '../icons'
import {
  schoolOrdersApi,
  type SchoolOrderDetail as DetailType,
  type SchoolOrderItemResponse,
  type OrderItemProductionStatus,
  PRODUCTION_STAGES, STAGE_LABELS, ORDER_KIND_LABEL,
} from '../api/schoolOrders'
import { useApiData } from '../hooks/useApiData'
import { BackButton, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'
import { printSchoolOrder, downloadSchoolOrderAsImage } from '../utils/printSchoolOrder'

/* ────────────────────────────── helpers ── */
function sumQty(items: SchoolOrderItemResponse[]) {
  return items.reduce((s, i) => s + i.quantity, 0)
}

function groupBy<T, K extends string>(arr: T[], key: (item: T) => K): Record<K, T[]> {
  return arr.reduce<Record<K, T[]>>((acc, item) => {
    const k = key(item)
    acc[k] = acc[k] ?? []
    acc[k].push(item)
    return acc
  }, {} as Record<K, T[]>)
}

/* ──────────────────────────── stat card ── */
function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? 'var(--navy)' : 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '18px 22px',
      flex: 1,
      minWidth: 120,
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent ? '#fff' : 'var(--navy)', lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div style={{ fontSize: 12, color: accent ? 'rgba(255,255,255,0.72)' : 'var(--text-muted)', marginTop: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  )
}

/* ──────────────────────── info label-value ── */
function LabelValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-main)' }}>{value}</div>
    </div>
  )
}

/* ─────────────── stage tracker (connected dots) ── */
function StageTracker({ item }: { item: OrderItemProductionStatus }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, flex: 1, overflowX: 'auto' }}>
      {PRODUCTION_STAGES.map((stage, i) => {
        const done    = item.doneStages.includes(stage)
        const current = item.stage === stage
        const isLast  = i === PRODUCTION_STAGES.length - 1
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'flex-start', flex: isLast ? 'none' : 1, minWidth: 0 }}>
            {/* dot + label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <div style={{
                width: current ? 16 : 10, height: current ? 16 : 10,
                borderRadius: '50%',
                background: done ? 'var(--navy)' : current ? '#f59e0b' : 'var(--border)',
                border: current ? '2.5px solid #d97706' : done ? 'none' : '1.5px solid #cbd5e1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: current ? '0 0 0 3px rgba(245,158,11,0.2)' : 'none',
              }}>
                {done && <span style={{ fontSize: 8, color: '#fff', fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
              <div style={{
                fontSize: 10, whiteSpace: 'nowrap',
                color: current ? '#92400e' : done ? 'var(--navy)' : 'var(--text-muted)',
                fontWeight: current || done ? 700 : 400,
              }}>
                {current && (
                  <span style={{
                    background: '#fef3c7', color: '#92400e', borderRadius: 4,
                    padding: '1px 5px', fontSize: 10, fontWeight: 700,
                  }}>
                    {STAGE_LABELS[stage]}
                  </span>
                )}
                {!current && STAGE_LABELS[stage]}
              </div>
            </div>
            {/* connector line */}
            {!isLast && (
              <div style={{
                flex: 1, height: 2,
                background: done ? 'var(--navy)' : 'var(--border)',
                marginTop: 4, minWidth: 12, maxWidth: 60,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

const genderColor: Record<string, { bg: string; color: string }> = {
  BOYS:   { bg: '#dbeafe', color: '#1e40af' },
  GIRLS:  { bg: '#fce7f3', color: '#9d174d' },
  UNISEX: { bg: '#dcfce7', color: '#166534' },
}

/* ══════════════════════════════════ page ══ */
export default function SchoolOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, loading, reload } = useApiData(
    () => id ? schoolOrdersApi.getById(id) : Promise.resolve(null as DetailType | null),
    [id]
  )
  const { data: productionStatus } = useApiData(
    () => id ? schoolOrdersApi.getProductionStatus(id) : Promise.resolve([] as OrderItemProductionStatus[]),
    [id]
  )
  const [busy, setBusy]       = useState(false)
  const [printing, setPrinting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const { dialog, showError, showConfirm } = useAlertDialog()

  const doConfirmOrder = async () => {
    if (!order) return
    setBusy(true)
    try { await schoolOrdersApi.confirm(order.id); reload() }
    catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) }
    finally { setBusy(false) }
  }

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (!order)  return <div className="page"><div className="empty-state">Order not found</div></div>

  const totalQty   = sumQty(order.items)
  const byStyle    = groupBy(order.items, i => i.styleName)
  const styleNames = Object.keys(byStyle).sort()
  const kind       = order.orderKind || 'SCHOOL_STD'

  const totalItems      = productionStatus?.length ?? 0
  const dispatchedCount = productionStatus?.filter(i => i.doneStages.includes('DISPATCHED')).length ?? 0
  const pctDone         = totalItems > 0 ? Math.round((dispatchedCount / totalItems) * 100) : 0

  const handlePrint = async () => {
    setPrinting(true)
    try { await printSchoolOrder(order) }
    catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Print Failed', e.message) }
    finally { setPrinting(false) }
  }

  return (
    <div className="page">
      {dialog}

      {/* ── Nav + actions ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <BackButton onClick={() => navigate(-1)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handlePrint} disabled={printing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={15} weight="fill" />
            {printing ? 'Preparing…' : 'Print Order'}
          </button>
          <button className="btn btn-secondary" disabled={downloading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={async () => { setDownloading(true); try { await downloadSchoolOrderAsImage(order) } finally { setDownloading(false) } }}>
            <Download size={15} />
            {downloading ? 'Preparing…' : 'Download Image'}
          </button>
          {order.status === 'DRAFT' && (
            <button className="btn btn-primary" disabled={busy}
              onClick={() => showConfirm(
                'Confirm Sales Order',
                `Confirm order ${order.orderNumber} for ${order.schoolName}?`,
                doConfirmOrder,
                'Confirm Order',
                <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>
                  <div><strong>Academic Year:</strong> {order.academicYear || '—'}</div>
                  <div><strong>Total Quantity:</strong> {totalQty.toLocaleString()} pcs across {order.items.length} line{order.items.length !== 1 ? 's' : ''}</div>
                </div>
              )}>
              {busy ? 'Confirming…' : 'Confirm Order'}
            </button>
          )}
        </div>
      </div>

      {/* ── Hero card ── */}
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        {/* top strip with navy accent */}
        <div style={{ height: 5, background: 'var(--navy)' }} />
        <div style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--navy)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {order.orderNumber}
              </div>
            </div>
            <span className={`badge ${statusBadge(order.status)}`} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20 }}>
              {order.status === 'CONFIRMED' ? '● Pending Production' : order.status}
            </span>
          </div>

          {/* order info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20 }}>
            <LabelValue label="School" value={order.schoolName} />
            {order.subject && <LabelValue label="Subject" value={order.subject} />}
            <LabelValue label="Academic Year" value={order.academicYear ?? '—'} />
            <LabelValue label="Order Date"    value={order.orderDate} />
            <LabelValue label="Type"          value={ORDER_KIND_LABEL[kind]} />
            {order.notes && <LabelValue label="Notes" value={order.notes} />}
          </div>
        </div>
      </div>

      {/* ── 4 stat boxes ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Total Pieces"         value={totalQty}            accent />
        <StatCard label="Order Lines"          value={order.items.length} />
        <StatCard label="Styles"               value={styleNames.length}  />
        <StatCard label="Production Completed" value={`${pctDone}%`}      />
      </div>

      {/* ── Production Progress ── */}
      {productionStatus && productionStatus.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h2>Production Progress</h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live tracking per item</span>
          </div>
          <div>
            {productionStatus.map((item, idx) => {
              const gc = genderColor[item.gender] ?? { bg: '#f1f5f9', color: '#374151' }
              const stageLabel = item.stageLabel
              const isDone = item.stage === 'DISPATCHED'
              return (
                <div key={item.itemId} style={{
                  padding: '16px 24px',
                  borderBottom: idx < productionStatus.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {/* item header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)' }}>{item.styleName}</span>
                      <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, background: gc.bg, color: gc.color, fontWeight: 600 }}>
                        {item.gender}
                      </span>
                      {item.standard && (
                        <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, background: '#f1f5f9', color: '#374151', fontWeight: 500 }}>
                          {item.standard}
                        </span>
                      )}
                      {(item as any).size && (
                        <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, background: '#f1f5f9', color: '#374151', fontWeight: 500 }}>
                          {(item as any).size}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                        {item.quantity.toLocaleString()} pcs
                      </span>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                      background: isDone ? '#dcfce7' : item.stage === 'PENDING' ? '#fef3c7' : '#f0f9ff',
                      color: isDone ? '#166534' : item.stage === 'PENDING' ? '#92400e' : '#075985',
                      border: `1px solid ${isDone ? '#bbf7d0' : item.stage === 'PENDING' ? '#fde68a' : '#bae6fd'}`,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {isDone ? '✓' : '○'} {stageLabel}
                    </span>
                  </div>
                  {/* stage timeline */}
                  <StageTracker item={item} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Order Line Items ── */}
      <div className="card">
        <div className="card-header">
          <h2>Order Line Items</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{order.items.length} line{order.items.length !== 1 ? 's' : ''}</span>
        </div>
        <table>
          <thead>
            {kind === 'SCHOOL_SIZE' ? (
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Style</th><th>Gender</th><th>Standard</th><th>Size</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
              </tr>
            ) : kind === 'CORPORATE' ? (
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Style</th><th>Gender</th><th>Year</th>
                <th style={{ textAlign: 'right' }}>Students</th>
                <th style={{ textAlign: 'right' }}>Sets</th>
              </tr>
            ) : (
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Style</th><th>Gender</th><th>STD</th>
                <th style={{ textAlign: 'right' }}>Total Students</th>
                <th style={{ textAlign: 'right' }}>No. of Students</th>
                <th style={{ textAlign: 'right' }}>QTY</th>
              </tr>
            )}
          </thead>
          <tbody>
            {order.items.map((item, idx) => {
              const gc = genderColor[item.gender] ?? { bg: '#f1f5f9', color: '#374151' }
              return (
                <tr key={item.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{item.styleName}</td>
                  <td>
                    <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, background: gc.bg, color: gc.color, fontWeight: 600 }}>
                      {kind === 'CORPORATE'
                        ? (item.gender === 'BOYS' ? "MEN'S" : item.gender === 'GIRLS' ? 'LADIES' : item.gender)
                        : item.gender}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{item.standard}</td>
                  {kind === 'SCHOOL_SIZE' && (
                    <>
                      <td style={{ fontWeight: 600 }}>{item.size ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>{item.quantity.toLocaleString()}</td>
                    </>
                  )}
                  {kind === 'SCHOOL_STD' && (
                    <>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{item.totalStudentCount ?? '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{item.studentCount ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>{item.quantity.toLocaleString()}</td>
                    </>
                  )}
                  {kind === 'CORPORATE' && (
                    <>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{item.studentCount ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>{item.setCount ?? item.quantity}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)' }}>
              <td colSpan={kind === 'SCHOOL_STD' ? 6 : 5}
                style={{ textAlign: 'right', paddingRight: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                Total pieces
              </td>
              <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 16, color: 'var(--navy)' }}>
                {totalQty.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  )
}
