import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from '../icons'
import { cuttingApi, type CuttingOrder, type CreateCuttingRequest, type CreateCuttingItemRequest } from '../api/cutting'
import { type FabricRoll, fabricRollsApi } from '../api/fabricRolls'
import { schoolsApi, type School } from '../api/schools'
import { schoolOrdersApi, type SchoolOrderSummary, type SchoolOrderDetail } from '../api/schoolOrders'
import { stylesApi, type Style } from '../api/styles'
import { fabricsApi, type Fabric } from '../api/fabrics'
import { coloursApi, type Colour } from '../api/colours'
import { stockApi } from '../api/stock'
import { useApiList } from '../hooks/useApiData'
import { Modal, FormError, FormActions, AlertDialog, type StockShortfall, statusBadge, today } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

/** Extended line state that also tracks roll selection */
interface LineState {
  styleId: string
  fabricId: string
  colourId: string
  gender: string
  standard: string
  quantity: number
  fabricConsumed: number
  notes?: string
  availableRolls: FabricRoll[]
  selectedRollIds: string[]
}

const emptyLine = (): LineState => ({
  styleId: '', fabricId: '', colourId: '', gender: 'BOYS', standard: '', quantity: 0,
  fabricConsumed: 0, availableRolls: [], selectedRollIds: [],
})

