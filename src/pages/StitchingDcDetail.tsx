import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { stitchingDcApi, type StitchingDc } from '../api/stitchingDc'
import { useApiData } from '../hooks/useApiData'
import { BackButton, InfoRow, DocStat, StatsStrip, StatDivider, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

export default function StitchingDcDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: doc, loading, reload } = useApiData(
    () => id ? stitchingDcApi.getById(id) : Promise.resolve(null as StitchingDc | null),
    [id]
  )
  const [busy, setBusy] = useState(false)
  const { dialog, showError, showConfirm } = useAlertDialog()

  const doConfirmDc = async () => {
    if (!doc) return
    setBusy(true)
    try { await stitchingDcApi.confirm(doc.id); reload() }
    catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } finally { setBusy(false) }
  }

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (!doc) return <div className="page"><div className="empty-state">Not found</div></div>

  const totalQty  = doc.items.reduce((s, i) => s + i.quantity, 0)
  const totalKaja = doc.kajaConsumption.reduce((s, k) => s + k.quantity, 0)

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
            onClick={() => showConfirm('Confirm KajaButton DC', 'Accessories stock will be deducted. This cannot be undone.', doConfirmDc)}>
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
          <InfoRow label="Delivery Date"  value={doc.deliveryDate} />
          <InfoRow label="Stitching Unit" value={doc.stitchingUnitName} />
          <InfoRow label="Cutting Order"  value={doc.cuttingOrderNumber ?? '—'} />
          <InfoRow label="School"         value={doc.schoolName ?? '—'} />
          <InfoRow label="Status"         value={doc.status} />
          {doc.sentToPersonName && <InfoRow label="Received By" value={doc.sentToPersonName} />}
        </div>
        <StatsStrip>
          <DocStat label="Garment Lines" value={doc.items.length.toString()} />
          <StatDivider />
          <DocStat label="Total Pieces"  value={totalQty.toLocaleString()} />
          <StatDivider />
          <DocStat label="Kaja Lines"    value={doc.kajaConsumption.length.toString()} />
        </StatsStrip>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h2>Garment Lines</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{doc.items.length} line{doc.items.length !== 1 ? 's' : ''}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Style</th><th>Gender</th><th>Standard</th>
              <th style={{ textAlign: 'right' }}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                <td style={{ fontWeight: 600 }}>{item.styleName}</td>
                <td><span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: 'var(--off-white)', border: '1px solid var(--border)' }}>{item.gender}</span></td>
                <td>{item.standard}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--navy)' }}>{item.quantity.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
              <td colSpan={4} style={{ textAlign: 'right', paddingRight: 12, fontSize: 13 }}>Total Pieces</td>
              <td style={{ textAlign: 'right', color: 'var(--navy)', fontSize: 15 }}>{totalQty.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {doc.kajaConsumption.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Kaja (Hook &amp; Eye) Consumption</h2>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{doc.kajaConsumption.length} accessory</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Accessory</th><th>Unit of Measure</th>
                <th style={{ textAlign: 'right' }}>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {doc.kajaConsumption.map((k, idx) => (
                <tr key={k.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>{k.accessoryName}</td>
                  <td>{k.unitOfMeasure}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--navy)' }}>{k.quantity.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                <td colSpan={3} style={{ textAlign: 'right', paddingRight: 12, fontSize: 13 }}>Total Kaja</td>
                <td style={{ textAlign: 'right', color: 'var(--navy)', fontSize: 15 }}>{totalKaja.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
