import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Trash2, Pencil } from '../icons'
import { purchaseOrdersApi, type PoSummary, type CreatePoRequest } from '../api/purchaseOrders'
import { purchasePartiesApi, type PurchaseParty } from '../api/purchaseParties'
import { accessoriesApi, type Accessory } from '../api/accessories'
import { fabricsApi, type Fabric } from '../api/fabrics'
import { coloursApi, type Colour } from '../api/colours'
import { schoolOrdersApi, type SchoolOrderSummary } from '../api/schoolOrders'
import { useApiList } from '../hooks/useApiData'
import { Modal, FormError, FormActions, statusBadge, today, LoadError, FilterBar } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

const ALL_STATUSES = ['DRAFT', 'OPEN', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED']

const ACC_UOMS = ['PCS', 'METER', 'KG', 'CONE'] as const

// ── Preset shipping addresses ──────────────────────────────────────────────────
const PRESET_ADDRESSES = [
  'Apple Uniformm, No:3/190 A Akkarai Negamam second cross, Konamoolai Post, Sathyamangalam 638402',
]

// ── Preset transport options ──────────────────────────────────────────────────
const PRESET_TRANSPORTS = [
  'VRL Logistics @ Sathyamangalam',
  'Palani Andavar Lorry Service @ Sathyamangalam',
  'Uttam Roadways @ Coimbatore',
]

const CUSTOM_SENTINEL = '__custom__'

type Line = CreatePoRequest['items'][0]
type PoKind = 'FABRIC' | 'ACCESSORY'

const emptyLine = (kind: PoKind): Line => kind === 'ACCESSORY'
  ? { accessoryId: '', fabricId: '', unitOfMeasure: 'PCS', orderedQuantity: 0, unitPrice: 0 }
  : { fabricId: '', colourId: '', unitOfMeasure: 'METER', orderedQuantity: 0, unitPrice: 0, weightGsm: undefined, widthInches: undefined }

export default function PurchaseOrders({ kind = 'FABRIC' }: { kind?: PoKind }) {
  const isAccessory = kind === 'ACCESSORY'
  const listPath = isAccessory ? '/accessory-purchase-orders' : '/purchase-orders'
  const navigate = useNavigate()
  const [pos, setPos] = useState<PoSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const { data: parties }      = useApiList<PurchaseParty>(() => purchasePartiesApi.list(kind), [kind])
  const { data: colours }      = useApiList<Colour>(() => coloursApi.list())
  const { data: schoolOrders } = useApiList<SchoolOrderSummary>(() => schoolOrdersApi.list())
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreatePoRequest>({
    purchasePartyId: '',
    schoolOrderId: '',
    poDate: today(),
    expectedDeliveryDate: '',
    shippingAddress: '',
    transportDetails: '',
    notes: '',
    poKind: kind,
    items: [emptyLine(kind)],
  })
  const { data: fabrics } = useApiList<Fabric>(
    () => form.purchasePartyId
      ? fabricsApi.list(undefined, form.purchasePartyId)
      : Promise.resolve([]),
    [form.purchasePartyId]
  )
  const { data: accessories } = useApiList<Accessory>(
    () => form.purchasePartyId
      ? accessoriesApi.list(undefined, form.purchasePartyId)
      : Promise.resolve([]),
    [form.purchasePartyId]
  )
  const [editingId, setEditingId] = useState<string | null>(null) // null = create, string = edit DRAFT PO id
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = (status?: string) => {
    setLoading(true)
    setLoadError('')
    purchaseOrdersApi.list(status || undefined, kind)
      .then(setPos)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [kind])

  const handleFilter = (s: string) => { setFilter(s); load(s) }

  const displayedPos = search
    ? pos.filter(po => {
        const q = search.toLowerCase()
        return (
          po.poNumber.toLowerCase().includes(q) ||
          (po.purchasePartyName ?? '').toLowerCase().includes(q) ||
          (po.schoolOrderNumber ?? '').toLowerCase().includes(q) ||
          (po.schoolName ?? '').toLowerCase().includes(q)
        )
      })
    : pos

  const openCreate = () => {
    setEditingId(null)
    setForm({
      purchasePartyId: '',
      schoolOrderId: '',
      poDate: today(),
      expectedDeliveryDate: '',
      shippingAddress: PRESET_ADDRESSES[0],
      transportDetails: PRESET_TRANSPORTS[0],
      notes: '',
      poKind: kind,
      items: [emptyLine(kind)],
    })
    setError('')
    setShowForm(true)
  }

  const openEdit = (po: PoSummary) => {
    // Fetch full detail to populate items
    purchaseOrdersApi.getById(po.id).then(detail => {
      setEditingId(po.id)
      setForm({
        purchasePartyId: detail.purchasePartyId ?? '',
        schoolOrderId: detail.schoolOrderId ?? '',
        poDate: detail.poDate,
        expectedDeliveryDate: detail.expectedDeliveryDate ?? '',
        shippingAddress: detail.shippingAddress ?? '',
        transportDetails: detail.transportDetails ?? '',
        notes: detail.notes ?? '',
        poKind: kind,
        items: detail.items.map(i => isAccessory
          ? {
              accessoryId: i.accessoryId ?? '',
              fabricId: '',
              unitOfMeasure: i.unitOfMeasure,
              orderedQuantity: i.orderedQuantity,
              unitPrice: i.unitPrice,
            }
          : {
              fabricId: i.fabricId ?? '',
              colourId: i.colourId ?? '',
              unitOfMeasure: i.unitOfMeasure,
              orderedQuantity: i.orderedQuantity,
              unitPrice: i.unitPrice,
              weightGsm: i.weightGsm,
              widthInches: i.widthInches,
            }
        ),
      })
      setError('')
      setShowForm(true)
    }).catch(e => isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Load Failed', e.message))
  }

  const deletePo = (po: PoSummary) => {
    showConfirm(
      'Delete Purchase Order',
      `Permanently delete ${po.poNumber}? This cannot be undone.`,
      async () => {
        try { await purchaseOrdersApi.delete(po.id); load(filter || undefined) }
        catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Delete Failed', e.message) }
      },
      'Delete'
    )
  }

  /** Auto-fill orderedQuantity = school_order.totalQty × fabric.composition when both are set */
  const calcMeters = (fabricId: string, schoolOrderId: string): number | null => {
    const so = schoolOrders.find(s => s.id === schoolOrderId)
    const fab = fabrics.find(f => f.id === fabricId)
    if (so && fab && fab.composition > 0) {
      return parseFloat((so.totalQuantity * fab.composition).toFixed(2))
    }
    return null
  }

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setForm(p => ({
      ...p,
      items: p.items.map((line, i) => {
        if (i !== idx) return line
        const updated = { ...line, ...patch }
        if ('accessoryId' in patch) {
          const acc = accessories.find(a => a.id === updated.accessoryId)
          if (acc) updated.unitOfMeasure = acc.unitOfMeasure
        }
        if ('fabricId' in patch) {
          const fab = fabrics.find(f => f.id === updated.fabricId)
          updated.weightGsm = fab?.weightGsm
          updated.widthInches = fab?.widthInches
          if (p.schoolOrderId) {
            const meters = calcMeters(updated.fabricId, p.schoolOrderId)
            if (meters !== null) updated.orderedQuantity = meters
          }
        }
        return updated
      }),
    }))
  }

  const deleteLine = (idx: number) => {
    setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))
  }

  const save = async () => {
    if (!form.schoolOrderId) { setError('School Order is required — a PO must be linked to a school order'); return }
    if (!form.purchasePartyId || !form.poDate) { setError('Purchase party and PO date are required'); return }
    if (form.items.length === 0) { setError('Add at least one line'); return }
    if (isAccessory) {
      if (form.items.some(l => !l.accessoryId || !l.orderedQuantity)) {
        setError('Each line needs accessory and quantity'); return
      }
    } else if (form.items.some(l => !l.fabricId || !l.orderedQuantity)) {
      setError('Each line needs fabric and ordered quantity'); return
    }
    setSaving(true); setError('')
    try {
      const payload: CreatePoRequest = {
        ...form,
        purchasePartyId: form.purchasePartyId,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        shippingAddress: form.shippingAddress || undefined,
        transportDetails: form.transportDetails || undefined,
        notes: form.notes || undefined,
        poKind: kind,
        items: form.items.map(l => ({
          ...l,
          colourId: l.colourId || undefined,
          fabricId: l.fabricId || undefined,
          accessoryId: l.accessoryId || undefined,
          weightGsm: l.weightGsm || undefined,
          widthInches: l.widthInches || undefined,
        })),
      }
      if (editingId) {
        await purchaseOrdersApi.update(editingId, payload)
      } else {
        await purchaseOrdersApi.create(payload)
      }
      setShowForm(false)
      load(filter || undefined)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const updateStatus = (po: PoSummary, newStatus: string) => {
    const action = newStatus === 'OPEN' ? 'Open' : 'Close'
    showConfirm(
      `${action} Purchase Order`,
      `${action} PO ${po.poNumber} for ${po.purchasePartyName ?? 'purchase party'}?`,
      async () => {
        try { await purchaseOrdersApi.updateStatus(po.id, newStatus); load(filter || undefined) }
        catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Status Update Failed', e.message) }
      },
      action
    )
  }

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">{isAccessory ? 'Accessory Purchase Orders' : 'Fabric Purchase Orders'}</div>
          <div className="page-subtitle">{pos.length} orders</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />New PO</button>
      </div>

      {showForm && (
        <Modal title={editingId ? `Edit ${isAccessory ? 'Accessory' : 'Fabric'} PO (Draft)` : `New ${isAccessory ? 'Accessory' : 'Fabric'} Purchase Order`} onClose={() => setShowForm(false)} width={980}>
          <FormError message={error} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Purchase Party *</label>
              <select
                value={form.purchasePartyId ?? ''}
                onChange={e => {
                  const purchasePartyId = e.target.value
                  setForm(p => ({
                    ...p,
                    purchasePartyId,
                    items: isAccessory
                      ? p.items.map(line => ({ ...line, accessoryId: '' }))
                      : p.items.map(line => ({ ...line, fabricId: '', colourId: '' })),
                  }))
                }}
              >
                <option value="">Select purchase party</option>
                {parties.map(b => <option key={b.id} value={b.id}>{b.partyName}</option>)}
              </select>
              {(() => {
                const party = parties.find(p => p.id === form.purchasePartyId)
                return party?.gstNumber
                  ? <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>GST: <strong>{party.gstNumber}</strong></div>
                  : null
              })()}
            </div>
            <div className="form-group">
              <label>PO Date *</label>
              <input type="date" value={form.poDate} onChange={e => setForm(p => ({ ...p, poDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>School Order *</label>
              <select
                value={form.schoolOrderId}
                onChange={e => {
                  const newSoId = e.target.value
                  setForm(p => ({
                    ...p,
                    schoolOrderId: newSoId,
                    items: p.items.map(line => {
                      if (!line.fabricId || !newSoId) return line
                      const so = schoolOrders.find(s => s.id === newSoId)
                      const fab = fabrics.find(f => f.id === line.fabricId)
                      if (so && fab && fab.composition > 0) {
                        return { ...line, orderedQuantity: parseFloat((so.totalQuantity * fab.composition).toFixed(2)) }
                      }
                      return line
                    }),
                  }))
                }}
                style={{ borderColor: !form.schoolOrderId ? '#fca5a5' : undefined }}
              >
                <option value="">— Select school order —</option>
                {schoolOrders.map(so => (
                  <option key={so.id} value={so.id}>
                    {so.orderNumber} — {so.schoolName}
                  </option>
                ))}
              </select>
              {form.schoolOrderId && (() => {
                const so = schoolOrders.find(s => s.id === form.schoolOrderId)
                return so ? (
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                    {so.schoolName} · {so.itemCount} items · {so.totalQuantity} pcs
                  </div>
                ) : null
              })()}
            </div>
            <div className="form-group">
              <label>Expected Delivery</label>
              <input
                type="date"
                value={form.expectedDeliveryDate ?? ''}
                onChange={e => setForm(p => ({ ...p, expectedDeliveryDate: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Shipping Address</label>
              <select
                value={PRESET_ADDRESSES.includes(form.shippingAddress ?? '') ? (form.shippingAddress ?? '') : CUSTOM_SENTINEL}
                onChange={e => {
                  if (e.target.value === CUSTOM_SENTINEL) {
                    setForm(p => ({ ...p, shippingAddress: '' }))
                  } else {
                    setForm(p => ({ ...p, shippingAddress: e.target.value }))
                  }
                }}
                style={{ marginBottom: 6 }}
              >
                {PRESET_ADDRESSES.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
                <option value={CUSTOM_SENTINEL}>✏️ Enter custom address…</option>
              </select>
              {/* Show textarea only for custom, or always for editing preset */}
              {(!PRESET_ADDRESSES.includes(form.shippingAddress ?? '') || form.shippingAddress === '') && (
                <textarea
                  rows={2}
                  placeholder="Type full shipping address…"
                  value={form.shippingAddress ?? ''}
                  onChange={e => setForm(p => ({ ...p, shippingAddress: e.target.value }))}
                />
              )}
            </div>
            <div className="form-group">
              <label>Transport</label>
              <select
                value={PRESET_TRANSPORTS.includes(form.transportDetails ?? '') ? (form.transportDetails ?? '') : CUSTOM_SENTINEL}
                onChange={e => {
                  if (e.target.value === CUSTOM_SENTINEL) {
                    setForm(p => ({ ...p, transportDetails: '' }))
                  } else {
                    setForm(p => ({ ...p, transportDetails: e.target.value }))
                  }
                }}
                style={{ marginBottom: 6 }}
              >
                {PRESET_TRANSPORTS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value={CUSTOM_SENTINEL}>✏️ Enter custom transport…</option>
              </select>
              {(!PRESET_TRANSPORTS.includes(form.transportDetails ?? '') || form.transportDetails === '') && (
                <textarea
                  rows={1}
                  placeholder="e.g. DTDC @ Salem, Own vehicle…"
                  value={form.transportDetails ?? ''}
                  onChange={e => setForm(p => ({ ...p, transportDetails: e.target.value }))}
                />
              )}
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea
                rows={2}
                value={form.notes ?? ''}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{isAccessory ? 'Accessory Lines' : 'Fabric Lines'}</div>
            {isAccessory ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 0.9fr 0.9fr 0.9fr auto', gap: 8, marginBottom: 6, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                  <span>Accessory</span>
                  <span>UOM</span>
                  <span>Quantity</span>
                  <span>Price</span>
                  <span />
                </div>
                {form.items.map((line, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2.4fr 0.9fr 0.9fr 0.9fr auto', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <select
                      value={line.accessoryId ?? ''}
                      onChange={e => updateLine(idx, { accessoryId: e.target.value })}
                      disabled={!form.purchasePartyId}
                    >
                      <option value="">{form.purchasePartyId ? 'Accessory *' : 'Select purchase party first'}</option>
                      {accessories.map(a => <option key={a.id} value={a.id}>{a.accessoryCode} — {a.accessoryName}</option>)}
                    </select>
                    <select value={line.unitOfMeasure} onChange={e => updateLine(idx, { unitOfMeasure: e.target.value })}>
                      {ACC_UOMS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <input type="number" placeholder="Qty *" value={line.orderedQuantity || ''} onChange={e => updateLine(idx, { orderedQuantity: Number(e.target.value) })} />
                    <input type="number" step="0.01" placeholder="Price" value={line.unitPrice || ''} onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })} />
                    <button type="button" className="btn-icon" title="Remove line" style={{ color: '#dc2626' }} onClick={() => deleteLine(idx)} disabled={form.items.length === 1}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr 0.9fr 0.9fr 0.8fr 0.8fr auto', gap: 8, marginBottom: 6, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              <span>Fabric</span>
              <span>Colour / Shade</span>
              <span>UOM</span>
              <span>Meters</span>
              <span>Price</span>
              <span>GSM</span>
              <span>Width</span>
              <span />
            </div>
            {form.items.map((line, idx) => {
              const selectedFab = fabrics.find(f => f.id === line.fabricId)
              const selectedSo  = schoolOrders.find(s => s.id === form.schoolOrderId)
              const autoCalcHint = selectedFab && selectedSo && selectedFab.composition > 0
                ? `${selectedSo.totalQuantity} qty × ${selectedFab.composition} = ${parseFloat((selectedSo.totalQuantity * selectedFab.composition).toFixed(2))} m`
                : null
              return (
                <div key={idx} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr 0.9fr 0.9fr 0.8fr 0.8fr auto', gap: 8, alignItems: 'center' }}>
                    <select
                      value={line.fabricId}
                      onChange={e => updateLine(idx, { fabricId: e.target.value })}
                      disabled={!form.purchasePartyId}
                    >
                      <option value="">{form.purchasePartyId ? 'Fabric *' : 'Select purchase party first'}</option>
                      {fabrics.map(f => <option key={f.id} value={f.id}>{f.fabricCode} — {f.fabricName}</option>)}
                    </select>
                    <select value={line.colourId ?? ''} onChange={e => updateLine(idx, { colourId: e.target.value })}>
                      <option value="">Shade</option>
                      {colours.map(c => <option key={c.id} value={c.id}>{c.colourName}</option>)}
                    </select>
                    <select value={line.unitOfMeasure} onChange={e => updateLine(idx, { unitOfMeasure: e.target.value })}>
                      <option value="METER">METER</option>
                      <option value="KG">KG</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Meters *"
                      value={line.orderedQuantity || ''}
                      onChange={e => updateLine(idx, { orderedQuantity: Number(e.target.value) })}
                      style={{ borderColor: autoCalcHint ? 'var(--navy)' : undefined }}
                    />
                    <input type="number" step="0.01" placeholder="Price" value={line.unitPrice || ''} onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })} />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="GSM"
                      value={line.weightGsm ?? ''}
                      onChange={e => updateLine(idx, { weightGsm: e.target.value === '' ? undefined : Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Width"
                      value={line.widthInches ?? ''}
                      onChange={e => updateLine(idx, { widthInches: e.target.value === '' ? undefined : Number(e.target.value) })}
                    />
                    <button
                      type="button"
                      className="btn-icon"
                      title="Remove line"
                      style={{ color: '#dc2626' }}
                      onClick={() => deleteLine(idx)}
                      disabled={form.items.length === 1}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {autoCalcHint && (
                    <div style={{ fontSize: 11, color: 'var(--navy)', marginTop: 3, paddingLeft: 2, fontStyle: 'italic' }}>
                      Auto-calculated: {autoCalcHint}
                    </div>
                  )}
                </div>
              )
            })}
              </>
            )}
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setForm(p => ({ ...p, items: [...p.items, emptyLine(kind)] }))}>
              + Add line
            </button>
          </div>

          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <div className="card">
        <FilterBar
          filters={[{ label: 'Status', options: ALL_STATUSES.map(s => ({ value: s, label: s.replace('_', ' ') })), value: filter, onChange: handleFilter, allLabel: 'All statuses' }]}
          search={{ placeholder: 'PO number, party, sales order…', value: search, onChange: setSearch }}
          count={displayedPos.length} countLabel="orders"
        />
        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Sales Order</th>
                <th>Purchase Party</th>
                <th>Date</th>
                <th>Expected</th>
                <th>Items</th>
                <th>Status</th>
                <th style={{ width: 160 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedPos.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <FileText size={40} />
                      <p>No {isAccessory ? 'accessory' : 'fabric'} purchase orders yet. Create your first PO.</p>
                    </div>
                  </td>
                </tr>
              ) : displayedPos.map(po => (
                <tr
                  key={po.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`${listPath}/${po.id}`)}
                >
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{po.poNumber}</td>
                  <td style={{ fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{po.schoolOrderNumber ?? '—'}</div>
                    {po.schoolName && <div style={{ color: 'var(--text-muted)' }}>{po.schoolName}</div>}
                  </td>
                  <td>{po.purchasePartyName ?? '—'}</td>
                  <td>{po.poDate}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{(po as any).expectedDeliveryDate ?? '—'}</td>
                  <td>{po.itemCount} item{po.itemCount !== 1 ? 's' : ''}</td>
                  <td>
                    <span className={`badge ${statusBadge(po.status)}`}>
                      {po.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {po.status === 'DRAFT' && (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => updateStatus(po, 'OPEN')}>Open PO</button>
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(po)}><Pencil size={14} /></button>
                          <button className="btn-icon" title="Delete" style={{ color: '#dc2626' }} onClick={() => deletePo(po)}><Trash2 size={14} /></button>
                        </>
                      )}
                      {po.status === 'OPEN' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => updateStatus(po, 'CLOSED')}>Close</button>
                      )}
                    </div>
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
