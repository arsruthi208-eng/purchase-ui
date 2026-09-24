import { useEffect, useState } from 'react'
import { Plus, Trash2, TrendingUp, TrendingDown, Package } from '../icons'
import { stockApi, type StockEntry, type StockBalanceSummary, type CreateStockEntryRequest } from '../api/stock'
import { type RollEntry, fabricRollsApi } from '../api/fabricRolls'
import { fabricsApi, type Fabric } from '../api/fabrics'
import { accessoriesApi, type Accessory } from '../api/accessories'
import { Modal, FormError, FormActions, SummaryCard, statusBadge, today } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

const ITEM_TYPES = ['FABRIC', 'ACCESSORY'] as const
const VIEWS = ['balance', 'entries'] as const
type View = typeof VIEWS[number]

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
      border: '1.5px solid ' + (active ? 'var(--navy)' : 'var(--border)'),
      background: active ? 'var(--navy)' : 'var(--white)',
      color: active ? 'var(--white)' : 'var(--text-muted)',
    }}>{children}</button>
  )
}

/** Roll sub-table used inside the stock creation form for FABRIC entries */
function RollSubTable({
  rolls, onChange, startRollNumber
}: {
  rolls: RollEntry[]
  onChange: (rolls: RollEntry[]) => void
  startRollNumber: number
}) {
  const addRow = () => onChange([...rolls, { quantityMeters: 0, unitPrice: 0 }])
  const remove = (idx: number) => onChange(rolls.filter((_, i) => i !== idx))
  const update = (idx: number, field: keyof RollEntry, val: number) =>
    onChange(rolls.map((r, i) => i === idx ? { ...r, [field]: val } : r))

  const totalMeters = rolls.reduce((s, r) => s + r.quantityMeters, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontWeight: 600, fontSize: 13 }}>Roll Details *</label>
        <button type="button" className="btn btn-sm" onClick={addRow}
          style={{ fontSize: 12, padding: '3px 10px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          <Plus size={12} style={{ marginRight: 3 }} /> Add Roll
        </button>
      </div>
      {rolls.length === 0
        ? <div style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: 13 }}>Click "Add Roll" to enter individual roll details.</div>
        : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', width: 60 }}>Roll #</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Meters (from label)</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Unit Price ₹/m</th>
                <th style={{ width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {rolls.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px', color: 'var(--navy)', fontWeight: 700, fontFamily: 'monospace' }}>
                    {startRollNumber + i}
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <input type="number" step="0.01" min="0" placeholder="e.g. 40.80"
                      value={r.quantityMeters || ''}
                      onChange={e => update(i, 'quantityMeters', Number(e.target.value))}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }} />
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <input type="number" step="0.01" min="0" placeholder="₹"
                      value={r.unitPrice || ''}
                      onChange={e => update(i, 'unitPrice', Number(e.target.value))}
                      style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }} />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <button type="button" onClick={() => remove(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 2 }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg)', fontWeight: 600 }}>
                <td colSpan={2} style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--navy)' }}>
                  Total: {totalMeters.toFixed(2)} m
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
    </div>
  )
}

/** Inline roll badge list shown in the entries view */
function RollBadgeList({ rolls }: { rolls: { rollNumber: number; quantityMeters: number; unitPrice: number }[] }) {
  if (!rolls || rolls.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {rolls.map(r => (
        <span key={r.rollNumber} style={{
          fontSize: 11, padding: '2px 7px', background: '#dbeafe', color: '#1d4ed8',
          borderRadius: 12, fontFamily: 'monospace', fontWeight: 600
        }}>
          #{r.rollNumber} · {r.quantityMeters.toFixed(2)}m
        </span>
      ))}
    </div>
  )
}