/** Compact roll picker shown per cutting line */
function RollPicker({
  rolls,
  selectedIds,
  onToggle,
}: {
  rolls: FabricRoll[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  if (rolls.length === 0) return (
    <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>
      No available rolls for this fabric.
    </div>
  )
  const selectedMeters = rolls.filter(r => selectedIds.includes(r.id)).reduce((s, r) => s + r.quantityMeters, 0)
  return (
    <div>
      {/* Summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8, padding: '5px 10px',
        background: selectedIds.length > 0 ? '#eff6ff' : '#f8fafc',
        borderRadius: 6, border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Tap a roll to select / deselect &nbsp;·&nbsp; {rolls.length} available
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
          {selectedIds.length} selected &nbsp;=&nbsp; {selectedMeters.toFixed(2)} m
        </span>
      </div>

      {/* Roll grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
        gap: 6,
      }}>
        {rolls.map(r => {
          const selected = selectedIds.includes(r.id)
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onToggle(r.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                transition: 'background 0.12s, border-color 0.12s',
                background: selected ? 'var(--navy)' : '#fff',
                color: selected ? '#fff' : 'var(--text)',
                border: `1.5px solid ${selected ? 'var(--navy)' : 'var(--border)'}`,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, opacity: selected ? 0.75 : 0.5, letterSpacing: '0.03em' }}>
                ROLL NO: {r.rollNumber}
              </span>
              <span style={{ fontSize: 14, marginTop: 3, opacity: 0.85 }}>
                {r.quantityMeters.toFixed(2)} m
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Cutting() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<CuttingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const { data: schools }      = useApiList<School>(() => schoolsApi.list())
  const { data: schoolOrders } = useApiList<SchoolOrderSummary>(() => schoolOrdersApi.list())
  const { data: styles }       = useApiList<Style>(() => stylesApi.list())
  const { data: fabrics }      = useApiList<Fabric>(() => fabricsApi.list())
  const { data: colours }      = useApiList<Colour>(() => coloursApi.list())

  const confirmedOrders = schoolOrders.filter(o => o.status === 'CONFIRMED')

  const [showForm, setShowForm] = useState(false)
  const [schoolOrderId, setSchoolOrderId] = useState('')
  const [lockedSchoolId, setLockedSchoolId] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [cuttingDate, setCuttingDate] = useState(today())
  const [sentToPersonName, setSentToPersonName] = useState('')
  const [lines, setLines] = useState<LineState[]>([emptyLine()])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog: alertDialog, showError: showAlertError, showConfirm, showWarning: showAlertWarning } = useAlertDialog()
  const [stockDialog, setStockDialog] = useState<StockShortfall[] | null>(null)

  const styleMap = Object.fromEntries(styles.map(s => [s.id, s]))
  // Keep a stable ref so async callbacks always see the latest styleMap
  const styleMapRef = useRef(styleMap)
  useEffect(() => { styleMapRef.current = styleMap }, [styleMap])

  const load = () => {
    setLoading(true)
    cuttingApi.list().then(setOrders).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openCreate = () => {
    setSchoolOrderId('')
    setLockedSchoolId('')
    setSchoolId(schools[0]?.id ?? '')
    setCuttingDate(today())
    setSentToPersonName('')
    setLines([emptyLine()])
    setError('')
    setShowForm(true)
  }

  /** Load available rolls whenever a fabric is selected on a line.
   *  Falls back to style.fabricConsumptionRate × qty when no rolls exist yet. */
  const loadRollsForLine = useCallback(async (idx: number, fabricId: string) => {
    if (!fabricId) {
      setLines(prev => prev.map((l, i) => i === idx ? { ...l, fabricId, availableRolls: [], selectedRollIds: [], fabricConsumed: 0 } : l))
      return
    }
    try {
      const rolls = await fabricRollsApi.available(fabricId)
      setLines(prev => prev.map((l, i) => {
        if (i !== idx) return l
        // If rolls exist → let user pick (consumed = 0 until rolls are selected)
        // If no rolls yet → auto-calc from style's rate so the user can still save
        let fabricConsumed = 0
        if (rolls.length === 0) {
          const rate = styleMapRef.current[l.styleId]?.fabricConsumptionRate
          if (rate && l.quantity > 0) {
            fabricConsumed = Math.round(l.quantity * rate * 100) / 100
          }
        }
        return { ...l, fabricId, availableRolls: rolls, selectedRollIds: [], fabricConsumed }
      }))
    } catch {
      setLines(prev => prev.map((l, i) => i === idx ? { ...l, fabricId } : l))
    }
  }, [])

  const toggleRoll = (lineIdx: number, rollId: string) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== lineIdx) return l
      const isSelected = l.selectedRollIds.includes(rollId)
      const selectedRollIds = isSelected
        ? l.selectedRollIds.filter(id => id !== rollId)
        : [...l.selectedRollIds, rollId]
      // Recalculate fabricConsumed from selected rolls
      const fabricConsumed = l.availableRolls
        .filter(r => selectedRollIds.includes(r.id))
        .reduce((s, r) => s + r.quantityMeters, 0)
      return { ...l, selectedRollIds, fabricConsumed: Math.round(fabricConsumed * 1000) / 1000 }
    }))
  }

  const onSchoolOrderChange = async (soId: string) => {
    setSchoolOrderId(soId)
    if (!soId) { setLockedSchoolId(''); return }
    try {
      const detail: SchoolOrderDetail = await schoolOrdersApi.getById(soId)
      setLockedSchoolId(detail.schoolId)
      setSchoolId(detail.schoolId)
      const autoLines: LineState[] = detail.items.map(item => {
        const rate = styleMapRef.current[item.styleId]?.fabricConsumptionRate
        const fabricConsumed = rate && item.quantity > 0 ? Math.round(item.quantity * rate * 100) / 100 : 0
        return {
          styleId: item.styleId,
          fabricId: '',
          colourId: '',
          gender: item.gender,
          standard: item.standard,
          quantity: item.quantity,
          fabricConsumed,
          availableRolls: [],
          selectedRollIds: [],
        }
      })
      setLines(autoLines.length > 0 ? autoLines : [emptyLine()])
    } catch {
      // ignore
    }
  }

  const updateLine = (idx: number, patch: Partial<LineState>) => {
    setLines(prev => prev.map((line, i) => {
      if (i !== idx) return line
      const merged = { ...line, ...patch }
      // Auto-recalculate fabric consumed when qty or style changes (only if no rolls selected)
      if (('quantity' in patch || 'styleId' in patch) && merged.selectedRollIds.length === 0) {
        const rate = styleMapRef.current[merged.styleId]?.fabricConsumptionRate
        if (rate && merged.quantity > 0) {
          merged.fabricConsumed = Math.round(merged.quantity * rate * 100) / 100
        }
      }
      return merged
    }))
  }

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))

  const checkAndSave = async () => {
    if (!schoolOrderId) { setError('School order is required'); return }
    if (!schoolId || !cuttingDate) { setError('School and date are required'); return }
    if (lines.some(l => !l.styleId || !l.fabricId || !l.gender || !l.standard || !l.quantity)) {
      setError('Each line needs style, fabric, gender, standard, and quantity'); return
    }
    if (lines.some(l => !l.fabricConsumed || l.fabricConsumed <= 0)) {
      setError('Each line must have fabric consumed > 0. Select rolls or ensure style has a fabric rate.'); return
    }

    // Check fabric stock balances
    try {
      const balances = await stockApi.listBalances('FABRIC')
      const balanceMap = Object.fromEntries(balances.map(b => [b.referenceId, b.balance]))
      const required: Record<string, { qty: number; name: string }> = {}
      lines.forEach(l => {
        const fab = fabrics.find(f => f.id === l.fabricId)
        if (!required[l.fabricId]) required[l.fabricId] = { qty: 0, name: fab?.fabricName ?? l.fabricId }
        required[l.fabricId].qty += l.fabricConsumed
      })
      const shortfalls: StockShortfall[] = Object.entries(required)
        .filter(([id, { qty }]) => (balanceMap[id] ?? 0) < qty)
        .map(([id, { qty, name }]) => ({
          name, required: qty, available: balanceMap[id] ?? 0, shortfall: qty - (balanceMap[id] ?? 0), unit: 'm',
        }))
      if (shortfalls.length > 0) { setStockDialog(shortfalls); return }

      // Non-blocking: warn if cutting would drop any fabric below its minStockMeters
      const belowMin: string[] = Object.entries(required).filter(([id, { qty }]) => {
        const fab = fabrics.find(f => f.id === id)
        if (!fab?.minStockMeters) return false
        const remaining = (balanceMap[id] ?? 0) - qty
        return remaining < fab.minStockMeters
      }).map(([id, { name }]) => {
        const fab = fabrics.find(f => f.id === id)
        const remaining = (balanceMap[id] ?? 0) - (required[id]?.qty ?? 0)
        return `${name} (will have ${remaining.toLocaleString()} m, min is ${fab!.minStockMeters!.toLocaleString()} m)`
      })
      if (belowMin.length > 0) {
        showAlertWarning('Stock Below Minimum', `After this cutting, the following fabrics will be below minimum stock:\n\n${belowMin.join('\n')}`)
      }
    } catch { /* allow save if stock check fails */ }

    await doSave()
  }

  const doSave = async () => {
    setSaving(true); setError('')
    try {
      const payload: CreateCuttingRequest = {
        schoolId,
        schoolOrderId: schoolOrderId || undefined,
        cuttingDate,
        sentToPersonName: sentToPersonName || undefined,
        items: lines.map(l => ({
          styleId: l.styleId,
          fabricId: l.fabricId,
          colourId: l.colourId || undefined,
          gender: l.gender,
          standard: l.standard,
          quantity: l.quantity,
          fabricConsumed: l.fabricConsumed,
          notes: l.notes,
          rollIds: l.selectedRollIds.length > 0 ? l.selectedRollIds : undefined,
        }) satisfies CreateCuttingItemRequest),
      }
      await cuttingApi.create(payload)
      setShowForm(false); load()
    } catch (e: any) {
      if (isForbiddenError(e)) showAlertError('Access Denied', PERMISSION_DENIED_MSG)
      else setError(e.message)
    } finally { setSaving(false) }
  }

  const confirmOrder = (id: string) => {
    showConfirm(
      'Confirm Cutting Order',
      'Fabric stock will be deducted and rolls marked as consumed. This cannot be undone.',
      async () => { try { await cuttingApi.confirm(id); load() } catch (e: any) { isForbiddenError(e) ? showAlertError('Access Denied', PERMISSION_DENIED_MSG) : showAlertError('Confirm Failed', e.message) } }
    )
  }

  return (
    <div className="page">
      {alertDialog}
      <div className="page-header">
        <div>
          <div className="page-title">Cutting DC</div>
          <div className="page-subtitle">{orders.length} cutting orders</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />New Cutting</button>
      </div>

      {stockDialog && (
        <AlertDialog
          title="Insufficient Fabric Stock"
          message="The following fabrics do not have enough stock for this cutting order."
          stockShortfalls={stockDialog}
          variant="error"
          onClose={() => setStockDialog(null)}
        />
      )}

      {showForm && (
        <Modal title="New Cutting Order" onClose={() => setShowForm(false)} width={820}>
          <FormError message={error} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group">
              <label>School Order *</label>
              <select value={schoolOrderId} onChange={e => onSchoolOrderChange(e.target.value)}>
                <option value="">Select school order…</option>
                {confirmedOrders.map(o => (
                  <option key={o.id} value={o.id}>{o.orderNumber} — {o.schoolName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>School *</label>
              {lockedSchoolId ? (
                <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 500 }}>
                  {schools.find(s => s.id === lockedSchoolId)?.schoolName ?? lockedSchoolId}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>from school order</span>
                </div>
              ) : (
                <select value={schoolId} onChange={e => setSchoolId(e.target.value)}>
                  <option value="">Select school</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.schoolName}</option>)}
                </select>
              )}
            </div>
            <div className="form-group">
              <label>Cutting Date *</label>
              <input type="date" value={cuttingDate} onChange={e => setCuttingDate(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Received by (optional)</label>
            <input type="text" placeholder="Name of person who received the cutting order…"
              value={sentToPersonName} onChange={e => setSentToPersonName(e.target.value)} />
          </div>

          {/* Line items */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Items</span>
            {schoolOrderId && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto-filled from school order — select fabric and rolls per line</span>
            )}
          </div>

          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {lines.map((line, idx) => (
              <div key={idx} style={{ marginBottom: 14, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                {/* Row 1: Style, Fabric, Colour, Gender, Standard, Qty */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1fr auto', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                  <select value={line.styleId} onChange={e => updateLine(idx, { styleId: e.target.value })}>
                    <option value="">Style…</option>
                    {styles.map(s => <option key={s.id} value={s.id}>{s.styleName}</option>)}
                  </select>
                  <select value={line.fabricId} onChange={e => loadRollsForLine(idx, e.target.value)}>
                    <option value="">Fabric…</option>
                    {fabrics.map(f => <option key={f.id} value={f.id}>{f.fabricCode} — {f.fabricName}</option>)}
                  </select>
                  <select value={line.colourId ?? ''} onChange={e => updateLine(idx, { colourId: e.target.value })}>
                    <option value="">Colour</option>
                    {colours.map(c => <option key={c.id} value={c.id}>{c.colourName}</option>)}
                  </select>
                  <select value={line.gender} onChange={e => updateLine(idx, { gender: e.target.value })}>
                    <option value="BOYS">BOYS</option>
                    <option value="GIRLS">GIRLS</option>
                    <option value="UNISEX">UNISEX</option>
                  </select>
                  <input placeholder="Standard" value={line.standard} onChange={e => updateLine(idx, { standard: e.target.value })} />
                  <input type="number" placeholder="Qty" value={line.quantity || ''}
                    onChange={e => updateLine(idx, { quantity: Number(e.target.value) })} />
                  <button className="btn-icon" style={{ color: '#dc2626' }} title="Remove" disabled={lines.length === 1} onClick={() => removeLine(idx)}>
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Row 2: Roll picker or fabric consumed display */}
                {line.fabricId ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Select rolls to assign →
                    </div>
                    <RollPicker
                      rolls={line.availableRolls}
                      selectedIds={line.selectedRollIds}
                      onToggle={rollId => toggleRoll(idx, rollId)}
                    />
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Fabric consumed: </span>
                      <strong style={{ color: line.fabricConsumed > 0 ? 'var(--navy)' : '#dc2626' }}>
                        {line.fabricConsumed.toFixed(2)} m
                      </strong>
                      {line.availableRolls.length === 0 && styleMap[line.styleId]?.fabricConsumptionRate && line.selectedRollIds.length === 0 && (
                        <span style={{ color: '#92400e', fontSize: 11, marginLeft: 8, background: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>
                          auto from rate: {styleMap[line.styleId].fabricConsumptionRate} m/pc × {line.quantity}
                        </span>
                      )}
                      {line.selectedRollIds.length > 0 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>
                          from {line.selectedRollIds.length} roll{line.selectedRollIds.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {line.fabricId && line.availableRolls.length === 0 && !styleMap[line.styleId]?.fabricConsumptionRate && (
                      <div style={{ marginTop: 6 }}>
                        <label style={{ fontSize: 11, color: '#b45309', fontWeight: 600 }}>
                          No rolls & no rate — enter meters manually:
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Fabric consumed (m)"
                          value={line.fabricConsumed || ''}
                          onChange={e => updateLine(idx, { fabricConsumed: Number(e.target.value) })}
                          style={{ marginTop: 4, width: 160, fontSize: 13 }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Select a fabric to see available rolls.</div>
                )}
              </div>
            ))}
          </div>

          <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: 4 }}
            onClick={() => setLines(prev => [...prev, emptyLine()])}>
            + Add line
          </button>

          <FormActions onCancel={() => setShowForm(false)} onSave={checkAndSave} saving={saving} />
        </Modal>
      )}

      <div className="card">
        {loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>Cutting #</th>
                <th>School</th>
                <th>Date</th>
                <th>Received By</th>
                <th style={{ textAlign: 'right' }}>Items</th>
                <th>Status</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state">No cutting orders yet</div></td></tr>
              ) : orders.map(o => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/cutting/${o.id}`)}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{o.cuttingNumber}</td>
                  <td>{o.schoolName}</td>
                  <td>{o.cuttingDate}</td>
                  <td style={{ color: o.sentToPersonName ? undefined : 'var(--text-muted)', fontSize: 13 }}>{o.sentToPersonName ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{o.items?.length ?? 0}</td>
                  <td><span className={`badge ${statusBadge(o.status)}`}>{o.status}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    {o.status === 'DRAFT' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => confirmOrder(o.id)}>Confirm</button>
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
