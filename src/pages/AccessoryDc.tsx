import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from '../icons'
import { accessoryDcApi, type AccessoryDc, type CreateAccessoryDcRequest } from '../api/unitDc'
import { stitchingUnitsApi, type StitchingUnit } from '../api/stitchingUnits'
import { accessoriesApi, type Accessory } from '../api/accessories'
import { schoolOrdersApi, type SchoolOrderSummary } from '../api/schoolOrders'
import { stockApi } from '../api/stock'
import { useApiList } from '../hooks/useApiData'
import { Modal, FormError, FormActions, AlertDialog, type StockShortfall, statusBadge, today, LoadError, FilterBar, SortableTh } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'

type Line = CreateAccessoryDcRequest['items'][0]

const emptyLine = (): Line => ({ accessoryId: '', quantity: 0, unitOfMeasure: 'PCS' })

export default function AccessoryDcPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<AccessoryDc[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: units }        = useApiList<StitchingUnit>(() => stitchingUnitsApi.list())
  const { data: accessories }  = useApiList<Accessory>(() => accessoriesApi.list())
  const { data: schoolOrders } = useApiList<SchoolOrderSummary>(() => schoolOrdersApi.list())

  const confirmedOrders = schoolOrders.filter(o => o.status === 'CONFIRMED')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateAccessoryDcRequest>({
    stitchingUnitId: '', deliveryDate: today(), sentToPersonName: undefined, items: [emptyLine()],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog: alertDialog, showError: showAlertError, showConfirm } = useAlertDialog()

  // Stock dialog
  const [stockDialog, setStockDialog] = useState<StockShortfall[] | null>(null)

  const load = () => {
    setLoading(true)
    setLoadError('')
    accessoryDcApi.list()
      .then(setItems)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => {
    setForm({ stitchingUnitId: units[0]?.id ?? '', deliveryDate: today(), sentToPersonName: undefined, items: [emptyLine()] })
    setError('')
    setShowForm(true)
  }

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setForm(p => ({
      ...p,
      items: p.items.map((line, i) => {
        if (i !== idx) return line
        const merged = { ...line, ...patch }
        if ('accessoryId' in patch) {
          const acc = accessories.find(a => a.id === patch.accessoryId)
          if (acc) merged.unitOfMeasure = acc.unitOfMeasure ?? 'PCS'
        }
        return merged
      }),
    }))
  }

  const removeLine = (idx: number) =>
    setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))

  const checkStockAndSave = async () => {
    if (!form.stitchingUnitId || !form.deliveryDate) {
      setError('Stitching unit and date are required'); return
    }
    const validLines = form.items.filter(l => l.accessoryId && l.quantity > 0)
    if (validLines.length === 0) {
      setError('Add at least one accessory line'); return
    }

    // Check stock balance for each accessory
    try {
      const balances = await stockApi.listBalances('ACCESSORY')
      const balanceMap = Object.fromEntries(balances.map(b => [b.referenceId, b.balance]))

      // Group by accessoryId and sum quantities
      const required: Record<string, number> = {}
      validLines.forEach(l => { required[l.accessoryId] = (required[l.accessoryId] ?? 0) + l.quantity })

      const shortfalls: StockShortfall[] = Object.entries(required)
        .filter(([id, qty]) => (balanceMap[id] ?? 0) < qty)
        .map(([id, qty]) => {
          const acc = accessories.find(a => a.id === id)
          const available = balanceMap[id] ?? 0
          return {
            name: acc?.accessoryName ?? id,
            required: qty,
            available,
            shortfall: qty - available,
            unit: acc?.unitOfMeasure ?? 'PCS',
          }
        })

      if (shortfalls.length > 0) {
        setStockDialog(shortfalls)
        return
      }
    } catch {
      // If stock check fails, still allow save (don't block on API errors)
    }

    await doSave()
  }

  const doSave = async () => {
    setSaving(true); setError('')
    try {
      const payload: CreateAccessoryDcRequest = {
        ...form,
        items: form.items.filter(l => l.accessoryId && l.quantity > 0),
      }
      await accessoryDcApi.create(payload)
      setShowForm(false); load()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const confirmDc = (id: string) => {
    showConfirm(
      'Confirm Accessory DC',
      'Accessory stock will be deducted. This cannot be undone.',
      async () => { try { await accessoryDcApi.confirm(id); load() } catch (e: any) { showAlertError('Confirm Failed', e.message) } }
    )
  }

  const deleteDc = (d: AccessoryDc, e: React.MouseEvent) => {
    e.stopPropagation()
    showConfirm(
      'Delete Accessory DC',
      `Permanently delete ${d.dcNumber}? This cannot be undone.`,
      async () => {
        try { await accessoryDcApi.delete(d.id); load() }
        catch (err: any) { showAlertError('Delete Failed', err.response?.data?.message ?? err.message) }
      }
    )
  }

  const [sortDesc, setSortDesc] = useState(true)
  const filtered = items.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false
    if (unitFilter && r.stitchingUnitName !== unitFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(r.dcNumber.toLowerCase().includes(q) || (r.schoolOrderNumber ?? '').toLowerCase().includes(q))) return false
    }
    return true
  })
  const sorted = [...filtered].sort((a, b) =>
    sortDesc ? b.deliveryDate.localeCompare(a.deliveryDate) : a.deliveryDate.localeCompare(b.deliveryDate)
  )

  return (
    <div className="page">
      {alertDialog}
      <div className="page-header">
        <div>
          <div className="page-title">Accessory DC</div>
          <div className="page-subtitle">{items.length} delivery notes</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />New Accessory DC</button>
      </div>

      {/* Stock insufficient dialog */}
      {stockDialog && (
        <AlertDialog
          title="Insufficient Accessory Stock"
          message="The following accessories do not have enough stock. Please add stock entries before proceeding."
          stockShortfalls={stockDialog}
          variant="error"
          onClose={() => setStockDialog(null)}
        />
      )}

      {showForm && (
        <Modal title="New Accessory DC" onClose={() => setShowForm(false)} width={660}>
          <FormError message={error} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group">
              <label>School Order <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <select
                value={form.schoolOrderId ?? ''}
                onChange={e => setForm(p => ({ ...p, schoolOrderId: e.target.value || undefined }))}
              >
                <option value="">None</option>
                {confirmedOrders.map(o => (
                  <option key={o.id} value={o.id}>{o.orderNumber} — {o.schoolName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Items header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 4, padding: '0 2px' }}>
            {['Accessory *', 'Quantity *', 'Unit', ''].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
            {form.items.map((line, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <select
                  value={line.accessoryId}
                  onChange={e => updateLine(idx, { accessoryId: e.target.value })}
                >
                  <option value="">Select accessory</option>
                  {accessories.map(a => <option key={a.id} value={a.id}>{a.accessoryCode} — {a.accessoryName}</option>)}
                </select>
                <input
                  type="number"
                  placeholder="Qty"
                  value={line.quantity || ''}
                  onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                />
                <select
                  value={line.unitOfMeasure ?? 'PCS'}
                  onChange={e => updateLine(idx, { unitOfMeasure: e.target.value })}
                >
                  {['PCS', 'SETS', 'METER', 'KG', 'CONE'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <button
                  className="btn-icon"
                  style={{ color: '#dc2626' }}
                  disabled={form.items.length === 1}
                  onClick={() => removeLine(idx)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-sm btn-secondary"
            style={{ marginTop: 4 }}
            onClick={() => setForm(p => ({ ...p, items: [...p.items, emptyLine()] }))}
          >
            + Add line
          </button>

          <FormActions onCancel={() => setShowForm(false)} onSave={checkStockAndSave} saving={saving} />
        </Modal>
      )}

      <div className="card">
        <FilterBar
          filters={[
            { label: 'Unit', options: units.map(u => ({ value: u.unitName, label: u.unitName })), value: unitFilter, onChange: setUnitFilter, allLabel: 'All units' },
            { label: 'Status', options: [{ value: 'DRAFT', label: 'Draft' }, { value: 'CONFIRMED', label: 'Confirmed' }], value: statusFilter, onChange: setStatusFilter, allLabel: 'All statuses' },
          ]}
          search={{ placeholder: 'DC #, sales order…', value: search, onChange: setSearch }}
          count={filtered.length} countLabel="DCs"
        />
        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>DC Number</th>
                <th>Stitching Unit</th>
                <th>Sales Order</th>
                <SortableTh label="Delivery Date" desc={sortDesc} onToggle={() => setSortDesc(p => !p)} />
                <th>Received By</th>
                <th style={{ textAlign: 'right' }}>Items</th>
                <th>Status</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state">No accessory DCs yet</div></td></tr>
              ) : sorted.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/accessory-dc/${d.id}`)}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{d.dcNumber}</td>
                  <td>{d.stitchingUnitName}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.schoolOrderNumber ?? '—'}</td>
                  <td>{d.deliveryDate}</td>
                  <td style={{ color: d.sentToPersonName ? undefined : 'var(--text-muted)', fontSize: 13 }}>{d.sentToPersonName ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{d.items?.length ?? 0}</td>
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
