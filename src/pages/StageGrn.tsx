import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from '../icons'
import { stageGrnApi, type StageGrn, type CreateStageGrnRequest } from '../api/stageGrn'
import { unitDcApi, type UnitDc } from '../api/unitDc'
import { stitchingDcApi, type StitchingDc } from '../api/stitchingDc'
import { useApiList } from '../hooks/useApiData'
import { Modal, FormError, FormActions, statusBadge, today } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

// Extended item type that also carries styleName for display
type Item = CreateStageGrnRequest['items'][0] & { styleName?: string }

const SOURCE_LABELS: Record<string, string> = {
  UNIT_DC: 'Unit DC',
  KAJA_DC: 'KajaButton DC',
}

export default function StageGrnPage() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<StageGrn[]>([])
  const [loading, setLoading] = useState(true)

  const { data: unitDcs }    = useApiList<UnitDc>(() => unitDcApi.list())
  const { data: kajaDcs }    = useApiList<StitchingDc>(() => stitchingDcApi.list())

  const confirmedUnitDcs = unitDcs.filter(u => u.status === 'CONFIRMED')
  const confirmedKajaDcs = kajaDcs.filter(k => k.status === 'CONFIRMED')

  const [showForm, setShowForm] = useState(false)
  const [sourceType, setSourceType] = useState('UNIT_DC')
  const [sourceId, setSourceId] = useState('')
  const [receivedDate, setReceivedDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true)
    stageGrnApi.list().then(setRecords).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => {
    setSourceType('UNIT_DC')
    setSourceId('')
    setReceivedDate(today())
    setNotes('')
    setItems([])
    setError('')
    setShowForm(true)
  }

  // When source DC selected, auto-fill items from it
  const onSourceChange = (type: string, id: string) => {
    setSourceType(type)
    setSourceId(id)
    if (!id) { setItems([]); return }

    const dc = type === 'UNIT_DC'
      ? confirmedUnitDcs.find(u => u.id === id)
      : confirmedKajaDcs.find(k => k.id === id)

    if (dc) {
      setItems(dc.items.map(it => ({
        styleId:   it.styleId ?? '',
        styleName: it.styleName,
        gender:    it.gender,
        standard:  it.standard,
        sentQty:   it.quantity,
        receivedQty: it.quantity,
        rejectedQty: 0,
      })))
    }
  }

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx))

  const save = async () => {
    if (!sourceId) { setError('Select a source DC'); return }
    if (items.length === 0) { setError('Add at least one item'); return }
    // Item 6: received qty > sent qty validation
    const overReceived = items.filter(it => it.receivedQty > it.sentQty)
    if (overReceived.length > 0) {
      showError(
        'Received Qty Exceeds Sent Qty',
        `${overReceived.length} item(s) have received quantity greater than sent quantity. ` +
        `Received qty cannot be more than what was originally sent.`
      )
      return
    }
    setSaving(true); setError('')
    try {
      const payload: CreateStageGrnRequest = {
        sourceType,
        sourceId,
        receivedDate,
        notes: notes || undefined,
        items,
      }
      await stageGrnApi.create(payload)
      setShowForm(false); load()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const confirmGrn = (id: string) => {
    showConfirm(
      'Confirm Stage GRN',
      'This will record garment receipt from the stitching unit. This cannot be undone.',
      async () => { try { await stageGrnApi.confirm(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } }
    )
  }

  const sourceDcs = sourceType === 'UNIT_DC' ? confirmedUnitDcs : confirmedKajaDcs

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Stage GRN</div>
          <div className="page-subtitle">Receiving — garments back from stitching units</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />New Stage GRN</button>
      </div>

      {showForm && (
        <Modal title="New Stage GRN" onClose={() => setShowForm(false)} width={700}>
          <FormError message={error} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group">
              <label>Source Type *</label>
              <select value={sourceType} onChange={e => { setSourceType(e.target.value); setSourceId(''); setItems([]) }}>
                <option value="UNIT_DC">Unit DC</option>
                <option value="KAJA_DC">KajaButton DC</option>
              </select>
            </div>
            <div className="form-group">
              <label>Source DC *</label>
              <select value={sourceId} onChange={e => onSourceChange(sourceType, e.target.value)}>
                <option value="">Select {SOURCE_LABELS[sourceType]}</option>
                {sourceDcs.map(d => (
                  <option key={d.id} value={d.id}>{d.dcNumber}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Received Date *</label>
              <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Notes</label>
            <input placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Items */}
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
            Items
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>
              Auto-filled from {SOURCE_LABELS[sourceType]} — adjust received qty as needed
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr auto', gap: 6, marginBottom: 4 }}>
            {['Style', 'Gender', 'Standard', 'Sent', 'Received', 'Rejected', ''].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
            {items.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>
                Select a source DC above to auto-fill items.
              </div>
            )}
            {items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <div style={{
                  padding: '5px 10px', background: 'var(--bg-secondary)', borderRadius: 5,
                  fontSize: 13, fontWeight: 600, color: 'var(--navy)', border: '1px solid var(--border)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.styleName || item.styleId}
                </div>
                <input value={item.gender} readOnly style={{ background: 'var(--bg-secondary)', fontSize: 12 }} />
                <input value={item.standard} readOnly style={{ background: 'var(--bg-secondary)', fontSize: 12 }} />
                <input value={item.sentQty} readOnly style={{ background: 'var(--bg-secondary)', fontSize: 12, textAlign: 'right' }} />
                <input
                  type="number" min={0} max={item.sentQty}
                  value={item.receivedQty}
                  onChange={e => updateItem(idx, { receivedQty: Number(e.target.value) })}
                />
                <input
                  type="number" min={0}
                  value={item.rejectedQty ?? 0}
                  onChange={e => updateItem(idx, { rejectedQty: Number(e.target.value) })}
                />
                <button className="btn-icon" style={{ color: '#dc2626' }} onClick={() => removeItem(idx)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <div className="card">
        {loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>GRN #</th>
                <th>Source Type</th>
                <th>Source DC</th>
                <th>School</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state">No stage GRNs yet</div></td></tr>
              ) : records.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/stage-grn/${r.id}`)}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{r.grnNumber}</td>
                  <td><span className="badge badge-info">{SOURCE_LABELS[r.sourceType] ?? r.sourceType}</span></td>
                  <td style={{ fontWeight: 600 }}>{r.sourceDcNumber ?? r.sourceId}</td>
                  <td>{r.schoolName ?? '—'}</td>
                  <td>{r.receivedDate}</td>
                  <td><span className={`badge ${statusBadge(r.status)}`}>{r.status}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    {r.status === 'DRAFT' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => confirmGrn(r.id)}>Confirm</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
