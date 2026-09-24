import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { unitDcApi, type UnitDc } from '../api/unitDc'
import { useApiData } from '../hooks/useApiData'
import { BackButton, InfoRow, DocStat, StatsStrip, StatDivider, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

export default function UnitDcDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: doc, loading, reload } = useApiData(
    () => id ? unitDcApi.getById(id) : Promise.resolve(null as UnitDc | null),
    [id]
  )
  const [busy, setBusy] = useState(false)
  const { dialog, showError, showConfirm } = useAlertDialog()

  const doConfirmDc = async () => {
    if (!doc) return
    setBusy(true)
    try { await unitDcApi.confirm(doc.id); reload() }
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
            <div className="page-title" style={{ marginBottom: 2 }}>{doc.dcNumber}</div>
            <span className={`badge ${statusBadge(doc.status)}`}>{doc.status}</span>
          </div>
        </div>
        {doc.status === 'DRAFT' && (
          <button className="btn btn-primary" disabled={busy}
            onClick={() => showConfirm('Confirm Unit DC', 'Garments will be marked as sent to stitching unit.', doConfirmDc)}>
            {busy ? 'Confirming…' : 'Confirm DC'}
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Document Summary</h2>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 40 }}>
          <InfoRow label="DC Number"      value={doc.dcNumber} />
          <InfoRow label="Cutting #"      value={doc.cuttingNumber} />
          <InfoRow label="Stitching Unit" value={doc.stitchingUnitName} />
          <InfoRow label="Delivery Date"  value={doc.deliveryDate} />
          <InfoRow label="Status"         value={doc.status} />
          {doc.sentToPersonName && <InfoRow label="Received By" value={doc.sentToPersonName} />}
        </div>
        <StatsStrip>
          <DocStat label="Lines"        value={doc.items.length.toString()} />
          <StatDivider />
          <DocStat label="Total Pieces" value={totalQty.toLocaleString()} />
        </StatsStrip>
      </div>

      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Items</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Style</th>
              <th>Gender</th>
              <th>Standard</th>
              <th style={{ textAlign: 'right' }}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map(it => (
              <tr key={it.id}>
                <td>{it.styleName}</td>
                <td>{it.gender}</td>
                <td>{it.standard}</td>
                <td style={{ textAlign: 'right', fontWeight: 800 }}>{it.quantity.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
