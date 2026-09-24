import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Printer } from '../icons'
import { schoolOrdersApi, type SchoolOrderDetail as DetailType, type SchoolOrderItemResponse, type OrderItemProductionStatus, PRODUCTION_STAGES, STAGE_LABELS, ORDER_KIND_LABEL } from '../api/schoolOrders'
import { useApiData } from '../hooks/useApiData'
import { BackButton, InfoRow, DocStat, StatsStrip, StatDivider, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'
import { printSchoolOrder } from '../utils/printSchoolOrder'

/* ─────────────────────────────────────────────────────── helpers ── */

function groupBy<T, K extends string>(arr: T[], key: (item: T) => K): Record<K, T[]> {
  return arr.reduce<Record<K, T[]>>((acc, item) => {
    const k = key(item)
    acc[k] = acc[k] ?? []
    acc[k].push(item)
    return acc
  }, {} as Record<K, T[]>)
}

function sumQty(items: SchoolOrderItemResponse[]) {
  return items.reduce((s, i) => s + i.quantity, 0)
}

/* ─────────────────────────────────────────────── mini stat chip ── */
function Chip({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{
      padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)',
      background: accent ? 'var(--navy)' : 'var(--off-white)',
      textAlign: 'center', minWidth: 90,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ? '#fff' : 'var(--navy)', lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div style={{ fontSize: 11, color: accent ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
    </div>
  )
}

const genderColor: Record<string, string> = {
  BOYS:   '#dbeafe',
  GIRLS:  '#fce7f3',
  UNISEX: '#dcfce7',
}

/* ═══════════════════════════════════════════════════════ page ══ */

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
  const [busy, setBusy] = useState(false)
  const [printing, setPrinting] = useState(false)
  const { dialog, showError, showConfirm } = useAlertDialog()

  const doConfirmOrder = async () => {
    if (!order) return
    setBusy(true)
    try { await schoolOrdersApi.confirm(order.id); reload() }
    catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } finally { setBusy(false) }
  }

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (!order)  return <div className="page"><div className="empty-state">Order not found</div></div>

  const totalQty   = sumQty(order.items)
  const byStyle    = groupBy(order.items, i => i.styleName)
  const styleNames = Object.keys(byStyle).sort()
  const kind = order.orderKind || 'SCHOOL_STD'

  const handlePrint = async () => {
    setPrinting(true)
    try { await printSchoolOrder(order) }
    catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Print Failed', e.message) }
    finally { setPrinting(false) }
  }

  return (
    <div className="page">
      {dialog}

      {/* ── Header ── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton onClick={() => navigate(-1)} />
          <div>
            <div className="page-title" style={{ marginBottom: 4 }}>{order.orderNumber}</div>
            <span className={`badge ${statusBadge(order.status)}`}>{order.status}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={handlePrint}
            disabled={printing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} weight="fill" />
            {printing ? 'Preparing…' : 'Print / PDF'}
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

      {/* ── Quick Stats ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <Chip label="Total Pieces" value={totalQty}            accent />
        <Chip label="Line Items"   value={order.items.length} />
        <Chip label="Styles"       value={styleNames.length} />
      </div>

      {/* ── Summary Card ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2>Order Details</h2>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 40 }}>
          <InfoRow label="Order Number"   value={order.orderNumber} />
          <InfoRow label="Order Date"     value={order.orderDate} />
          <InfoRow label="School"         value={order.schoolName} />
          <InfoRow label="Type"           value={ORDER_KIND_LABEL[kind]} />
          <InfoRow label="Academic Year"  value={order.academicYear ?? '—'} />
          {order.subject && <InfoRow label="Subject" value={order.subject} />}
          {order.notes && (
            <div style={{ gridColumn: '1 / -1' }}>
              <InfoRow label="Notes" value={order.notes} />
            </div>
          )}
        </div>

        <StatsStrip>
          <DocStat label="Total Pieces" value={totalQty.toLocaleString()} />
          <StatDivider />
          <DocStat label="Line Items"   value={order.items.length.toString()} />
          <StatDivider />
          <DocStat label="Styles"       value={styleNames.length.toString()} />
        </StatsStrip>
      </div>

      {/* ── Production Status ── */}
      {productionStatus && productionStatus.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2>Production Status</h2>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Live tracking per item</span>
          </div>
          <div style={{ padding: '4px 0' }}>
            {productionStatus.map(item => (
              <div key={item.itemId} style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.styleName}</span>
                    <span style={{
                      marginLeft: 8, fontSize: 12, padding: '2px 8px', borderRadius: 20,
                      background: item.gender === 'BOYS' ? '#dbeafe' : item.gender === 'GIRLS' ? '#fce7f3' : '#dcfce7',
                    }}>{item.gender}</span>
                    <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--text-muted)' }}>{item.standard}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.quantity.toLocaleString()} pcs</span>
                    <span style={{
                      marginLeft: 10, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                      background: item.stage === 'DISPATCHED' ? '#dcfce7' : item.stage === 'PENDING' ? '#f1f5f9' : '#fef9c3',
                      color: item.stage === 'DISPATCHED' ? '#166534' : item.stage === 'PENDING' ? '#64748b' : '#854d0e',
                    }}>
                      {item.stageLabel}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PRODUCTION_STAGES.map(stage => {
                    const done = item.doneStages.includes(stage)
                    const current = item.stage === stage
                    return (
                      <div key={stage} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: done ? 'var(--navy)' : 'var(--off-white)',
                        color: done ? '#fff' : 'var(--text-muted)',
                        border: current ? '2px solid var(--navy)' : '1px solid var(--border)',
                      }}>
                        {done && <span style={{ fontSize: 10 }}>✓</span>}
                        {STAGE_LABELS[stage]}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Full Line Items ── */}
      <div className="card">
        <div className="card-header">
          <h2>All Order Lines</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{order.items.length} line{order.items.length !== 1 ? 's' : ''}</span>
        </div>
        <table>
          <thead>
            {kind === 'SCHOOL_SIZE' ? (
              <tr>
                <th>#</th><th>Style</th><th>Gender</th><th>Standard</th><th>Size</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
              </tr>
            ) : kind === 'CORPORATE' ? (
              <tr>
                <th>#</th><th>Style</th><th>Gender</th><th>Year</th>
                <th style={{ textAlign: 'right' }}>Students</th>
                <th style={{ textAlign: 'right' }}>Sets</th>
              </tr>
            ) : (
              <tr>
                <th>#</th><th>Style</th><th>Gender</th><th>STD</th>
                <th style={{ textAlign: 'right' }}>Total students</th>
                <th style={{ textAlign: 'right' }}>No. of students</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
              </tr>
            )}
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                <td style={{ fontWeight: 600 }}>{item.styleName}</td>
                <td>
                  <span style={{
                    fontSize: 12, padding: '2px 10px', borderRadius: 20,
                    background: genderColor[item.gender] ?? '#f1f5f9',
                  }}>
                    {kind === 'CORPORATE' ? (item.gender === 'BOYS' ? "MEN'S" : item.gender === 'GIRLS' ? 'LADIES' : item.gender) : item.gender}
                  </span>
                </td>
                <td>{item.standard}</td>
                {kind === 'SCHOOL_SIZE' && (
                  <>
                    <td>{item.size ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>{item.quantity.toLocaleString()}</td>
                  </>
                )}
                {kind === 'SCHOOL_STD' && (
                  <>
                    <td style={{ textAlign: 'right' }}>{item.totalStudentCount ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{item.studentCount ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>{item.quantity.toLocaleString()}</td>
                  </>
                )}
                {kind === 'CORPORATE' && (
                  <>
                    <td style={{ textAlign: 'right' }}>{item.studentCount ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>{item.setCount ?? item.quantity}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
              <td colSpan={kind === 'SCHOOL_STD' ? 6 : 5} style={{ textAlign: 'right', paddingRight: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                Total
              </td>
              <td style={{ textAlign: 'right', color: 'var(--navy)', fontSize: 16 }}>{totalQty.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  )
}