export default function Stock() {
  const [view, setView] = useState<View>('balance')
  const [itemType, setItemType] = useState<string>('FABRIC')

  const [balances, setBalances] = useState<StockBalanceSummary[]>([])
  const [balLoading, setBalLoading] = useState(true)
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)

  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Omit<CreateStockEntryRequest, 'rolls'>>({
    itemType: 'FABRIC', referenceId: '', quantity: 0, unitPrice: 0, stockDate: today(), notes: '',
  })
  const [rolls, setRolls] = useState<RollEntry[]>([])
  const [startRollNo, setStartRollNo] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showWarning, showError } = useAlertDialog()

  const isFabric = itemType === 'FABRIC'
  const unit = isFabric ? 'm' : 'pcs'

  const loadBalances = () => {
    setBalLoading(true)
    stockApi.listBalances(itemType).then(setBalances).finally(() => setBalLoading(false))
  }
  const loadEntries = () => {
    setEntriesLoading(true)
    stockApi.list(itemType).then(setEntries).finally(() => setEntriesLoading(false))
  }

  useEffect(() => {
    loadBalances()
    if (view === 'entries') loadEntries()
  }, [itemType])

  useEffect(() => {
    if (view === 'entries' && entries.length === 0) loadEntries()
  }, [view])

  useEffect(() => {
    fabricsApi.list().then(setFabrics)
    accessoriesApi.list().then(setAccessories)
  }, [])

  // When fabric changes in form, fetch next roll number
  const onFabricChange = (fabricId: string) => {
    setForm(p => ({ ...p, referenceId: fabricId }))
    setRolls([])
    if (fabricId) {
      fabricRollsApi.nextRollNumber(fabricId).then(setStartRollNo).catch(() => setStartRollNo(1))
    } else {
      setStartRollNo(1)
    }
  }

  const openCreate = () => {
    setForm({ itemType, referenceId: '', quantity: 0, unitPrice: 0, stockDate: today(), notes: '' })
    setRolls([])
    setStartRollNo(1)
    setError('')
    setShowForm(true)
  }

  const doSave = async () => {
    setSaving(true); setError('')
    try {
      const payload: CreateStockEntryRequest = isFabric
        ? { ...form, itemType, quantity: 0, unitPrice: 0, rolls }
        : { ...form, itemType }
      await stockApi.create(payload)
      setShowForm(false)
      loadBalances()
      if (view === 'entries') loadEntries()
    } catch (e: any) {
      if (isForbiddenError(e)) showError('Access Denied', PERMISSION_DENIED_MSG)
      else setError(e.message)
    } finally { setSaving(false) }
  }

  const save = () => {
    if (!form.referenceId) { setError('Please select an item'); return }
    if (isFabric) {
      if (rolls.length === 0) { setError('Add at least one roll'); return }
      if (rolls.some(r => r.quantityMeters <= 0)) { setError('Every roll must have meters > 0'); return }
    } else {
      if (!form.quantity || form.quantity <= 0) { setError('Quantity is required'); return }
      const LARGE_QTY_THRESHOLD = 50000
      if (form.quantity > LARGE_QTY_THRESHOLD) {
        showWarning('Large Quantity Entered',
          `You entered ${form.quantity.toLocaleString()} pieces. This seems unusually large.`, doSave)
        return
      }
      if (!form.unitPrice || form.unitPrice <= 0) {
        showWarning('Zero Unit Price', 'Unit price is ₹0. Stock value will not be recorded correctly. Proceed?', doSave)
        return
      }
    }
    doSave()
  }

  const totalIn = balances.reduce((s, b) => s + b.totalIn, 0)
  const totalOut = balances.reduce((s, b) => s + b.totalOut, 0)
  const totalBalance = balances.reduce((s, b) => s + b.balance, 0)

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Stock Inventory</div>
          <div className="page-subtitle">Live balance across all movements</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Add Opening Stock</button>
      </div>

      {/* Item type + view tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {ITEM_TYPES.map(t => <Pill key={t} active={itemType === t} onClick={() => setItemType(t)}>{t}</Pill>)}
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <Pill active={view === 'balance'} onClick={() => setView('balance')}>Live Balance</Pill>
          <Pill active={view === 'entries'} onClick={() => setView('entries')}>Stock Entries</Pill>
        </div>
      </div>

      {/* Summary stat cards */}
      {view === 'balance' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <SummaryCard icon={<TrendingUp size={20} />} label="Total Received IN" value={`${totalIn.toLocaleString()} ${unit}`} color="var(--navy)" />
          <SummaryCard icon={<TrendingDown size={20} />} label="Total Consumed OUT" value={`${totalOut.toLocaleString()} ${unit}`} color="#b91c1c" />
          <SummaryCard icon={<Package size={20} />} label="Current Balance" value={`${totalBalance.toLocaleString()} ${unit}`} color="#16a34a" />
        </div>
      )}

      {/* ── CREATE FORM MODAL ── */}
      {showForm && (
        <Modal title={`Add Opening ${isFabric ? 'Fabric' : 'Accessory'} Stock`} onClose={() => setShowForm(false)}>
          <FormError message={error} />
          <div className="form-group">
            <label>{isFabric ? 'Fabric' : 'Accessory'} *</label>
            {isFabric
              ? (
                <select value={form.referenceId} onChange={e => onFabricChange(e.target.value)}>
                  <option value="">Select fabric…</option>
                  {fabrics.map(f => <option key={f.id} value={f.id}>{f.fabricCode} — {f.fabricName}</option>)}
                </select>
              ) : (
                <select value={form.referenceId} onChange={e => setForm(p => ({ ...p, referenceId: e.target.value }))}>
                  <option value="">Select accessory…</option>
                  {accessories.map(a => <option key={a.id} value={a.id}>{a.accessoryCode} — {a.accessoryName}</option>)}
                </select>
              )}
          </div>

          {/* FABRIC: roll sub-table */}
          {isFabric && form.referenceId && (
            <div style={{ margin: '12px 0' }}>
              <RollSubTable rolls={rolls} onChange={setRolls} startRollNumber={startRollNo} />
            </div>
          )}

          {/* ACCESSORY: plain qty + price */}
          {!isFabric && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Quantity (pcs) *</label>
                <input type="number" step="1" value={form.quantity || ''}
                  onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Unit Price ₹</label>
                <input type="number" step="0.01" value={form.unitPrice || ''}
                  onChange={e => setForm(p => ({ ...p, unitPrice: Number(e.target.value) }))} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Stock Date *</label>
            <input type="date" value={form.stockDate} onChange={e => setForm(p => ({ ...p, stockDate: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea rows={2} value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      {/* ── LIVE BALANCE VIEW ── */}
      {view === 'balance' && (
        <div className="card">
          <div className="card-header">
            <h2>Current {isFabric ? 'Fabric' : 'Accessory'} Stock Levels</h2>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{balances.length} item{balances.length !== 1 ? 's' : ''}</span>
          </div>
          {balLoading ? <div className="loading">Loading…</div> : (
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  {isFabric && <th style={{ textAlign: 'right' }}>Rolls</th>}
                  <th style={{ textAlign: 'right' }}>Total IN</th>
                  <th style={{ textAlign: 'right' }}>Total OUT</th>
                  <th style={{ textAlign: 'right' }}>Current Balance</th>
                  <th style={{ textAlign: 'center' }}>Level</th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 ? (
                  <tr><td colSpan={isFabric ? 6 : 5}><div className="empty-state">No stock movements recorded yet.</div></td></tr>
                ) : balances.map(b => {
                  const pct = b.totalIn > 0 ? Math.round((b.balance / b.totalIn) * 100) : 0
                  const barColor = pct > 50 ? '#16a34a' : pct > 20 ? '#d97706' : '#dc2626'
                  return (
                    <tr key={b.referenceId}>
                      <td style={{ fontWeight: 600 }}>
                        {b.referenceName}
                        {isFabric && b.minStockMeters != null && b.balance < b.minStockMeters && (
                          <span title={`Below minimum stock (${b.minStockMeters.toLocaleString()} m)`}
                            style={{ marginLeft: 6, display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#dc2626', verticalAlign: 'middle' }} />
                        )}
                      </td>
                      {isFabric && (
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 13 }}>
                          {b.rollCount > 0 ? `${b.rollCount} roll${b.rollCount !== 1 ? 's' : ''}` : '—'}
                        </td>
                      )}
                      <td style={{ textAlign: 'right', color: 'var(--navy)' }}>+{b.totalIn.toLocaleString()} {unit}</td>
                      <td style={{ textAlign: 'right', color: '#b91c1c' }}>-{b.totalOut.toLocaleString()} {unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: b.balance > 0 ? '#16a34a' : '#dc2626' }}>
                        {b.balance.toLocaleString()} {unit}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                          <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 30 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── STOCK ENTRIES VIEW ── */}
      {view === 'entries' && (
        <div className="card">
          <div className="card-header">
            <h2>Opening Stock Entries</h2>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</span>
          </div>
          {entriesLoading ? <div className="loading">Loading…</div> : (
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  {isFabric
                    ? <th>Rolls</th>
                    : <>
                        <th style={{ textAlign: 'right' }}>Quantity</th>
                        <th style={{ textAlign: 'right' }}>Unit Price</th>
                        <th style={{ textAlign: 'right' }}>Total Value</th>
                      </>
                  }
                  {isFabric && <th style={{ textAlign: 'right' }}>Total Meters</th>}
                  <th>Stock Date</th>
                  <th>Notes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={isFabric ? 5 : 7}><div className="empty-state">No opening stock entries for {itemType.toLowerCase()}</div></td></tr>
                ) : entries.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 500 }}>{e.referenceName}</td>
                    {isFabric
                      ? <td><RollBadgeList rolls={e.rolls ?? []} /></td>
                      : <>
                          <td style={{ textAlign: 'right' }}>{e.quantity} pcs</td>
                          <td style={{ textAlign: 'right' }}>₹{e.unitPrice.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{e.totalValue.toFixed(2)}</td>
                        </>
                    }
                    {isFabric && (
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {e.quantity.toFixed(2)} m
                      </td>
                    )}
                    <td>{e.stockDate}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{e.notes ?? '—'}</td>
                    <td><span className={`badge ${statusBadge(e.status)}`}>{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
