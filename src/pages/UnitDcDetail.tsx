import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { unitDcApi, type UnitDc } from '../api/unitDc'
import { printUnitDc } from '../utils/printDc'
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
  const [editing, setEditing] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [editSentTo, setEditSentTo] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editQtys, setEditQtys] = useState<Record<string, number>>({})
  const { dialog, showError, showConfirm } = useAlertDialog()

  useEffect(() => { if (doc) { setEditDate(doc.deliveryDate); setEditSentTo(doc.sentToPersonName ?? ''); setEditQtys(Object.fromEntries(doc.items.map(i => [i.id, i.quantity]))) } }, [doc])
  const cancelEdit = () => { setEditing(false); if (doc) { setEditDate(doc.deliveryDate); setEditSentTo(doc.sentToPersonName ?? ''); setEditQtys(Object.fromEntries(doc.items.map(i => [i.id, i.quantity]))) } }

  const doSaveEdit = async () => {
    if (!doc) return; setBusy(true)
    try {
      await unitDcApi.update(doc.id, { deliveryDate: editDate, sentToPersonName: editSentTo || undefined, notes: editNotes || undefined, items: doc.items.map(i => ({ id: i.id, quantity: editQtys[i.id] ?? i.quantity })) })
      setEditing(false); reload()
    } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Save Failed', e.message) }
    finally { setBusy(false) }
  }

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => printUnitDc(doc)}>Print DC</button>
          {doc.status === 'DRAFT' && !editing && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
          {editing && (<><button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={doSaveEdit}>{busy ? 'Saving…' : 'Save Changes'}</button></>)}
          {doc.status === 'DRAFT' && !editing && (
            <button className="btn btn-primary" disabled={busy}
              onClick={() => showConfirm('Confirm Unit DC', 'Garments will be marked as sent to stitching unit.', doConfirmDc)}>
              {busy ? 'Confirming…' : 'Confirm DC'}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Document Summary</h2>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 40 }}>
          <InfoRow label="DC Number"      value={doc.dcNumber} />
          <InfoRow label="Cutting #"      value={doc.cuttingNumber} />
          <InfoRow label="Stitching Unit" value={doc.stitchingUnitName} />
          {editing ? <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Delivery Date</div><input type="date" className="form-control" value={editDate} onChange={e => setEditDate(e.target.value)} /></div> : <InfoRow label="Delivery Date" value={doc.deliveryDate} />}
          <InfoRow label="Status"         value={doc.status} />
          {editing ? <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Received By</div><input type="text" className="form-control" placeholder="Person name" value={editSentTo} onChange={e => setEditSentTo(e.target.value)} /></div> : <InfoRow label="Received By" value={doc.sentToPersonName || '—'} />}
          {editing && <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Notes</div><input type="text" className="form-control" placeholder="Optional notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} /></div>}
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
                <td style={{ textAlign: 'right', fontWeight: 800 }}>
                  {editing ? <input type="number" min="0" value={editQtys[it.id] ?? it.quantity} onChange={e => setEditQtys(q => ({ ...q, [it.id]: Number(e.target.value) }))} style={{ width: 80, textAlign: 'right', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4 }} /> : it.quantity.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
