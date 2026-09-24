import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from '../icons'
import { ironingDcApi, type IroningDc, type CreateIroningDcRequest } from '../api/ironingDc'
import { stitchingUnitsApi, type StitchingUnit } from '../api/stitchingUnits'
import { schoolOrdersApi, type SchoolOrderSummary, type SchoolOrderDetail } from '../api/schoolOrders'
import { useApiList } from '../hooks/useApiData'
import { Modal, FormError, FormActions, statusBadge, today } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

type Line = CreateIroningDcRequest['items'][0]

const emptyLine = (): Line => ({ styleId: '', gender: 'BOYS', standard: '', quantity: 0 })

export default function IroningDc() {
  const navigate = useNavigate()
  const [items, setItems] = useState<IroningDc[]>([])
  const [loading, setLoading] = useState(true)
  const { data: units } = useApiList<StitchingUnit>(() => stitchingUnitsApi.list())
  const { data: schoolOrders } = useApiList<SchoolOrderSummary>(() => schoolOrdersApi.list())
  const confirmedOrders = schoolOrders.filter(o => o.status === 'CONFIRMED')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateIroningDcRequest>({
    stitchingUnitId: '', schoolOrderId: '', deliveryDate: today(), sentToPersonName: undefined, items: [emptyLine()],
  })
  const [selectedOrder, setSelectedOrder] = useState<SchoolOrderDetail | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true)
    ironingDcApi.list().then(setItems).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => {
    setForm({ stitchingUnitId: units[0]?.id ?? '', schoolOrderId: '', deliveryDate: today(), sentToPersonName: undefined, items: [emptyLine()] })
    setSelectedOrder(null)
    setError('')
    setShowForm(true)
  }

  const onSchoolOrderChange = async (id: string) => {
    setForm(p => ({ ...p, schoolOrderId: id, items: [emptyLine()] }))
    setSelectedOrder(null)
    if (!id) return
    setLoadingOrder(true)
    try {
      const detail = await schoolOrdersApi.getById(id)
      setSelectedOrder(detail)
      const autoItems = detail.items.map(it => ({
        styleId: it.styleId,
        gender: it.gender,
        standard: it.standard,
        quantity: it.quantity,
      }))
      setForm(p => ({ ...p, schoolOrderId: id, items: autoItems.length > 0 ? autoItems : [emptyLine()] }))
    } catch {
      showError('Load Failed', 'Could not load school order details.')
    } finally {
      setLoadingOrder(false)
    }
  }

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setForm(p => ({
      ...p,
      items: p.items.map((line, i) => (i === idx ? { ...line, ...patch } : line)),
    }))
  }

  const save = async () => {
    if (!form.schoolOrderId || !form.stitchingUnitId || !form.deliveryDate) {
      setError('School order, stitching unit, and date are required'); return
    }
    if (form.items.some(l => !l.styleId || !l.quantity || l.quantity <= 0)) {
      setError('Each line needs style and quantity greater than 0'); return
    }
    setSaving(true); setError('')
    try {
      await ironingDcApi.create(form)
      setShowForm(false); load()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const confirmDc = (id: string) => {
    showConfirm(
      'Confirm Ironing DC',
      'Garments will be marked as ironed. This cannot be undone.',
      async () => { try { await ironingDcApi.confirm(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } }
    )
  }

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Ironing DC</div>
          <div className="page-subtitle">{items.length} delivery notes</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> New Ironing DC</button>
      </div>

      {showForm && (
        <Modal title="New Ironing DC" onClose={() => setShowForm(false)} width={680}>
          <FormError message={error} />
          {units.length === 0 && (
            <div style={{ background: '#fef3c7', color: '#92400e', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
              No stitching units found. Add them under <strong>Products → Stitching Units</strong> first.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>School Order *</label>
              <select value={form.schoolOrderId} onChange={e => onSchoolOrderChange(e.target.value)}>
                <option value="">Select school order…</option>
                {confirmedOrders.map(o => (
                  <option key={o.id} value={o.id}>{o.orderNumber} — {o.schoolName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>School</label>
              <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 500 }}>
                {selectedOrder ? (
                  <>
                    {selectedOrder.schoolName}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>from school order</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Select a school order</span>
                )}
              </div>
            </div>
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
              <label>Ironing Date *</label>
              <input type="date" value={form.deliveryDate} onChange={e => setForm(p => ({ ...p, deliveryDate: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Received by (optional)</label>
            <input type="text" placeholder="Name of person who received the DC…"
              value={form.sentToPersonName ?? ''}
              onChange={e => setForm(p => ({ ...p, sentToPersonName: e.target.value || undefined }))} />
          </div>

          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Items</span>
            {selectedOrder && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Auto-filled from {selectedOrder.orderNumber} — qty is editable
              </span>
            )}
          </div>

          {loadingOrder ? (
            <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--text-muted)' }}>Loading school order items…</div>
          ) : !form.schoolOrderId ? (
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 6, fontSize: 13, color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
              Select a school order above to auto-fill style, gender, standard, and quantity.
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
                      {selectedOrder?.items[idx]?.styleName ?? line.styleId}
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
        {loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>DC Number</th>
                <th>Sales Order</th>
                <th>School</th>
                <th>Stitching Unit</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state">No ironing DCs yet</div></td></tr>
              ) : items.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/ironing-dc/${d.id}`)}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{d.dcNumber}</td>
                  <td>{d.schoolOrderNumber ?? '—'}</td>
                  <td>{d.schoolName ?? '—'}</td>
                  <td>{d.stitchingUnitName}</td>
                  <td>{d.deliveryDate}</td>
                  <td><span className={`badge ${statusBadge(d.status)}`}>{d.status}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    {d.status === 'DRAFT' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => confirmDc(d.id)}>Confirm</button>
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
