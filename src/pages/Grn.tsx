import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from '../icons'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { grnApi, type GrnSummary, type CreateGrnRequest, type CreateGrnItemRequest } from '../api/grn'
import { type RollEntry, fabricRollsApi } from '../api/fabricRolls'
import { purchaseOrdersApi, type PoSummary } from '../api/purchaseOrders'
import { GrnBillForm, emptyBill, billTouched, billToRequest, type BillFormState } from '../components/GrnBillForm'
import { purchasePartiesApi, type PurchaseParty } from '../api/purchaseParties'
import { useApiList } from '../hooks/useApiData'
import { Modal, FormError, FormActions, statusBadge, today, LoadError, FilterBar, SortableTh } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { fabricsApi, type Fabric } from '../api/fabrics'
import { accessoriesApi, type Accessory } from '../api/accessories'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'
import { shortUnit, unitWord, sharedUnitSuffix } from '../utils/units'

/** Per-fabric-line form state including rolls */
interface LineState {
  kind: 'FABRIC' | 'ACCESSORY'
  accessoryId?: string
  /** Accessory lines: quantity received in this GRN */
  receivedQty: number
  fabricId: string
  fabricLabel: string
  orderedMeters: number
  /** Already received on earlier confirmed GRNs of this PO */
  receivedEarlier: number
  unitPrice: number
  unitOfMeasure: string
  rolls: RollEntry[]
  startRollNo: number
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0 12px', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--navy)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--navy)' }}>{title}</span>
    </div>
  )
}

const emptyLine = (): LineState => ({ kind: 'FABRIC', receivedQty: 0, fabricId: '', fabricLabel: '', orderedMeters: 0, receivedEarlier: 0, unitPrice: 0, unitOfMeasure: 'METER', rolls: [], startRollNo: 1 })

/** Sentinel value of the PO dropdown meaning "no PO — small purchase / sample" */
const SAMPLE = '__SAMPLE__'

const emptyAccessoryLine = (): LineState => ({ ...emptyLine(), kind: 'ACCESSORY', accessoryId: '', unitOfMeasure: 'PCS' })

