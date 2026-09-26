import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from '../icons'
import { unitDcApi, type UnitDc, type CreateUnitDcRequest } from '../api/unitDc'
import { cuttingApi, type CuttingOrder } from '../api/cutting'
import { stitchingUnitsApi, type StitchingUnit } from '../api/stitchingUnits'
import { useApiList } from '../hooks/useApiData'
import { Modal, FormError, FormActions, statusBadge, today, LoadError, FilterBar, SortableTh } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

type Line = CreateUnitDcRequest['items'][0]

const emptyLine = (): Line => ({ styleId: '', gender: 'BOYS', standard: '', quantity: 0 })

export default function UnitDc() {
  const navigate = useNavigate()
  const [items, setItems] = useState<UnitDc[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')
  const [search, setSearch] = useState('')
  const { data: cuttings } = useApiList<CuttingOrder>(() => cuttingApi.list())
  const { data: units }    = useApiList<StitchingUnit>(() => stitchingUnitsApi.list())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateUnitDcRequest>({
    cuttingOrderId: '', stitchingUnitId: '', deliveryDate: today(), sentToPersonName: undefined, items: [emptyLine()],
  })
  const [selectedCutting, setSelectedCutting] = useState<CuttingOrder | null>(null)
  const [loadingCutting, setLoadingCutting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm, showWarning } = useAlertDialog()

  const load = () => {
    setLoading(true)
    setLoadError('')
    unitDcApi.list()
      .then(setItems)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => {
    setForm({ cuttingOrderId: '', stitchingUnitId: units[0]?.id ?? '', deliveryDate: today(), sentToPersonName: undefined, items: [emptyLine()] })
    setSelectedCutting(null)
    setError('')
    setShowForm(true)
  }

  const onCuttingChange = async (id: string) => {
    setForm(p => ({ ...p, cuttingOrderId: id, items: [emptyLine()] }))
    setSelectedCutting(null)
    if (!id) return
    setLoadingCutting(true)
    try {
      const detail = await cuttingApi.getById(id)
      setSelectedCutting(detail)
      // Auto-fill items from cutting order
      const autoItems = detail.items.map(ci => ({
        styleId: ci.styleId ?? '',
        gender: ci.gender,
        standard: ci.standard,
        quantity: ci.quantity,
      }))
      setForm(p => ({ ...p, items: autoItems.length > 0 ? autoItems : [emptyLine()] }))
    } catch {
      showError('Load Failed', 'Could not load cutting order details.')
    } finally { setLoadingCutting(false) }
  }

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setForm(p => ({
      ...p,
      items: p.items.map((line, i) => (i === idx ? { ...line, ...patch } : line)),
    }))
  }

  const doSave = async () => {
    setSaving(true); setError('')
    try {
      await unitDcApi.create(form)
      setShowForm(false); load()
    } catch (e: any) {
      if (isForbiddenError(e)) showError('Access Denied', PERMISSION_DENIED_MSG)
      else setError(e.message)
    } finally { setSaving(false) }
  }

  const save = () => {
    if (!form.cuttingOrderId || !form.stitchingUnitId || !form.deliveryDate) {
      setError('Cutting order, stitching unit, and date are required'); return
    }
    if (form.items.some(l => !l.styleId)) {
      setError('Style IDs are missing — re-select the cutting order and try again'); return
    }
    if (form.items.some(l => !l.quantity || l.quantity <= 0)) {
      setError('Each line needs a quantity greater than 0'); return
    }
    // Item 9: check if a Unit DC already exists for this cutting order
    const existingDc = items.find(dc => {
      const cutting = cuttings.find(c => c.id === form.cuttingOrderId)
      return cutting && dc.cuttingNumber === cutting.cuttingNumber
    })
    if (existingDc) {
      showWarning(
        'Duplicate Unit DC',
        `A Unit DC (${existingDc.dcNumber}) already exists for this cutting order. ` +
        `Creating another may cause confusion. Do you want to proceed?`,
        doSave
      )
      return
    }
    doSave()
  }

  const confirmDc = (id: string) => {
    showConfirm(
      'Confirm Unit DC',
      'Garments will be marked as sent to stitching unit.',
      async () => { try { await unitDcApi.confirm(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } }
    )
  }

  const deleteDc = (d: UnitDc, e: React.MouseEvent) => {
    e.stopPropagation()
    showConfirm(
      'Delete Unit DC',
      `Permanently delete ${d.dcNumber}? This cannot be undone.`,
      async () => {
        try { await unitDcApi.delete(d.id); load() }
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
      if (!(r.dcNumber.toLowerCase().includes(q) || (r.cuttingNumber ?? '').toLowerCase().includes(q))) return false
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
          <div className="page-title">Unit Delivery DC</div>
          <div className="page-subtitle">{items.length} delivery notes</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />New Unit DC</button>
      </div>

      {showForm && (
        <Modal title="New Unit DC" onClose={() => setShowForm(false)} width={640}>
          <FormError message={error} />
          {units.length === 0 && (
            <div style={{ background: '#fef3c7', color: '#92400e', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
              No stitching units found. Please add units first under <strong>Products → Stitching Units</strong>.
            </div>
          )}
          <div className="form-group">
            <label>Cutting Order *</label>
            <select value={form.cuttingOrderId} onChange={e => onCuttingChange(e.target.value)}>
              <option value="">Select cutting order</option>
              {cuttings.filter(c => c.status === 'CONFIRMED').map(c =>
                <option key={c.id} value={c.id}>{c.cuttingNumber} — {c.schoolName}</option>
              )}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Stitching Unit *</label>
              <select value={form.stitchingUnitId} onChange={e => setForm(p => ({ ...p, stitchingUnitId: e.target.value }))}>
                <option value="">Select unit</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.unitName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Delivery Date *</label>
              <input type="date" value={form.deliveryDate} onChange={e => setForm(p => ({ ...p, deliveryDate: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Received by (optional)</label>
            <input type="text" placeholder="Name of person who received the DC…"
              value={form.sentToPersonName ?? ''}
              onChange={e => setForm(p => ({ ...p, sentToPersonName: e.target.value || undefined }))} />
          </div>

          {/* Items — auto-filled from cutting order */}
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Items</span>
            {selectedCutting && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Auto-filled from {selectedCutting.cuttingNumber} — qty is editable
              </span>
            )}
          </div>

          {loadingCutting ? (
            <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-muted)' }}>Loading cutting order items…</div>
          ) : !form.cuttingOrderId ? (
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 6, fontSize: 13, color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
              Select a cutting order above to auto-fill items.
            </div>
          ) : (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Style</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Gender</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Standard</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Qty (pcs)</th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((line, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--navy)' }}>
                      {selectedCutting?.items[idx]?.styleName ?? line.styleId}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f1f5f9', fontWeight: 600 }}>{line.gender}</span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>{line.standard}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <input
                        type="number" min="1" placeholder="Qty"
                        value={line.quantity || ''}
                        onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                        style={{ width: 80, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, textAlign: 'right', fontSize: 13 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={3} style={{ padding: '8px 12px', fontWeight: 700, fontSize: 12, color: 'var(--text-muted)' }}>TOTAL</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>
                    {form.items.reduce((s, l) => s + l.quantity, 0).toLocaleString()} pcs
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
          search={{ placeholder: 'DC #, cutting #…', value: search, onChange: setSearch }}
          count={filtered.length} countLabel="DCs"
        />
        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>DC Number</th>
                <th>Cutting #</th>
                <th>Stitching Unit</th>
                <SortableTh label="Delivery Date" desc={sortDesc} onToggle={() => setSortDesc(p => !p)} />
                <th>Received By</th>
                <th>Status</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state">No unit DCs yet</div></td></tr>
              ) : sorted.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/unit-dc/${d.id}`)}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{d.dcNumber}</td>
                  <td>{d.cuttingNumber}</td>
                  <td>{d.stitchingUnitName}</td>
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
                      <Trash2 size={14} style={{ color: '#d1d5db', marginLeft: 6, verticalAlign: 'middle' }} aria-label="Cannot delete — already confirmed" />
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
