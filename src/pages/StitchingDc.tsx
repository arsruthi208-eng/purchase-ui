import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from '../icons'
import { stitchingDcApi, type StitchingDc, type CreateStitchingDcRequest } from '../api/stitchingDc'
import { stitchingUnitsApi, type StitchingUnit } from '../api/stitchingUnits'
import { cuttingApi, type CuttingOrder } from '../api/cutting'
import { useApiList } from '../hooks/useApiData'
import { Modal, FormError, FormActions, statusBadge, today, LoadError, FilterBar, SortableTh } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

export default function KajaButtonDc() {
  const navigate = useNavigate()
  const [items, setItems] = useState<StitchingDc[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: units }    = useApiList<StitchingUnit>(() => stitchingUnitsApi.list())
  const { data: cuttings } = useApiList<CuttingOrder>(() => cuttingApi.list())

  // Only confirmed cutting orders
  const confirmedCuttings = cuttings.filter(c => c.status === 'CONFIRMED')

  const [showForm, setShowForm] = useState(false)
  const [cuttingOrderId, setCuttingOrderId] = useState('')
  const [selectedCutting, setSelectedCutting] = useState<CuttingOrder | null>(null)
  const [stitchingUnitId, setStitchingUnitId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [sentToPersonName, setSentToPersonName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true)
    setLoadError('')
    stitchingDcApi.list()
      .then(setItems)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => {
    setCuttingOrderId('')
    setSelectedCutting(null)
    setStitchingUnitId(units[0]?.id ?? '')
    setDeliveryDate(today())
    setNotes('')
    setSentToPersonName('')
    setError('')
    setShowForm(true)
  }

  // When cutting order changes, load its detail
  const onCuttingChange = async (id: string) => {
    setCuttingOrderId(id)
    if (!id) { setSelectedCutting(null); return }
    try {
      const detail = await cuttingApi.getById(id)
      setSelectedCutting(detail)
    } catch {
      setSelectedCutting(null)
    }
  }

  const save = async () => {
    if (!stitchingUnitId || !deliveryDate) {
      setError('Stitching unit and date are required'); return
    }
    if (!cuttingOrderId) {
      setError('Select a cutting order'); return
    }
    setSaving(true); setError('')
    try {
      const payload: CreateStitchingDcRequest = {
        stitchingUnitId,
        cuttingOrderId,
        deliveryDate,
        notes: notes || undefined,
        sentToPersonName: sentToPersonName || undefined,
        kajaConsumption: [],
      }
      await stitchingDcApi.create(payload)
      setShowForm(false); load()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const confirmDc = (id: string) => {
    showConfirm(
      'Confirm KajaButton DC',
      'Accessories stock will be deducted. This cannot be undone.',
      async () => { try { await stitchingDcApi.confirm(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } }
    )
  }

  const deleteDc = (d: StitchingDc, e: React.MouseEvent) => {
    e.stopPropagation()
    showConfirm(
      'Delete Stitching DC',
      `Permanently delete ${d.dcNumber}? This cannot be undone.`,
      async () => {
        try { await stitchingDcApi.delete(d.id); load() }
        catch (err: any) { isForbiddenError(err) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Delete Failed', err.response?.data?.message ?? err.message) }
      }
    )
  }

  const [sortDesc, setSortDesc] = useState(true)
  const filtered = items.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false
    if (unitFilter && r.stitchingUnitName !== unitFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(r.dcNumber.toLowerCase().includes(q) || (r.cuttingOrderNumber ?? '').toLowerCase().includes(q) || (r.schoolName ?? '').toLowerCase().includes(q))) return false
    }
    return true
  })
  const sorted = [...filtered].sort((a, b) =>
    sortDesc ? b.deliveryDate.localeCompare(a.deliveryDate) : a.deliveryDate.localeCompare(b.deliveryDate)
  )

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">KajaButton DC</div>
          <div className="page-subtitle">{items.length} delivery notes</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> New KajaButton DC
        </button>
      </div>

      {showForm && (
        <Modal title="New KajaButton DC" onClose={() => setShowForm(false)} width={660}>
          <FormError message={error} />

          {units.length === 0 && (
            <div style={{ background: '#fef3c7', color: '#92400e', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
              No stitching units found. Add them under <strong>Products → Stitching Units</strong> first.
            </div>
          )}

          {/* Row 1: Cutting Order + Stitching Unit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group">
              <label>Cutting Order *</label>
              <select value={cuttingOrderId} onChange={e => onCuttingChange(e.target.value)}>
                <option value="">Select cutting order</option>
                {confirmedCuttings.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.cuttingNumber} — {c.schoolName}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Stitching Unit *</label>
              <select value={stitchingUnitId} onChange={e => setStitchingUnitId(e.target.value)}>
                <option value="">Select unit</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.unitName}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Delivery Date + Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="form-group">
              <label>Delivery Date *</label>
              <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Received by (optional)</label>
            <input type="text" placeholder="Name of person who received the DC…"
              value={sentToPersonName} onChange={e => setSentToPersonName(e.target.value)} />
          </div>

          {/* Items — auto-filled from cutting order */}
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Items</span>
            {selectedCutting && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Auto-filled from {selectedCutting.cuttingNumber}
              </span>
            )}
          </div>

          {!cuttingOrderId ? (
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 6, fontSize: 13, color: 'var(--text-muted)', border: '1px dashed var(--border)', marginBottom: 16 }}>
              Select a cutting order above to auto-fill items.
            </div>
          ) : !selectedCutting ? (
            <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Loading items…</div>
          ) : (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Style</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Gender</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Standard</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Qty (pcs)</th>
                </tr>
              </thead>
              <tbody>
                {selectedCutting.items.map((it, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--navy)' }}>{it.styleName}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f1f5f9', fontWeight: 600 }}>{it.gender}</span>
                    </td>
                    <td style={{ padding: '9px 12px' }}>{it.standard}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--navy)', fontSize: 14 }}>{it.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={3} style={{ padding: '8px 12px', fontWeight: 700, fontSize: 12, color: 'var(--text-muted)' }}>TOTAL</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>
                    {selectedCutting.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()} pcs
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <div className="card">
        <FilterBar
          filters={[
            { label: 'Unit', options: units.map(u => ({ value: u.unitName, label: u.unitName })), value: unitFilter, onChange: setUnitFilter, allLabel: 'All units' },
            { label: 'Status', options: [{ value: 'DRAFT', label: 'Draft' }, { value: 'CONFIRMED', label: 'Confirmed' }], value: statusFilter, onChange: setStatusFilter, allLabel: 'All statuses' },
          ]}
          search={{ placeholder: 'DC #, cutting #, school…', value: search, onChange: setSearch }}
          count={filtered.length} countLabel="DCs"
        />
        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>DC Number</th>
                <th>Cutting Order</th>
                <th>Stitching Unit</th>
                <th>School</th>
                <SortableTh label="Date" desc={sortDesc} onToggle={() => setSortDesc(p => !p)} />
                <th>Received By</th>
                <th>Status</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state">No KajaButton DCs yet</div></td></tr>
              ) : sorted.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/stitching-dc/${d.id}`)}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{d.dcNumber}</td>
                  <td>{d.cuttingOrderNumber ?? '—'}</td>
                  <td>{d.stitchingUnitName}</td>
                  <td>{d.schoolName ?? '—'}</td>
                  <td>{d.deliveryDate}</td>
                  <td style={{ color: d.sentToPersonName ? undefined : 'var(--text-muted)', fontSize: 13 }}>{d.sentToPersonName ?? '—'}</td>
                  <td><span className={`badge ${statusBadge(d.status)}`}>{d.status}</span></td>
                  <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    {d.status === 'DRAFT' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => confirmDc(d.id)}>Confirm</button>
                    )}
                    {d.status === 'DRAFT' ? (
                      <button className="btn-icon" title="Delete draft" style={{ color: '#dc2626', marginLeft: 6 }} onClick={e => deleteDc(d, e)}>
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <Trash2 size={14} style={{ color: '#d1d5db', marginLeft: 6, verticalAlign: 'middle' }} title="Cannot delete — already confirmed" />
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