export default function Grn() {
  const navigate = useNavigate()
  const [items, setItems] = useState<GrnSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [search, setSearch] = useState('')
  const [partyFilter, setPartyFilter] = useState('')
  // A PO stays receivable after its first GRN (PARTIALLY_RECEIVED), so one PO can have many GRNs
  const { data: openPos } = useApiList<PoSummary>(async () => {
    const [fo, fp, ao, ap] = await Promise.all([
      purchaseOrdersApi.list('OPEN', 'FABRIC'), purchaseOrdersApi.list('PARTIALLY_RECEIVED', 'FABRIC'),
      purchaseOrdersApi.list('OPEN', 'ACCESSORY'), purchaseOrdersApi.list('PARTIALLY_RECEIVED', 'ACCESSORY'),
    ])
    return [...fp, ...fo, ...ap, ...ao]
  })
  const [poKind, setPoKind] = useState<'FABRIC' | 'ACCESSORY'>('FABRIC')
  const isAccessoryPo = poKind === 'ACCESSORY'
  const [loadingPo, setLoadingPo] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [poId, setPoId] = useState('')
  /** Sample mode: GRN raised without a PO (small purchases) */
  const isSample = poId === SAMPLE
  const [sampleParty, setSampleParty] = useState('')
  const { data: allFabrics } = useApiList<Fabric>(() => fabricsApi.list())
  const { data: allAccessories } = useApiList<Accessory>(() => accessoriesApi.list())
  const [receivedDate, setReceivedDate] = useState(today())
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineState[]>([emptyLine()])
  const [bill, setBill] = useState<BillFormState>(emptyBill(today()))
  const [qtyAuto, setQtyAuto] = useState(true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true)
    setLoadError('')
    grnApi.list()
      .then(setItems)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openCreate = () => {
    setPoId('')
    setSampleParty('')
    setPoKind('FABRIC')
    setReceivedDate(today())
    setVehicleNumber('')
    setNotes('')
    setLines([emptyLine()])
    setBill(emptyBill(today()))
    setQtyAuto(true)
    setError('')
    setShowForm(true)
  }

  /** When PO changes, fetch its fabric items and lock lines to those fabrics */
  const onPoChange = async (id: string) => {
    setPoId(id)
    setLines([emptyLine()])
    setBill(b => ({ ...b, price: '' }))
    setQtyAuto(true)
    if (!id) return
    if (id === SAMPLE) { setPoKind('FABRIC'); return }
    setLoadingPo(true)
    try {
      const detail = await purchaseOrdersApi.getById(id)
      const kind: 'FABRIC' | 'ACCESSORY' = detail.poKind === 'ACCESSORY' ? 'ACCESSORY' : 'FABRIC'
      setPoKind(kind)
      if (kind === 'ACCESSORY') {
        const accLines: LineState[] = detail.items.map(item => ({
          kind: 'ACCESSORY', accessoryId: item.accessoryId ?? '', receivedQty: 0, fabricId: '',
          fabricLabel: `${item.accessoryCode} — ${item.accessoryName}`,
          orderedMeters: item.orderedQuantity, receivedEarlier: item.receivedQuantity ?? 0,
          unitPrice: item.unitPrice ?? 0, unitOfMeasure: item.unitOfMeasure ?? 'PCS', rolls: [], startRollNo: 1,
        }))
        setLines(accLines.length > 0 ? accLines : [emptyLine()])
        const price = accLines.length === 1 ? accLines[0].unitPrice : 0
        setBill(b => ({ ...b, price: price ? String(price) : '' }))
        return
      }
      const fabrics = await fabricsApi.list().catch(() => [])
      const newLines = await Promise.all(
        detail.items.map(async item => {
          let startRollNo = 1
          try { startRollNo = await fabricRollsApi.nextRollNumber(item.fabricId ?? '') } catch { /* ignore */ }
          const fab = fabrics.find(f => f.id === item.fabricId)
          return {
            kind: 'FABRIC' as const,
            receivedQty: 0,
            fabricId: item.fabricId ?? '',
            fabricLabel: `${item.fabricCode} — ${item.fabricName}`,
            orderedMeters: item.orderedQuantity,
            receivedEarlier: item.receivedQuantity ?? 0,
            unitPrice: item.unitPrice ?? 0,
            unitOfMeasure: fab?.unitOfMeasure ?? item.unitOfMeasure ?? 'METER',
            rolls: [],
            startRollNo,
          } satisfies LineState
        })
      )
      setLines(newLines.length > 0 ? newLines : [emptyLine()])
      const price = newLines.length === 1 ? newLines[0].unitPrice : 0
      setBill(b => ({ ...b, price: price ? String(price) : '' }))
    } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Load PO Failed', e.message) }
    finally { setLoadingPo(false) }
  }

  const addRoll = (lineIdx: number) =>
    setLines(prev => prev.map((l, i) => i === lineIdx
      ? { ...l, rolls: [...l.rolls, { quantityMeters: 0, unitPrice: 0 }] }
      : l))

  const removeRoll = (lineIdx: number, rollIdx: number) =>
    setLines(prev => prev.map((l, i) => i === lineIdx
      ? { ...l, rolls: l.rolls.filter((_, ri) => ri !== rollIdx) }
      : l))

  const updateRollMeters = (lineIdx: number, rollIdx: number, val: number) =>
    setLines(prev => prev.map((l, i) => i === lineIdx
      ? { ...l, rolls: l.rolls.map((r, ri) => ri === rollIdx ? { ...r, quantityMeters: val } : r) }
      : l))

  const updateAccQty = (idx: number, val: number) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, receivedQty: val } : l))

  const updateAccPrice = (idx: number, val: number) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, unitPrice: val } : l))

  const changeSampleKind = (k: 'FABRIC' | 'ACCESSORY') => {
    setPoKind(k)
    setLines([k === 'ACCESSORY' ? emptyAccessoryLine() : emptyLine()])
    setBill(b => ({ ...b, price: '' }))
    setQtyAuto(true)
  }

  const patchLine = (idx: number, patch: Partial<LineState>) =>
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l))

  const addSampleLine = () =>
    setLines(prev => [...prev, isAccessoryPo ? emptyAccessoryLine() : emptyLine()])

  const removeSampleLine = (idx: number) =>
    setLines(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))

  const pickSampleAccessory = (idx: number, id: string) => {
    const a = allAccessories.find(x => x.id === id)
    patchLine(idx, { accessoryId: id, fabricLabel: a ? `${a.accessoryCode} — ${a.accessoryName}` : '', unitOfMeasure: a?.unitOfMeasure ?? 'PCS' })
  }

  const pickSampleFabric = async (idx: number, id: string) => {
    const f = allFabrics.find(x => x.id === id)
    patchLine(idx, { fabricId: id, fabricLabel: f ? `${f.fabricCode} — ${f.fabricName}` : '', unitOfMeasure: f?.unitOfMeasure ?? 'METER' })
    if (!id) return
    try { patchLine(idx, { startRollNo: await fabricRollsApi.nextRollNumber(id) }) } catch { /* ignore */ }
  }

  /** Amount of all lines that carry a rate (accessory lines, and fabric lines in sample mode) */
  const accTotalAmount = useMemo(
    () => lines.reduce((s, l) => s + (l.kind === 'ACCESSORY'
      ? l.receivedQty * l.unitPrice
      : isSample ? l.rolls.reduce((sr, r) => sr + r.quantityMeters, 0) * l.unitPrice : 0), 0), [lines, isSample])

  const totalReceivedNow = useMemo(
    () => lines.reduce((s, l) => s + (l.kind === 'ACCESSORY' ? l.receivedQty : l.rolls.reduce((sr, r) => sr + r.quantityMeters, 0)), 0), [lines])
  // Bill qty follows the received meters until the user types their own value
  useEffect(() => {
    if (qtyAuto) setBill(b => ({ ...b, qty: totalReceivedNow > 0 ? String(Math.round(totalReceivedNow * 1000) / 1000) : '' }))
  }, [totalReceivedNow, qtyAuto])

  // Accessory bill: price per unit = weighted average of the per-item prices, so Qty x Price = sum of line amounts
  useEffect(() => {
    if (!(isAccessoryPo || isSample) || totalReceivedNow <= 0 || accTotalAmount <= 0) return
    setBill(b => ({ ...b, price: String(Math.round((accTotalAmount / totalReceivedNow) * 10000) / 10000) }))
  }, [isAccessoryPo, isSample, totalReceivedNow, accTotalAmount])

  const save = async () => {
    if (!poId || !receivedDate) { setError('Purchase Order (or Sample) and received date are required'); return }
    if (isSample && !sampleParty) { setError('Purchase party is required for a sample GRN'); return }
    if (isAccessoryPo) {
      if (lines.some(l => !l.accessoryId)) { setError('Each line needs an accessory'); return }
      if (!lines.some(l => l.receivedQty > 0)) { setError('Enter the received quantity for at least one accessory'); return }
    } else {
      if (lines.some(l => !l.fabricId)) { setError('Each line needs a fabric selected'); return }
      if (lines.some(l => l.rolls.length === 0)) { setError('Each line needs at least one roll'); return }
      if (lines.some(l => l.rolls.some(r => r.quantityMeters <= 0))) { setError('Every roll must have a quantity greater than 0'); return }
    }

    const withBill = billTouched(bill)
    if (withBill && !bill.billNo.trim()) { setError('Bill No is required when bill details are entered'); return }
    if (withBill && !bill.billDate) { setError('Bill Date is required'); return }
    const payload: CreateGrnRequest = {
      ...(isSample ? { purchasePartyId: sampleParty, grnKind: poKind } : { poId }),
      receivedDate,
      vehicleNumber: vehicleNumber || undefined,
      notes: notes || undefined,
      bill: withBill ? billToRequest(bill) : undefined,
      items: isAccessoryPo
        ? lines.filter(l => l.receivedQty > 0).map(l => ({
            accessoryId: l.accessoryId,
            receivedQuantity: l.receivedQty,
            unitPrice: l.unitPrice,
          }) satisfies CreateGrnItemRequest)
        : lines.map(l => ({
            fabricId: l.fabricId,
            receivedQuantity: 0,   // derived server-side from roll sum
            ...(isSample ? { unitPrice: l.unitPrice } : {}),
            rolls: l.rolls,
          }) satisfies CreateGrnItemRequest),
    }
    setSaving(true); setError('')
    try {
      await grnApi.create(payload)
      setShowForm(false); load()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const confirmGrn = (id: string) => {
    showConfirm(
      'Confirm GRN',
      'Stock (and fabric roll records) will be updated. This cannot be undone.',
      async () => { try { await grnApi.confirm(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } }
    )
  }

  const deleteGrn = (g: GrnSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    showConfirm(
      'Delete GRN',
      `Permanently delete ${g.grnNumber}? This cannot be undone.`,
      async () => {
        try { await grnApi.delete(g.id); load() }
        catch (err: any) { isForbiddenError(err) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Delete Failed', err.response?.data?.message ?? err.message) }
      }
    )
  }

  // All purchase parties (fabric + accessory) for the party dropdown
  const { data: parties } = useApiList<PurchaseParty>(() => purchasePartiesApi.list())
  const partyOptions = useMemo(
    () => parties.map(p => ({ value: p.id, label: p.partyName })).sort((a, b) => a.label.localeCompare(b.label)),
    [parties])

  const [sortDesc, setSortDesc] = useState(true)
  const filtered = items.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false
    if (kindFilter && r.grnKind !== kindFilter) return false
    if (partyFilter && r.purchasePartyId !== partyFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(r.grnNumber.toLowerCase().includes(q) || r.poNumber.toLowerCase().includes(q) || (r.isSample && 'sample'.includes(q)) ||
            (r.purchasePartyName ?? '').toLowerCase().includes(q))) return false
    }
    return true
  })
  const sorted = [...filtered].sort((a, b) =>
    sortDesc ? b.receivedDate.localeCompare(a.receivedDate) : a.receivedDate.localeCompare(b.receivedDate)
  )

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Goods Received Notes</div>
          <div className="page-subtitle">{items.length} GRNs</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />New GRN</button>
      </div>

      {showForm && (
        <Modal title="New GRN" onClose={() => setShowForm(false)} width={860}>
          <FormError message={error} />
          <SectionTitle n={1} title="Receipt Details" />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Purchase Order *</label>
              <SearchableSelect
                value={poId}
                onChange={onPoChange}
                placeholder="Select open / partially received PO, or Sample (No PO)"
                disabled={loadingPo}
                options={[{ value: SAMPLE, label: 'Sample (No PO)', sublabel: 'Small purchase — no purchase order needed' }, ...openPos.map(po => ({ value: po.id, label: `${po.poNumber} — ${po.purchasePartyName ?? 'No party'}`, sublabel: po.poKind === 'ACCESSORY' ? 'Accessory PO' : 'Fabric PO' }))]}
              />
              {loadingPo && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Loading PO lines…</div>}
            </div>
            <div className="form-group">
              <label>Received Date *</label>
              <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
            </div>
            {isSample && (
              <>
                <div className="form-group">
                  <label>Purchase Party *</label>
                  <SearchableSelect value={sampleParty} onChange={setSampleParty} placeholder="Select purchase party" options={partyOptions} />
                </div>
                <div className="form-group">
                  <label>Kind *</label>
                  <select value={poKind} onChange={e => changeSampleKind(e.target.value as 'FABRIC' | 'ACCESSORY')}>
                    <option value="FABRIC">Fabric</option>
                    <option value="ACCESSORY">Accessory</option>
                  </select>
                </div>
              </>
            )}
            <div className="form-group">
              <label>Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional remarks" />
            </div>
            <div className="form-group">
              <label>Vehicle Number</label>
              <input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. TN 01 AB 1234" />
            </div>
          </div>

          <SectionTitle n={2} title="Goods Received" />

          {/* ── Fabric Lines ── */}
          {isSample ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {lines.map((line, idx) => {
                const unit = shortUnit(line.unitOfMeasure)
                const rollsTotal = line.rolls.reduce((s, r) => s + r.quantityMeters, 0)
                const qty = isAccessoryPo ? line.receivedQty : rollsTotal
                const inputStyle = { padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right' as const }
                return (
                  <div key={idx} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)', padding: '10px 16px', background: '#fff' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isAccessoryPo ? '1fr 120px 120px 110px 32px' : '1fr 120px 110px 32px', gap: 10, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>{isAccessoryPo ? 'Accessory' : 'Fabric'}</div>
                        {isAccessoryPo ? (
                          <SearchableSelect value={line.accessoryId ?? ''} onChange={v => pickSampleAccessory(idx, v)} placeholder="Select accessory"
                            options={allAccessories.map(a => ({ value: a.id, label: `${a.accessoryCode} — ${a.accessoryName}`, sublabel: a.typeName }))} />
                        ) : (
                          <SearchableSelect value={line.fabricId} onChange={v => pickSampleFabric(idx, v)} placeholder="Select fabric"
                            options={allFabrics.map(f => ({ value: f.id, label: `${f.fabricCode} — ${f.fabricName}`, sublabel: f.fabricType }))} />
                        )}
                      </div>
                      {isAccessoryPo && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>Qty ({unit})</div>
                          <input type="number" min="0" step="any" placeholder="Qty" value={line.receivedQty || ''}
                            onChange={e => updateAccQty(idx, Number(e.target.value))} style={{ ...inputStyle, width: 100 }} />
                        </div>
                      )}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>Rate / {unit}</div>
                        <input type="number" min="0" step="any" placeholder="₹ rate" value={line.unitPrice || ''}
                          onChange={e => updateAccPrice(idx, Number(e.target.value))} style={{ ...inputStyle, width: 100 }} />
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>Amount</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', padding: '5px 0' }}>
                          {(qty * line.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <button type="button" title="Remove item" disabled={lines.length <= 1} onClick={() => removeSampleLine(idx)}
                        style={{ background: 'none', border: 'none', cursor: lines.length <= 1 ? 'default' : 'pointer', color: lines.length <= 1 ? '#d1d5db' : '#dc2626', padding: 4, marginTop: 16 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {!isAccessoryPo && (
                      <div style={{ padding: '8px 0 0' }}>
                        {line.rolls.length > 0 && (
                          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 8 }}>
                            <tbody>
                              {line.rolls.map((r, ri) => (
                                <tr key={ri}>
                                  <td style={{ padding: '3px 8px', width: 80 }}>
                                    <span style={{ display: 'inline-block', minWidth: 36, padding: '2px 8px', background: 'var(--navy)', color: '#fff', borderRadius: 10, fontFamily: 'monospace', fontWeight: 700, fontSize: 12, textAlign: 'center' }}>
                                      {line.startRollNo + ri}
                                    </span>
                                  </td>
                                  <td style={{ padding: '3px 8px' }}>
                                    <input type="number" step="0.01" min="0.01" placeholder="e.g. 40.80" value={r.quantityMeters || ''}
                                      onChange={e => updateRollMeters(idx, ri, Number(e.target.value))}
                                      style={{ width: 140, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }} />
                                    <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-muted)' }}>{unit}</span>
                                  </td>
                                  <td style={{ width: 32 }}>
                                    <button type="button" onClick={() => removeRoll(idx, ri)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}>
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        <button type="button" onClick={() => addRoll(idx)}
                          style={{ fontSize: 12, padding: '4px 12px', cursor: 'pointer', background: '#fff', border: '1px dashed var(--navy)', color: 'var(--navy)', borderRadius: 6, fontWeight: 600 }}>
                          + Add Roll
                        </button>
                        {rollsTotal > 0 && <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-muted)' }}>Total {rollsTotal.toFixed(2)} {unit}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
              <div style={{ padding: '8px 16px', background: '#f8fafc', borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" onClick={addSampleLine}
                  style={{ fontSize: 12, padding: '4px 12px', cursor: 'pointer', background: '#fff', border: '1px dashed var(--navy)', color: 'var(--navy)', borderRadius: 6, fontWeight: 600 }}>
                  + Add Item
                </button>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                  TOTAL Qty {totalReceivedNow.toLocaleString()} · Amount {accTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          ) : !poId ? (
            <div style={{
              fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center',
              border: '1px dashed var(--border)', borderRadius: 8,
            }}>
              Select a Purchase Order above — its fabric / accessory lines will load automatically.
            </div>
          ) : (
            isAccessoryPo ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px 120px 110px 110px', background: '#f1f5f9', padding: '8px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div>Accessory</div>
                <div style={{ textAlign: 'right' }}>Ordered</div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Prev. Recd</div>
                <div style={{ textAlign: 'right' }}>Balance</div>
                <div style={{ textAlign: 'right' }}>Qty (This GRN)</div>
                <div style={{ textAlign: 'right' }}>Price / Unit</div>
                <div style={{ textAlign: 'right' }}>Amount</div>
              </div>
              {lines.map((line, idx) => {
                const unit = shortUnit(line.unitOfMeasure)
                const balance = line.orderedMeters - line.receivedEarlier
                const diff = line.receivedQty - balance
                return (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px 120px 110px 110px', padding: '10px 16px', alignItems: 'center', borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)' }}>{line.fabricLabel}</div>
                    <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>{line.orderedMeters.toLocaleString()} {unit}</div>
                    <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>{line.receivedEarlier.toLocaleString()} {unit}</div>
                    <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: balance > 0 ? '#b45309' : '#16a34a' }}>{balance.toLocaleString()} {unit}</div>
                    <div style={{ textAlign: 'right' }}>
                      <input type="number" min="0" step="any" placeholder={`Qty (${unit})`}
                        value={line.receivedQty || ''} onChange={e => updateAccQty(idx, Number(e.target.value))}
                        style={{ width: 90, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right' }} />
                      {line.receivedQty > 0 && Math.abs(diff) > 0.0001 && (
                        <div style={{ fontSize: 11, marginTop: 1, color: diff > 0 ? '#16a34a' : '#dc2626' }}>
                          {diff > 0 ? `${diff.toLocaleString()} ${unit} over balance` : `${(-diff).toLocaleString()} ${unit} still pending`}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <input type="number" min="0" step="any" placeholder="₹ price"
                        value={line.unitPrice || ''} onChange={e => updateAccPrice(idx, Number(e.target.value))}
                        style={{ width: 100, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right' }} />
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
                      {(line.receivedQty * line.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )
              })}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px 120px 110px 110px', padding: '8px 16px', background: '#f8fafc', borderTop: '2px solid var(--border)', fontSize: 12, fontWeight: 700 }}>
                <div style={{ color: 'var(--text-muted)' }}>TOTAL</div><div /><div /><div />
                <div style={{ textAlign: 'right', color: 'var(--navy)' }}>{totalReceivedNow.toLocaleString()}</div>
                <div />
                <div style={{ textAlign: 'right', color: 'var(--navy)' }}>
                  {accTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 150px 80px',
                background: '#f1f5f9', padding: '8px 16px',
                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <div>Fabric</div>
                <div style={{ textAlign: 'right' }}>Ordered</div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Prev. Recd</div>
                <div style={{ textAlign: 'right' }}>Balance</div>
                <div style={{ textAlign: 'right' }}>This GRN</div>
                <div style={{ textAlign: 'center' }}>Rolls</div>
              </div>

              {lines.map((line, idx) => {
                const receivedTotal = line.rolls.reduce((s, r) => s + r.quantityMeters, 0)
                const balance = line.orderedMeters - line.receivedEarlier
                const diff = receivedTotal - balance
                const diffColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#6b7280'
                const unit = shortUnit(line.unitOfMeasure)

                return (
                  <div key={idx} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
                    {/* Summary row */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 150px 80px',
                      padding: '10px 16px', alignItems: 'center', background: '#fff',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)' }}>
                        {line.fabricLabel || line.fabricId}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>
                        {line.orderedMeters > 0 ? `${line.orderedMeters.toFixed(2)} ${unit}` : '—'}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>
                        {line.receivedEarlier.toFixed(2)} {unit}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: balance > 0 ? '#b45309' : '#16a34a' }}>
                        {balance.toFixed(2)} {unit}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {receivedTotal > 0 ? `${receivedTotal.toFixed(2)} ${unit}` : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>0 {unit}</span>}
                        </span>
                        {receivedTotal > 0 && line.orderedMeters > 0 && Math.abs(diff) > 0.0001 && (
                          <div style={{ fontSize: 11, color: diffColor, marginTop: 1 }}>
                            {diff > 0 ? `${diff.toFixed(2)} ${unit} over balance` : `${(-diff).toFixed(2)} ${unit} still pending`}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: '3px 10px',
                          background: line.rolls.length > 0 ? '#dcfce7' : '#f1f5f9',
                          color: line.rolls.length > 0 ? '#16a34a' : '#6b7280',
                          borderRadius: 12, whiteSpace: 'nowrap',
                        }}>
                          {line.rolls.length} roll{line.rolls.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Roll entry rows */}
                    <div style={{ padding: '0 14px 12px', background: '#fafbfc' }}>
                      {line.rolls.length > 0 && (
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 8 }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, width: 80 }}>Roll #</th>
                              <th style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{unitWord(line.unitOfMeasure)} on label</th>
                              <th style={{ width: 32 }} />
                            </tr>
                          </thead>
                          <tbody>
                            {line.rolls.map((r, ri) => (
                              <tr key={ri}>
                                <td style={{ padding: '3px 8px' }}>
                                  <span style={{
                                    display: 'inline-block', minWidth: 36, padding: '2px 8px',
                                    background: 'var(--navy)', color: '#fff',
                                    borderRadius: 10, fontFamily: 'monospace', fontWeight: 700, fontSize: 12, textAlign: 'center',
                                  }}>
                                    {line.startRollNo + ri}
                                  </span>
                                </td>
                                <td style={{ padding: '3px 8px' }}>
                                  <input
                                    type="number" step="0.01" min="0.01" placeholder="e.g. 40.80"
                                    value={r.quantityMeters || ''}
                                    onChange={e => updateRollMeters(idx, ri, Number(e.target.value))}
                                    style={{ width: 140, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}
                                  />
                                  <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-muted)' }}>{unit}</span>
                                </td>
                                <td style={{ padding: '3px 4px' }}>
                                  <button type="button" onClick={() => removeRoll(idx, ri)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}>
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <button
                        type="button"
                        onClick={() => addRoll(idx)}
                        style={{
                          fontSize: 12, padding: '4px 12px', cursor: 'pointer',
                          background: '#fff', border: '1px dashed var(--navy)',
                          color: 'var(--navy)', borderRadius: 6, fontWeight: 600,
                        }}
                      >
                        + Add Roll
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Footer: grand total */}
              {lines.length > 0 && (() => {
                const totalOrdered  = lines.reduce((s, l) => s + l.orderedMeters, 0)
                const totalEarlier  = lines.reduce((s, l) => s + l.receivedEarlier, 0)
                const totalReceived = lines.reduce((s, l) => s + l.rolls.reduce((sr, r) => sr + r.quantityMeters, 0), 0)
                const totalSuffix = sharedUnitSuffix(lines.map(l => l.unitOfMeasure))
                return (
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 150px 80px',
                    padding: '8px 16px', background: '#f8fafc',
                    borderTop: '2px solid var(--border)',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    <div style={{ color: 'var(--text-muted)' }}>TOTAL</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{totalOrdered.toFixed(2)}{totalSuffix}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{totalEarlier.toFixed(2)}{totalSuffix}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{(totalOrdered - totalEarlier).toFixed(2)}{totalSuffix}</div>
                    <div style={{ textAlign: 'right', color: 'var(--navy)' }}>{totalReceived.toFixed(2)}{totalSuffix}</div>
                    <div />
                  </div>
                )
              })()}
            </div>
            )
          )}

          {poId && <SectionTitle n={3} title="Supplier Bill" />}
          {poId && (
            <GrnBillForm
              value={bill}
              onChange={b => { if (b.qty !== bill.qty) setQtyAuto(false); setBill(b) }}
            />
          )}

          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <div className="card">
        <FilterBar
          filters={[
            { label: 'Purchase Party', options: partyOptions, value: partyFilter, onChange: setPartyFilter, allLabel: 'All parties' },
            { label: 'Kind', options: [{ value: 'FABRIC', label: 'Fabric' }, { value: 'ACCESSORY', label: 'Accessory' }], value: kindFilter, onChange: setKindFilter, allLabel: 'All kinds' },
            { label: 'Status', options: [{ value: 'DRAFT', label: 'Draft' }, { value: 'CONFIRMED', label: 'Confirmed' }], value: statusFilter, onChange: setStatusFilter, allLabel: 'All statuses' },
          ]}
          search={{ placeholder: 'Party, GRN number, PO number…', value: search, onChange: setSearch }}
          count={filtered.length} countLabel="GRNs"
        />
        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>Purchase Party</th>
                <th>GRN Number</th>
                <th>Kind</th>
                <th>PO Number</th>
                <SortableTh label="Received Date" desc={sortDesc} onToggle={() => setSortDesc(p => !p)} />
                <th>Status</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state">No GRNs yet</div></td></tr>
              ) : sorted.map(g => (
                <tr key={g.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/grn/${g.id}`)}>
                  <td>{g.purchasePartyName ?? '—'}</td>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{g.grnNumber}</td>
                  <td style={{ fontSize: 12 }}>{g.grnKind === 'ACCESSORY' ? 'Accessory' : 'Fabric'}</td>
                  <td>{g.isSample ? <span className="badge badge-draft" title="Raised without a PO">Sample</span> : g.poNumber}</td>
                  <td>{g.receivedDate}</td>
                  <td><span className={`badge ${statusBadge(g.status)}`}>{g.status}</span></td>
                  <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    {g.status !== 'CONFIRMED' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => confirmGrn(g.id)}>Confirm</button>
                    )}
                    {g.status === 'DRAFT' ? (
                      <button className="btn-icon" title="Delete draft" style={{ color: '#dc2626', marginLeft: 6 }} onClick={e => deleteGrn(g, e)}>
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
