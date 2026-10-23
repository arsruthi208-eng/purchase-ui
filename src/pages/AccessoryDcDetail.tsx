import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Trash2 } from '../icons'
import { accessoryDcApi, type AccessoryDc } from '../api/unitDc'
import { printAccessoryDc, downloadAccessoryDcAsImage } from '../utils/printDc'
import { Download } from '../icons'
import { useApiData } from '../hooks/useApiData'
import { BackButton, InfoRow, DocStat, StatsStrip, StatDivider, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'
import { shortUnit, sharedUnitSuffix } from '../utils/units'

export default function AccessoryDcDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: doc, loading, reload } = useApiData(
    () => id ? accessoryDcApi.getById(id) : Promise.resolve(null as AccessoryDc | null),
    [id]
  )
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [editSentTo, setEditSentTo] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editQtys, setEditQtys] = useState<Record<string, number>>({})
  const [editItemIds, setEditItemIds] = useState<string[]>([])
  const { dialog, showError, showConfirm } = useAlertDialog()

  useEffect(() => { if (doc) { setEditDate(doc.deliveryDate); setEditSentTo(doc.sentToPersonName ?? ''); setEditQtys(Object.fromEntries(doc.items.map(i => [i.id, Number(i.quantity)]))); setEditItemIds(doc.items.map(i => i.id)) } }, [doc])
  const cancelEdit = () => { setEditing(false); if (doc) { setEditDate(doc.deliveryDate); setEditSentTo(doc.sentToPersonName ?? ''); setEditQtys(Object.fromEntries(doc.items.map(i => [i.id, Number(i.quantity)]))); setEditItemIds(doc.items.map(i => i.id)) } }
  const deleteEditItem = (id: string) => setEditItemIds(ids => ids.filter(i => i !== id))

  const doSaveEdit = async () => {
    if (!doc) return
    if (editItemIds.some(id => !editQtys[id] || editQtys[id] <= 0)) { showError('Invalid Quantity', 'All item quantities must be greater than 0.'); return }
    setBusy(true)
    try {
      await accessoryDcApi.update(doc.id, { deliveryDate: editDate, sentToPersonName: editSentTo || undefined, notes: editNotes || undefined, items: editItemIds.map(id => ({ id, quantity: editQtys[id] })) })
      setEditing(false); reload()
    } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Save Failed', e.message) }
    finally { setBusy(false) }
  }

  const doConfirmDc = async () => {
    if (!doc) return
    setBusy(true)
    try { await accessoryDcApi.confirm(doc.id); reload() }
    catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } finally { setBusy(false) }
  }

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (!doc) return <div className="page"><div className="empty-state">Not found</div></div>

  const totalQty = doc.items.reduce((s, i) => s + i.quantity, 0)
  const totalSuffix = sharedUnitSuffix(doc.items.map(i => i.unitOfMeasure))

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
          <button className="btn btn-secondary" onClick={() => printAccessoryDc(doc)}>Print DC</button>
          <button className="btn btn-secondary" disabled={downloading}
            onClick={async () => { setDownloading(true); try { await downloadAccessoryDcAsImage(doc) } finally { setDownloading(false) } }}>
            <Download size={15} />{downloading ? 'Preparing…' : 'Download Image'}
          </button>
          {doc.status === 'DRAFT' && !editing && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
          {editing && (<><button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={doSaveEdit}>{busy ? 'Saving…' : 'Save Changes'}</button></>)}
          {doc.status === 'DRAFT' && !editing && (
            <button className="btn btn-primary" disabled={busy}
              onClick={() => showConfirm('Confirm Accessory DC', 'Accessory stock will be deducted. This cannot be undone.', doConfirmDc)}>
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
          <InfoRow label="Stitching Unit" value={doc.stitchingUnitName} />
          <InfoRow label="Sales Order"    value={doc.schoolOrderNumber ?? '—'} />
          {editing ? <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Delivery Date</div><input type="date" className="form-control" value={editDate} onChange={e => setEditDate(e.target.value)} /></div> : <InfoRow label="Delivery Date" value={doc.deliveryDate} />}
          <InfoRow label="Status"         value={doc.status} />
          {editing ? <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Received By</div><input type="text" className="form-control" placeholder="Person name" value={editSentTo} onChange={e => setEditSentTo(e.target.value)} /></div> : <InfoRow label="Received By" value={doc.sentToPersonName || '—'} />}
          {editing && <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Notes</div><input type="text" className="form-control" placeholder="Optional notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} /></div>}
        </div>
        <StatsStrip>
          <DocStat label="Lines"           value={doc.items.length.toString()} />
          <StatDivider />
          <DocStat label="Total Quantity"  value={`${totalQty.toLocaleString()}${totalSuffix}`} />
        </StatsStrip>
      </div>

      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Items</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Accessory</th>
              <th style={{ textAlign: 'right' }}>Quantity</th>
              <th>Unit of Measure</th>
              {editing && <th style={{ width: 36 }} />}
            </tr>
          </thead>
          <tbody>
            {doc.items.filter(it => !editing || editItemIds.includes(it.id)).map(it => (
              <tr key={it.id}>
                <td>{it.accessoryName}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  {editing ? <input type="number" min="1" value={editQtys[it.id] ?? Number(it.quantity)} onChange={e => setEditQtys(q => ({ ...q, [it.id]: Number(e.target.value) }))} style={{ width: 80, textAlign: 'right', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4 }} /> : `${it.quantity.toLocaleString()} ${shortUnit(it.unitOfMeasure)}`}
                </td>
                <td>{it.unitOfMeasure}</td>
                {editing && (
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn-icon" title="Remove item" disabled={editItemIds.length === 1} onClick={() => deleteEditItem(it.id)} style={{ color: editItemIds.length === 1 ? '#d1d5db' : '#dc2626' }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
