import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { cuttingApi, type CuttingOrder } from '../api/cutting'
import { useApiData } from '../hooks/useApiData'
import { BackButton, InfoRow, DocStat, StatsStrip, StatDivider, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

export default function CuttingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: doc, loading, reload } = useApiData(
    () => id ? cuttingApi.getById(id) : Promise.resolve(null as CuttingOrder | null),
    [id]
  )
  const [busy, setBusy] = useState(false)
  const { dialog, showError, showConfirm } = useAlertDialog()

  const doConfirmOrder = async () => {
    if (!doc) return
    setBusy(true)
    try { await cuttingApi.confirm(doc.id); reload() }
    catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } finally { setBusy(false) }
  }

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (!doc) return <div className="page"><div className="empty-state">Not found</div></div>

  const totalQty    = doc.items.reduce((s, i) => s + i.quantity, 0)
  const totalFabric = doc.items.reduce((s, i) => s + i.fabricConsumed, 0)

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton onClick={() => navigate(-1)} />
          <div>
            <div className="page-title" style={{ marginBottom: 2 }}>{doc.cuttingNumber}</div>
            <span className={`badge ${statusBadge(doc.status)}`}>{doc.status}</span>
          </div>
        </div>
        {doc.status === 'DRAFT' && (
          <button className="btn btn-primary" disabled={busy}
            onClick={() => showConfirm('Confirm Cutting Order', 'Fabric stock will be deducted. This cannot be undone.', doConfirmOrder)}>
            {busy ? 'Confirming…' : 'Confirm Cutting'}
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Document Summary</h2>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 40 }}>
          <InfoRow label="Cutting Number" value={doc.cuttingNumber} />
          <InfoRow label="Cutting Date"   value={doc.cuttingDate} />
          <InfoRow label="School"         value={doc.schoolName} />
          <InfoRow label="Status"         value={doc.status} />
          {doc.sentToPersonName && <InfoRow label="Received By" value={doc.sentToPersonName} />}
        </div>
        <StatsStrip>
          <DocStat label="Lines"                 value={doc.items.length.toString()} />
          <StatDivider />
          <DocStat label="Total Pieces"          value={totalQty.toLocaleString()} />
          <StatDivider />
          <DocStat label="Total Fabric Consumed" value={`${totalFabric.toLocaleString()} m`} />
        </StatsStrip>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Cutting Lines</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{doc.items.length} line{doc.items.length !== 1 ? 's' : ''}</span>
        </div>

        {doc.items.map((item, idx) => {
          const rollTotal = item.rolls?.reduce((s, r) => s + Number(r.quantityMeters), 0) ?? 0
          return (
            <div key={item.id} style={{ borderTop: '1px solid var(--border)' }}>

              {/* ── Item header ── */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                alignItems: 'center',
                padding: '14px 20px',
                background: '#f8fafc',
                gap: 12,
              }}>
                {/* Style + fabric */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', background: 'var(--navy)',
                    color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{idx + 1}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{item.styleName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{item.fabricName}</div>
                  </div>
                </div>

                {/* Meta chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {item.colourName && (
                    <span style={{ fontSize: 11, padding: '2px 10px', background: '#e0e7ff', color: '#3730a3', borderRadius: 20, fontWeight: 600 }}>
                      {item.colourName}
                    </span>
                  )}
                  <span style={{ fontSize: 14, padding: '2px 10px', background: '#f1f5f9', color: '#374151', borderRadius: 20, fontWeight: 600 }}>
                    {item.gender}
                  </span>
                  <span style={{ fontSize: 14, padding: '2px 10px', background: '#f1f5f9', color: '#374151', borderRadius: 20, fontWeight: 600 }}>
                    Std: {item.standard}
                  </span>
                </div>

                {/* Qty */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Qty (pcs)</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>{item.quantity.toLocaleString()}</div>
                </div>

                {/* Fabric consumed + roll count */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>
                    {Number(item.fabricConsumed).toFixed(2)} m
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {item.rolls?.length ?? 0} roll{(item.rolls?.length ?? 0) !== 1 ? 's' : ''} used
                  </div>
                </div>
              </div>

              {/* ── Rolls table ── */}
              {item.rolls && item.rolls.length > 0 ? (
                <div style={{ padding: '0 20px 16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '33.33%' }} />
                      <col style={{ width: '33.33%' }} />
                      <col style={{ width: '33.33%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                        <th style={{ padding: '8px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Roll No</th>
                        <th style={{ padding: '8px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meters per Roll</th>
                        <th style={{ padding: '8px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.rolls.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 20px', fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>
                            {r.rollNumber}
                          </td>
                          <td style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, color: '#111' }}>
                            {Number(r.quantityMeters).toFixed(2)}
                            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>m</span>
                          </td>
                          <td style={{ padding: '10px 20px' }}>
                            <span style={{
                              fontSize: 12, padding: '3px 12px', borderRadius: 20, fontWeight: 800,
                              background: r.status === 'CONSUMED' ? '#f3f4f6' : '#dcfce7',
                              color:      r.status === 'CONSUMED' ? '#6b7280' : '#15803d',
                            }}>
                              {r.status === 'CONSUMED' ? 'Consumed' : 'Utilizing'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid var(--border)' }}>
                        <td style={{ padding: '9px 20px', fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</td>
                        <td style={{ padding: '9px 20px', fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>
                          {rollTotal.toFixed(2)}
                          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>m</span>
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '10px 20px', fontSize: 13, color: 'var(--text-muted)' }}>No rolls recorded.</div>
              )}
            </div>
          )
        })}

        {/* Grand total footer */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          padding: '10px 20px', background: '#f1f5f9',
          borderTop: '2px solid var(--border)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', gridColumn: '1 / 3' }}>Grand Total</div>
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>{totalQty.toLocaleString()} pcs</div>
          <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>{totalFabric.toFixed(2)} m</div>
        </div>
      </div>
    </div>
  )
}
