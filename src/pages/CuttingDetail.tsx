import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { cuttingApi, type CuttingOrder } from '../api/cutting'
import { fabricRollsApi, type FabricRoll } from '../api/fabricRolls'
import { printCuttingDc } from '../utils/printDc'
import { useApiData } from '../hooks/useApiData'
import { BackButton, InfoRow, DocStat, StatsStrip, StatDivider, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

/* ── RollPicker — identical to Cutting.tsx, with requiredMeters support ── */
function RollPicker({
  rolls,
  selectedIds,
  onToggle,
  requiredMeters,
  rate,
  quantity,
}: {
  rolls: FabricRoll[]
  selectedIds: string[]
  onToggle: (id: string) => void
  requiredMeters?: number
  rate?: number
  quantity?: number
}) {
  const selectedMeters = rolls.filter(r => selectedIds.includes(r.id)).reduce((s, r) => s + Number(r.quantityMeters), 0)
  const shortage = requiredMeters != null && requiredMeters > 0 ? requiredMeters - selectedMeters : 0

  return (
    <div>
      {/* Green "Required fabric" banner — same as create form */}
      {requiredMeters != null && requiredMeters > 0 && rate != null && quantity != null && (
        <div style={{
          fontSize: 12, marginBottom: 6, padding: '4px 10px',
          background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color: '#15803d', fontWeight: 700 }}>📐 Required fabric:</span>
          <strong style={{ fontSize: 14, color: '#166534' }}>{requiredMeters.toFixed(2)} m</strong>
          <span style={{ color: '#6b7280', fontSize: 11 }}>({rate} m/pc × {quantity} pcs)</span>
        </div>
      )}

      {/* Required vs Selected comparison bar */}
      {requiredMeters != null && requiredMeters > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6, padding: '5px 10px',
          background: selectedMeters >= requiredMeters ? '#dcfce7' : '#fef9c3',
          borderRadius: 6, border: `1px solid ${selectedMeters >= requiredMeters ? '#86efac' : '#fde047'}`,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>
            Required: <strong style={{ fontSize: 13, color: '#78350f' }}>{requiredMeters.toFixed(2)} m</strong>
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: selectedMeters >= requiredMeters ? '#15803d' : '#b45309' }}>
            Selected: {selectedMeters.toFixed(2)} m
            {shortage > 0 && <span style={{ color: '#dc2626', marginLeft: 6 }}>({shortage.toFixed(2)} m short)</span>}
            {shortage <= 0 && selectedMeters > 0 && <span style={{ color: '#15803d', marginLeft: 6 }}>✓</span>}
          </span>
        </div>
      )}

      {/* Count / deselect hint bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8, padding: '5px 10px',
        background: selectedIds.length > 0 ? '#eff6ff' : '#f8fafc',
        borderRadius: 6, border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Tap a roll to select / deselect &nbsp;·&nbsp; {rolls.length} total
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
          {selectedIds.length} selected &nbsp;=&nbsp; {selectedMeters.toFixed(2)} m
        </span>
      </div>

      {rolls.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>
          No available rolls for this fabric.
        </div>
      ) : (
        /* Roll grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
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
                  ROLL #{r.rollNumber}
                </span>
                <span style={{ fontSize: 14, marginTop: 3, opacity: 0.85 }}>
                  {Number(r.quantityMeters).toFixed(2)} m
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function CuttingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: doc, loading, reload } = useApiData(
    () => id ? cuttingApi.getById(id) : Promise.resolve(null as CuttingOrder | null),
    [id]
  )
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)

  // Header fields
  const [editDate, setEditDate] = useState('')
  const [editSentTo, setEditSentTo] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // Per-item quantities
  const [editQtys, setEditQtys] = useState<Record<string, number>>({})

  // Per-item rolls:
  //   allRolls   = available (AVAILABLE) + already-assigned (IN_USE) combined list, sorted by rollNumber
  //   selectedIds = IDs of rolls currently chosen for this item
  const [allRolls, setAllRolls]     = useState<Record<string, FabricRoll[]>>({})
  const [selectedIds, setSelectedIds] = useState<Record<string, string[]>>({})
  const [rollsLoading, setRollsLoading] = useState(false)

  const { dialog, showError, showConfirm } = useAlertDialog()

  // Initialise header + qty edit state from doc
  useEffect(() => {
    if (!doc) return
    setEditDate(doc.cuttingDate)
    setEditSentTo(doc.sentToPersonName ?? '')
    setEditNotes(doc.notes ?? '')
    setEditQtys(Object.fromEntries(doc.items.map(i => [i.id, i.quantity])))
    // Initialise selectedIds from the doc's current rolls (IN_USE)
    setSelectedIds(Object.fromEntries(doc.items.map(i => [i.id, i.rolls.map(r => r.id)])))
  }, [doc])

  // Fetch available (AVAILABLE) rolls for each fabric when entering edit mode,
  // then merge with the item's existing IN_USE rolls so they appear pre-selected.
  const loadRolls = useCallback(async () => {
    if (!doc) return
    setRollsLoading(true)
    try {
      const uniqueFabrics = [...new Map(doc.items.map(i => [i.fabricId, i])).values()]
      const availMap: Record<string, FabricRoll[]> = {}
      await Promise.all(
        uniqueFabrics.map(async item => {
          // Use allActive to also show IN_USE rolls from other draft DCs as reserved
          const avail = await fabricRollsApi.allActive(item.fabricId)
          availMap[item.fabricId] = avail
        })
      )
      // For each item: merge available rolls + its current IN_USE rolls, sort by rollNumber
      const combined: Record<string, FabricRoll[]> = {}
      doc.items.forEach(item => {
        const avail = availMap[item.fabricId] ?? []
        // Current rolls are IN_USE — include them so user sees them pre-selected
        const inUse = item.rolls.filter(r => !avail.find(a => a.id === r.id))
        combined[item.id] = [...inUse, ...avail].sort((a, b) => a.rollNumber - b.rollNumber)
      })
      setAllRolls(combined)
    } catch {
      // If API fails, fall back to just the existing rolls as the list
      if (doc) {
        setAllRolls(Object.fromEntries(doc.items.map(i => [i.id, i.rolls])))
      }
    } finally {
      setRollsLoading(false)
    }
  }, [doc])

  const startEdit = () => {
    setEditing(true)
    loadRolls()
  }

  const cancelEdit = () => {
    setEditing(false)
    setAllRolls({})
    if (doc) {
      setEditDate(doc.cuttingDate)
      setEditSentTo(doc.sentToPersonName ?? '')
      setEditNotes(doc.notes ?? '')
      setEditQtys(Object.fromEntries(doc.items.map(i => [i.id, i.quantity])))
      setSelectedIds(Object.fromEntries(doc.items.map(i => [i.id, i.rolls.map(r => r.id)])))
    }
  }

  const toggleRoll = (itemId: string, rollId: string) => {
    setSelectedIds(prev => {
      const cur = prev[itemId] ?? []
      return {
        ...prev,
        [itemId]: cur.includes(rollId) ? cur.filter(id => id !== rollId) : [...cur, rollId],
      }
    })
  }

  const doSaveEdit = async () => {
    if (!doc) return

    // Validate: every item must have at least one roll selected (fabric_consumed cannot be 0)
    const emptyItems = doc.items.filter(i => {
      const ids = selectedIds[i.id] ?? i.rolls.map(r => r.id)
      return ids.length === 0
    })
    if (emptyItems.length > 0) {
      const names = emptyItems.map(i => i.styleName).join(', ')
      showError('No Rolls Selected', `Each cutting line must have at least one roll assigned. Please select rolls for: ${names}`)
      return
    }

    setBusy(true)
    try {
      await cuttingApi.update(doc.id, {
        cuttingDate: editDate,
        sentToPersonName: editSentTo || undefined,
        notes: editNotes || undefined,
        items: doc.items.map(i => ({
          id: i.id,
          quantity: editQtys[i.id] ?? i.quantity,
          rollIds: selectedIds[i.id] ?? i.rolls.map(r => r.id),
        })),
      })
      setEditing(false)
      reload()
    } catch (e: any) {
      isForbiddenError(e)
        ? showError('Access Denied', PERMISSION_DENIED_MSG)
        : showError('Save Failed', e.message)
    } finally {
      setBusy(false)
    }
  }

  const doConfirmOrder = async () => {
    if (!doc) return
    setBusy(true)
    try { await cuttingApi.confirm(doc.id); reload() }
    catch (e: any) {
      isForbiddenError(e)
        ? showError('Access Denied', PERMISSION_DENIED_MSG)
        : showError('Confirm Failed', e.message)
    } finally { setBusy(false) }
  }

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (!doc) return <div className="page"><div className="empty-state">Not found</div></div>

  const totalQty    = doc.items.reduce((s, i) => s + i.quantity, 0)
  const totalFabric = doc.items.reduce((s, i) => s + i.fabricConsumed, 0)

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton onClick={() => navigate(-1)} />
          <div>
            <div className="page-title" style={{ marginBottom: 2 }}>{doc.cuttingNumber}</div>
            <span className={`badge ${statusBadge(doc.status)}`}>{doc.status}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => printCuttingDc(doc)}>Print DC</button>
          {doc.status === 'DRAFT' && !editing && (
            <button className="btn btn-secondary" onClick={startEdit}>Edit</button>
          )}
          {editing && (
            <>
              <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={doSaveEdit}>
                {busy ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          )}
          {doc.status === 'DRAFT' && !editing && (
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => showConfirm(
                'Confirm Cutting Order',
                'Fabric stock will be deducted. This cannot be undone.',
                doConfirmOrder
              )}
            >
              {busy ? 'Confirming…' : 'Confirm Cutting'}
            </button>
          )}
        </div>
      </div>

      {/* Document Summary */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Document Summary
          </h2>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 40 }}>
          <InfoRow label="Cutting Number" value={doc.cuttingNumber} />
          {editing
            ? <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Cutting Date</div>
                <input type="date" className="form-control" value={editDate} onChange={e => setEditDate(e.target.value)} />
              </div>
            : <InfoRow label="Cutting Date" value={doc.cuttingDate} />
          }
          <InfoRow label="School"  value={doc.schoolName} />
          <InfoRow label="Status"  value={doc.status} />
          {editing
            ? <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Received By</div>
                <input type="text" className="form-control" placeholder="Person name" value={editSentTo} onChange={e => setEditSentTo(e.target.value)} />
              </div>
            : <InfoRow label="Received By" value={doc.sentToPersonName || '—'} />
          }
          {editing && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Notes</div>
              <input type="text" className="form-control" placeholder="Optional notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
            </div>
          )}
        </div>
        <StatsStrip>
          <DocStat label="Lines"                 value={doc.items.length.toString()} />
          <StatDivider />
          <DocStat label="Total Pieces"          value={totalQty.toLocaleString()} />
          <StatDivider />
          <DocStat label="Total Fabric Consumed" value={`${totalFabric.toLocaleString()} m`} />
        </StatsStrip>
      </div>

      {/* Cutting Lines */}
      <div className="card">
        <div className="card-header">
          <h2>Cutting Lines</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {doc.items.length} line{doc.items.length !== 1 ? 's' : ''}
          </span>
        </div>

        {doc.items.map((item, idx) => {
          const curSelected = selectedIds[item.id] ?? item.rolls.map(r => r.id)
          const rolls        = editing ? (allRolls[item.id] ?? []) : (item.rolls ?? [])
          const rollTotal    = editing
            ? (allRolls[item.id] ?? []).filter(r => curSelected.includes(r.id)).reduce((s, r) => s + Number(r.quantityMeters), 0)
            : item.rolls.reduce((s, r) => s + Number(r.quantityMeters), 0)

          return (
            <div key={item.id} style={{ borderTop: '1px solid var(--border)' }}>

              {/* Item header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                alignItems: 'center',
                padding: '14px 20px',
                background: '#f8fafc',
                gap: 12,
              }}>
                {/* Style + fabric */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', background: 'var(--navy)',
                    color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{idx + 1}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{item.styleName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{item.fabricName}</div>
                  </div>
                </div>

                {/* Meta chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {item.colourName && (
                    <span style={{ fontSize: 11, padding: '2px 10px', background: '#e0e7ff', color: '#3730a3', borderRadius: 20, fontWeight: 600 }}>
                      {item.colourName}
                    </span>
                  )}
                  <span style={{ fontSize: 11, padding: '2px 10px', background: '#f1f5f9', color: '#374151', borderRadius: 20, fontWeight: 600 }}>
                    {item.gender}
                  </span>
                  <span style={{ fontSize: 11, padding: '2px 10px', background: '#f1f5f9', color: '#374151', borderRadius: 20, fontWeight: 600 }}>
                    Std: {item.standard}
                  </span>
                </div>

                {/* Qty */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Qty (pcs)</div>
                  {editing
                    ? <input
                        type="number" min="0"
                        value={editQtys[item.id] ?? item.quantity}
                        onChange={e => setEditQtys(q => ({ ...q, [item.id]: Number(e.target.value) }))}
                        style={{ width: 80, textAlign: 'center', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 16, fontWeight: 700 }}
                      />
                    : <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>{item.quantity.toLocaleString()}</div>
                  }
                </div>

                {/* Fabric consumed */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>
                    {rollTotal.toFixed(2)} m
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {editing
                      ? `${curSelected.length} roll${curSelected.length !== 1 ? 's' : ''} selected`
                      : `${item.rolls.length} roll${item.rolls.length !== 1 ? 's' : ''} used`
                    }
                  </div>
                </div>
              </div>

              {/* ── Rolls section ── */}
              <div style={{ padding: '0 20px 16px' }}>
                {editing ? (
                  /* Edit mode: same roll picker as creation */
                  rollsLoading ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Loading rolls…</div>
                  ) : (
                    <RollPicker
                      rolls={rolls}
                      selectedIds={curSelected}
                      onToggle={rollId => toggleRoll(item.id, rollId)}
                      rate={item.fabricConsumptionRate}
                      quantity={editQtys[item.id] ?? item.quantity}
                      requiredMeters={
                        item.fabricConsumptionRate && (editQtys[item.id] ?? item.quantity) > 0
                          ? Math.round(item.fabricConsumptionRate * (editQtys[item.id] ?? item.quantity) * 100) / 100
                          : undefined
                      }
                    />
                  )
                ) : (
                  /* View mode: read-only table */
                  rolls.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '33.33%' }} />
                        <col style={{ width: '33.33%' }} />
                        <col style={{ width: '33.33%' }} />
                      </colgroup>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                          <th style={{ padding: '8px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Roll No</th>
                          <th style={{ padding: '8px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meters per Roll</th>
                          <th style={{ padding: '8px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rolls.map(r => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 20px', fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>{r.rollNumber}</td>
                            <td style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, color: '#111' }}>
                              {Number(r.quantityMeters).toFixed(2)}
                              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>m</span>
                            </td>
                            <td style={{ padding: '10px 20px' }}>
                              <span style={{
                                fontSize: 12, padding: '3px 12px', borderRadius: 20, fontWeight: 800,
                                background: r.status === 'CONSUMED' ? '#f3f4f6' : '#dcfce7',
                                color:      r.status === 'CONSUMED' ? '#6b7280' : '#15803d',
                              }}>
                                {r.status === 'CONSUMED' ? 'Consumed' : 'Utilizing'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f8fafc', borderTop: '2px solid var(--border)' }}>
                          <td style={{ padding: '9px 20px', fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</td>
                          <td style={{ padding: '9px 20px', fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>
                            {rollTotal.toFixed(2)}
                            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>m</span>
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <div style={{ padding: '10px 0', fontSize: 13, color: 'var(--text-muted)' }}>No rolls recorded.</div>
                  )
                )}
              </div>
            </div>
          )
        })}

        {/* Grand total footer */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          padding: '10px 20px', background: '#f1f5f9',
          borderTop: '2px solid var(--border)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', gridColumn: '1 / 3' }}>Grand Total</div>
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>{totalQty.toLocaleString()} pcs</div>
          <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>{totalFabric.toFixed(2)} m</div>
        </div>
      </div>
    </div>
  )
}
