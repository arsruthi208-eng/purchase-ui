import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { packingApi, type PackingEntry } from '../api/packing'
import { useApiData } from '../hooks/useApiData'
import { BackButton, InfoRow, DocStat, StatsStrip, StatDivider, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

export default function PackingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: doc, loading, reload } = useApiData(
    () => id ? packingApi.getById(id) : Promise.resolve(null as PackingEntry | null),
    [id]
  )
  const [busy, setBusy] = useState(false)
  const { dialog, showError, showConfirm } = useAlertDialog()

  const doConfirmEntry = async () => {
    if (!doc) return
    setBusy(true)
    try { await packingApi.confirm(doc.id); reload() }
    catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } finally { setBusy(false) }
  }

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (!doc) return <div className="page"><div className="empty-state">Not found</div></div>

  const totalQty = doc.items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton onClick={() => navigate(-1)} />
          <div>
            <div className="page-title" style={{ marginBottom: 2 }}>{doc.packingNumber}</div>
            <span className={`badge ${statusBadge(doc.status)}`}>{doc.status}</span>
          </div>
        </div>
        {doc.status === 'DRAFT' && (
          <button className="btn btn-primary" disabled={busy}
            onClick={() => showConfirm('Confirm Packing', 'Mark this packing entry as confirmed.', doConfirmEntry)}>
            {busy ? 'Confirming…' : 'Confirm Packing'}
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Document Summary</h2>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 40 }}>
          <InfoRow label="Packing Number" value={doc.packingNumber} />
          <InfoRow label="Packing Date"   value={doc.packingDate} />
          <InfoRow label="School"         value={doc.schoolName} />
          <InfoRow label="Status"         value={doc.status} />
        </div>
        <StatsStrip>
          <DocStat label="Lines"               value={doc.items.length.toString()} />
          <StatDivider />
          <DocStat label="Total Pieces Packed" value={totalQty.toLocaleString()} />
        </StatsStrip>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Packing Lines</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{doc.items.length} line{doc.items.length !== 1 ? 's' : ''}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Style</th><th>Accessory</th><th>Gender</th><th>Standard</th>
              <th style={{ textAlign: 'right' }}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                <td style={{ fontWeight: 600 }}>{item.styleName}</td>
                <td>{item.accessoryName}</td>
                <td><span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: 'var(--off-white)', border: '1px solid var(--border)' }}>{item.gender}</span></td>
                <td>{item.standard}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--navy)' }}>{item.quantity.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
              <td colSpan={5} style={{ textAlign: 'right', paddingRight: 12, fontSize: 13 }}>Total Pieces</td>
              <td style={{ textAlign: 'right', color: 'var(--navy)', fontSize: 15 }}>{totalQty.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
