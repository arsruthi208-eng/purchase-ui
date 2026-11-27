import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Trash2, Pencil } from '../icons'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { purchaseOrdersApi, type PoSummary, type CreatePoRequest } from '../api/purchaseOrders'
import { purchasePartiesApi, type PurchaseParty } from '../api/purchaseParties'
import { accessoriesApi, type Accessory } from '../api/accessories'
import { fabricsApi, type Fabric } from '../api/fabrics'
import { coloursApi, type Colour } from '../api/colours'
import { schoolOrdersApi, type SchoolOrderSummary, type SchoolOrderDetail } from '../api/schoolOrders'
import { stylesApi, type Style } from '../api/styles'
import { useApiList } from '../hooks/useApiData'
import { PresetOrCustomSelect, Modal, FormError, FormActions, statusBadge, today, LoadError, FilterBar, SortableTh } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'
import { shortUnit, UOM_PRESETS } from '../utils/units'

const ALL_STATUSES = ['DRAFT', 'OPEN', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED']

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
  const { data: styles } = useApiList<Style>(() => stylesApi.list())
  const [orderDetails, setOrderDetails] = useState<Record<string, SchoolOrderDetail>>({})
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreatePoRequest>({
    purchasePartyId: '',
    schoolOrderIds: [],
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

  const [sortDesc, setSortDesc] = useState(true)
  const displayedPos = (search
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
  ).slice().sort((a, b) =>
    sortDesc ? b.poDate.localeCompare(a.poDate) : a.poDate.localeCompare(b.poDate)
  )

  const openCreate = () => {
    setEditingId(null)
    setForm({
      purchasePartyId: '',
      schoolOrderIds: [],
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
        schoolOrderIds: detail.schoolOrders?.length ? detail.schoolOrders.map(o => o.id) : (detail.schoolOrderId ? [detail.schoolOrderId] : []),
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

  const styleRate = useMemo(() => {
    const m: Record<string, number | undefined> = {}
    styles.forEach(st => { m[st.id] = st.fabricConsumptionRate })
    return m
  }, [styles])

  // Fetch item detail for every selected school order (needed for the per-style breakdown)
  useEffect(() => {
    form.schoolOrderIds.forEach(id => {
      if (orderDetails[id]) return
      schoolOrdersApi.getById(id)
        .then(d => setOrderDetails(p => ({ ...p, [id]: d })))
        .catch(() => { /* panel shows loading state */ })
    })
  }, [form.schoolOrderIds, orderDetails])

  /** Per-order, per-style requirement: qty x style consumption rate */
  const requirement = useMemo(() => {
    const orders = form.schoolOrderIds.map(id => {
      const sum = schoolOrders.find(o => o.id === id)
      const det = orderDetails[id]
      const rows = (det?.items ?? []).map(i => {
        const rate = styleRate[i.styleId]
        return { key: i.id, styleId: i.styleId, styleName: i.styleName, gender: i.gender, standard: i.standard,
          qty: i.quantity, rate, meters: parseFloat(((rate ?? 0) * i.quantity).toFixed(2)) }
      })
      return { id, label: sum ? sum.orderNumber : id, school: sum?.schoolName ?? det?.schoolName ?? '', subject: sum?.subject ?? det?.subject,
        orderDate: sum?.orderDate ?? det?.orderDate ?? '', loaded: !!det, rows,
        qty: rows.reduce((a, r) => a + r.qty, 0), meters: parseFloat(rows.reduce((a, r) => a + r.meters, 0).toFixed(2)) }
    })
    return {
      orders,
      totalQty: orders.reduce((a, o) => a + o.qty, 0),
      totalMeters: parseFloat(orders.reduce((a, o) => a + o.meters, 0).toFixed(2)),
      missingRate: orders.some(o => o.rows.some(r => r.rate == null)),
      loading: orders.some(o => !o.loaded),
    }
  }, [form.schoolOrderIds, orderDetails, schoolOrders, styleRate])

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
          if (fab) updated.unitOfMeasure = fab.unitOfMeasure
          updated.weightGsm = fab?.weightGsm
          updated.widthInches = fab?.widthInches
          if (!isAccessory && !updated.orderedQuantity && requirement.totalMeters > 0) {
            updated.orderedQuantity = requirement.totalMeters
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
    if (form.schoolOrderIds.length === 0) { setError('Add at least one school order — a PO must be linked to a school order'); return }
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
        schoolOrderId: form.schoolOrderIds[0],
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
              <SearchableSelect
                value={form.purchasePartyId ?? ''}
                onChange={purchasePartyId => {
                  setForm(p => ({
                    ...p,
                    purchasePartyId,
                    items: isAccessory
                      ? p.items.map(line => ({ ...line, accessoryId: '' }))
                      : p.items.map(line => ({ ...line, fabricId: '', colourId: '' })),
                  }))
                }}
                placeholder="Select purchase party"
                options={parties.map(b => ({ value: b.id, label: b.partyName }))}
              />
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
              <label>School Orders * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(add more than one if needed)</span></label>
              <SearchableSelect
                value=""
                onChange={id => { if (id) setForm(p => p.schoolOrderIds.includes(id) ? p : ({ ...p, schoolOrderIds: [...p.schoolOrderIds, id] })) }}
                placeholder={form.schoolOrderIds.length ? '+ Add another school order' : '— Select school order —'}
                options={schoolOrders
                  .filter(so => !form.schoolOrderIds.includes(so.id))
                  .map(so => ({ value: so.id, label: `${so.orderNumber} — ${so.schoolName}`, sublabel: so.subject }))}
                style={{ borderColor: form.schoolOrderIds.length === 0 ? '#fca5a5' : undefined }}
              />
              {form.schoolOrderIds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {form.schoolOrderIds.map(id => {
                    const so = schoolOrders.find(s => s.id === id)
                    return (
                      <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 14, padding: '2px 10px', fontSize: 12 }}>
                        <strong>{so?.orderNumber ?? id}</strong>
                        {so && <span style={{ color: 'var(--text-muted)' }}>{so.schoolName} · {so.totalQuantity} pcs</span>}
                        {so?.subject && <span style={{ color: 'var(--text-muted)', fontSize: 10 }} title={so.subject}>· {so.subject.length > 40 ? so.subject.slice(0, 40) + '…' : so.subject}</span>}
                        <button type="button" title="Remove" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14, lineHeight: 1, padding: 0 }}
                          onClick={() => setForm(p => ({ ...p, schoolOrderIds: p.schoolOrderIds.filter(x => x !== id) }))}>×</button>
                      </span>
                    )
                  })}
                </div>
              )}
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
              <PresetOrCustomSelect
                value={form.shippingAddress ?? ''}
                onChange={v => setForm(p => ({ ...p, shippingAddress: v }))}
                presets={PRESET_ADDRESSES}
                placeholder="Select address"
                customLabel="Enter custom address…"
                customPlaceholder="Type full shipping address…"
                multiline
              />
            </div>
            <div className="form-group">
              <label>Transport</label>
              <PresetOrCustomSelect
                value={form.transportDetails ?? ''}
                onChange={v => setForm(p => ({ ...p, transportDetails: v }))}
                presets={PRESET_TRANSPORTS}
                placeholder="Select transport"
                customLabel="Enter custom transport…"
                customPlaceholder="e.g. DTDC @ Salem, Own vehicle…"
                multiline
              />
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

          {!isAccessory && requirement.orders.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 14, background: '#f8fafc' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{isAccessory ? 'School Orders Summary' : 'Fabric Requirement by Style'}</div>
              {requirement.orders.map(o => (
                <div key={o.id} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    {o.label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {o.school}{o.orderDate ? ` · ${o.orderDate}` : ''}{o.subject ? <span style={{ fontSize: 11 }}> · {o.subject}</span> : null}</span>
                  </div>
                  {!o.loaded ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div> : (
                    <table style={{ width: '100%', fontSize: 12 }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)' }}>
                          <th style={{ textAlign: 'left' }}>Style</th><th style={{ textAlign: 'left' }}>Gender / Std</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          {!isAccessory && <><th style={{ textAlign: 'right' }}>Rate (m/pc)</th><th style={{ textAlign: 'right' }}>Required (m)</th></>}
                        </tr>
                      </thead>
                      <tbody>
                        {o.rows.map(r => (
                          <tr key={r.key}>
                            <td>{r.styleName}</td>
                            <td>{[r.gender, r.standard].filter(Boolean).join(' / ') || '—'}</td>
                            <td style={{ textAlign: 'right' }}>{r.qty}</td>
                            {!isAccessory && <>
                              <td style={{ textAlign: 'right', color: r.rate == null ? '#dc2626' : undefined }}>{r.rate ?? 'not set'}</td>
                              <td style={{ textAlign: 'right' }}>{r.meters.toLocaleString()}</td>
                            </>}
                          </tr>
                        ))}
                        <tr style={{ fontWeight: 600, borderTop: '1px solid var(--border)' }}>
                          <td colSpan={2}>Subtotal</td>
                          <td style={{ textAlign: 'right' }}>{o.qty}</td>
                          {!isAccessory && <><td /><td style={{ textAlign: 'right' }}>{o.meters.toLocaleString()}</td></>}
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13, borderTop: '2px solid var(--border)', paddingTop: 6 }}>
                <span>Total ({requirement.orders.length} order{requirement.orders.length !== 1 ? 's' : ''}) · {requirement.totalQty} pcs</span>
                {!isAccessory ? <span>{requirement.totalMeters.toLocaleString()} m required</span> : <span />}
              </div>
              {!isAccessory && requirement.missingRate && (
                <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Some styles have no consumption rate set in Style master; they count as 0 m.</div>
              )}
            </div>
          )}

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
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2.4fr 0.9fr 0.9fr 0.9fr auto', gap: 8, alignItems: 'start', marginBottom: 10 }}>
                    <SearchableSelect
                      value={line.accessoryId ?? ''}
                      onChange={v => updateLine(idx, { accessoryId: v })}
                      placeholder={form.purchasePartyId ? 'Accessory *' : 'Select purchase party first'}
                      disabled={!form.purchasePartyId}
                      options={accessories.map(a => ({ value: a.id, label: `${a.accessoryCode} — ${a.accessoryName}` }))}
                    />
                    <PresetOrCustomSelect
                      value={line.unitOfMeasure ?? ''}
                      onChange={v => updateLine(idx, { unitOfMeasure: v })}
                      presets={[...UOM_PRESETS]}
                      placeholder="Unit"
                      customLabel="Enter custom unit…"
                      customPlaceholder="e.g. MTR, DOZEN"
                      maxLength={20}
                      transform={v => v.toUpperCase()}
                    />
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
              <span>Quantity</span>
              <span>Price</span>
              <span>GSM</span>
              <span>Width</span>
              <span />
            </div>
            {form.items.map((line, idx) => {
              const autoCalcHint = requirement.totalMeters > 0 ? `${requirement.totalMeters.toLocaleString()} m` : null
              return (
                <div key={idx} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr 0.9fr 0.9fr 0.8fr 0.8fr auto', gap: 8, alignItems: 'center' }}>
                    <SearchableSelect
                      value={line.fabricId ?? ''}
                      onChange={v => updateLine(idx, { fabricId: v })}
                      placeholder={form.purchasePartyId ? 'Fabric *' : 'Select purchase party first'}
                      disabled={!form.purchasePartyId}
                      options={fabrics.map(f => ({ value: f.id, label: `${f.fabricCode} — ${f.fabricName}` }))}
                    />
                    <SearchableSelect
                      value={line.colourId ?? ''}
                      onChange={v => updateLine(idx, { colourId: v })}
                      placeholder="Shade"
                      options={colours.map(c => ({ value: c.id, label: c.colourName }))}
                    />
                    <select value={line.unitOfMeasure} onChange={e => updateLine(idx, { unitOfMeasure: e.target.value })}>
                      <option value="METER">METER</option>
                      <option value="KG">KG</option>
                    </select>
                    <input
                      type="number"
                      placeholder={`Qty (${shortUnit(line.unitOfMeasure)}) *`}
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
                  {autoCalcHint && line.orderedQuantity !== requirement.totalMeters && (
                    <div style={{ fontSize: 11, marginTop: 3, paddingLeft: 2 }}>
                      <button type="button" className="btn btn-sm btn-secondary" style={{ padding: '1px 8px', fontSize: 11 }}
                        onClick={() => updateLine(idx, { orderedQuantity: requirement.totalMeters })}>
                        Use total required ({autoCalcHint})
                      </button>
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
                <SortableTh label="Date" desc={sortDesc} onToggle={() => setSortDesc(p => !p)} />
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
                    <div style={{ fontWeight: 600 }}>{po.schoolOrderNumbers?.length ? po.schoolOrderNumbers.join(', ') : (po.schoolOrderNumber ?? '—')}</div>
                    {(po.schoolNames?.length || po.schoolName) && <div style={{ color: 'var(--text-muted)' }}>{po.schoolNames?.length ? po.schoolNames.join(', ') : po.schoolName}</div>}
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
