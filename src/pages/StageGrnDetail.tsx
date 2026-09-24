import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { stageGrnApi, type StageGrn } from '../api/stageGrn'
import { useApiData } from '../hooks/useApiData'
import { BackButton, InfoRow, DocStat, StatsStrip, StatDivider, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

const SOURCE_LABELS: Record<string, string> = {
  UNIT_DC: 'Unit DC',
  KAJA_DC: 'KajaButton DC',
  CUTTING_DC: 'Cutting DC',
  IRONING_DC: 'Ironing DC',
  CHECKING_DC: 'Checking DC',
}

export default function StageGrnDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: doc, loading, reload } = useApiData(
    () => id ? stageGrnApi.getById(id) : Promise.resolve(null as StageGrn | null),
    [id]
  )
  const [busy, setBusy] = useState(false)
  const { dialog, showError, showConfirm } = useAlertDialog()

  const doConfirmGrn = async () => {
    if (!doc) return
    setBusy(true)
    try { await stageGrnApi.confirm(doc.id); reload() }
    catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } finally { setBusy(false) }
  }

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (!doc) return <div className="page"><div className="empty-state">Not found</div></div>

  const totalSent     = doc.items.reduce((s, i) => s + i.sentQty, 0)
  const totalReceived = doc.items.reduce((s, i) => s + i.receivedQty, 0)
  const totalRejected = doc.items.reduce((s, i) => s + i.rejectedQty, 0)

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton onClick={() => navigate(-1)} />
          <div>
            <div className="page-title" style={{ marginBottom: 2 }}>{doc.grnNumber}</div>
            <span className={`badge ${statusBadge(doc.status)}`}>{doc.status}</span>
          </div>
        </div>
        {doc.status === 'DRAFT' && (
          <button className="btn btn-primary" disabled={busy}
            onClick={() => showConfirm('Confirm Stage GRN', 'Record garment receipt from stitching unit. This cannot be undone.', doConfirmGrn)}>
            {busy ? 'Confirming…' : 'Confirm GRN'}
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Summary</h2>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 40 }}>
          <InfoRow label="GRN Number"   value={doc.grnNumber} />
          <InfoRow label="Received Date" value={doc.receivedDate} />
          <InfoRow label="Source Type"  value={doc.sourceLabel || SOURCE_LABELS[doc.sourceType] || doc.sourceType} />
          <InfoRow label="Source DC"    value={doc.sourceDcNumber || '—'} />
          <InfoRow label="School"       value={doc.schoolName ?? '—'} />
          <InfoRow label="Sales Order" value={doc.schoolOrderNumber ?? '—'} />
          <InfoRow label="Status"       value={doc.status} />
        </div>
        <StatsStrip>
          <DocStat label="Items"         value={doc.items.length.toString()} />
          <StatDivider />
          <DocStat label="Sent"          value={totalSent.toLocaleString()} />
          <StatDivider />
          <DocStat label="Received"      value={totalReceived.toLocaleString()} />
          <StatDivider />
          <DocStat label="Rejected"      value={totalRejected.toLocaleString()} />
        </StatsStrip>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Items</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Style</th>
              <th>Gender</th>
              <th>Standard</th>
              <th style={{ textAlign: 'right' }}>Sent</th>
              <th style={{ textAlign: 'right' }}>Received</th>
              <th style={{ textAlign: 'right' }}>Rejected</th>
              <th style={{ textAlign: 'right' }}>Pending</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, idx) => {
              const pending = item.sentQty - item.receivedQty - item.rejectedQty
              return (
                <tr key={item.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{item.styleName}</td>
                  <td>{item.gender}</td>
                  <td>{item.standard}</td>
                  <td style={{ textAlign: 'right' }}>{item.sentQty.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--navy)' }}>{item.receivedQty.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', color: item.rejectedQty > 0 ? '#dc2626' : 'var(--text-muted)' }}>{item.rejectedQty.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', color: pending > 0 ? '#d97706' : '#16a34a', fontWeight: 500 }}>{pending}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
              <td colSpan={4} style={{ textAlign: 'right', paddingRight: 12, fontSize: 13 }}>Total</td>
              <td style={{ textAlign: 'right' }}>{totalSent.toLocaleString()}</td>
              <td style={{ textAlign: 'right', color: 'var(--navy)' }}>{totalReceived.toLocaleString()}</td>
              <td style={{ textAlign: 'right', color: '#dc2626' }}>{totalRejected.toLocaleString()}</td>
              <td style={{ textAlign: 'right', color: '#d97706' }}>{(totalSent - totalReceived - totalRejected).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
