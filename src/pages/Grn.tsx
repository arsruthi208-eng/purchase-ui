import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from '../icons'
import { grnApi, type GrnSummary, type CreateGrnRequest, type CreateGrnItemRequest } from '../api/grn'
import { type RollEntry, fabricRollsApi } from '../api/fabricRolls'
import { purchaseOrdersApi, type PoSummary } from '../api/purchaseOrders'
import { useApiList } from '../hooks/useApiData'
import { Modal, FormError, FormActions, statusBadge, today } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

/** Per-fabric-line form state including rolls */
interface LineState {
  fabricId: string
  fabricLabel: string      // locked display name from PO item
  orderedMeters: number    // meters ordered in the PO for this fabric
  rolls: RollEntry[]
  startRollNo: number
}

const emptyLine = (): LineState => ({ fabricId: '', fabricLabel: '', orderedMeters: 0, rolls: [], startRollNo: 1 })

export default function Grn() {
  const navigate = useNavigate()
  const [items, setItems] = useState<GrnSummary[]>([])
  const [loading, setLoading] = useState(true)
  const { data: openPos } = useApiList<PoSummary>(() => purchaseOrdersApi.list('OPEN'))
  const [loadingPo, setLoadingPo] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [poId, setPoId] = useState('')
  const [receivedDate, setReceivedDate] = useState(today())
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineState[]>([emptyLine()])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true)
    grnApi.list().then(setItems).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openCreate = () => {
    setPoId('')
    setReceivedDate(today())
    setVehicleNumber('')
    setNotes('')
    setLines([emptyLine()])
    setError('')
    setShowForm(true)
  }

  /** When PO changes, fetch its fabric items and lock lines to those fabrics */
  const onPoChange = async (id: string) => {
    setPoId(id)
    setLines([emptyLine()])
    if (!id) return
    setLoadingPo(true)
    try {
      const detail = await purchaseOrdersApi.getById(id)
      // Build one line per PO fabric item with roll-number pre-fetched
      const newLines = await Promise.all(
        detail.items.map(async item => {
          let startRollNo = 1
          try { startRollNo = await fabricRollsApi.nextRollNumber(item.fabricId) } catch { /* ignore */ }
          return {
            fabricId: item.fabricId,
            fabricLabel: `${item.fabricCode} — ${item.fabricName}`,
            orderedMeters: item.orderedQuantity,
            rolls: [],
            startRollNo,
          } satisfies LineState
        })
      )
      setLines(newLines.length > 0 ? newLines : [emptyLine()])
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

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))

  const save = async () => {
    if (!poId || !receivedDate) { setError('PO and received date are required'); return }
    if (lines.some(l => !l.fabricId)) { setError('Each line needs a fabric selected'); return }
    if (lines.some(l => l.rolls.length === 0)) { setError('Each line needs at least one roll'); return }
    if (lines.some(l => l.rolls.some(r => r.quantityMeters <= 0))) { setError('Every roll must have meters > 0'); return }

    const payload: CreateGrnRequest = {
      poId,
      receivedDate,
      vehicleNumber: vehicleNumber || undefined,
      notes: notes || undefined,
      items: lines.map(l => ({
        fabricId: l.fabricId,
        receivedQuantity: 0,   // derived server-side from roll sum
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
      'Fabric stock and roll records will be updated. This cannot be undone.',
      async () => { try { await grnApi.confirm(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } }
    )
  }

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
        <Modal title="New GRN" onClose={() => setShowForm(false)} width={700}>
          <FormError message={error} />
          <div className="form-group">
            <label>Purchase Order *</label>
            <select value={poId} onChange={e => onPoChange(e.target.value)} disabled={loadingPo}>
              <option value="">Select open PO</option>
              {openPos.map(po => (
                <option key={po.id} value={po.id}>{po.poNumber} — {po.purchasePartyName ?? 'No party'}</option>
              ))}
            </select>
            {loadingPo && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Loading fabric lines…</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Received Date *</label>
              <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Vehicle Number</label>
              <input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* ── Fabric Lines ── */}
          {!poId ? (
            <div style={{
              fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center',
              border: '1px dashed var(--border)', borderRadius: 8,
            }}>
              Select a Purchase Order above — fabric lines will load automatically.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 130px 160px 90px',
                background: '#f1f5f9', padding: '8px 16px',
                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <div>Fabric</div>
                <div style={{ textAlign: 'right' }}>Ordered (m)</div>
                <div style={{ textAlign: 'right' }}>Received (m)</div>
                <div style={{ textAlign: 'center' }}>Rolls</div>
              </div>

              {lines.map((line, idx) => {
                const receivedTotal = line.rolls.reduce((s, r) => s + r.quantityMeters, 0)
                const diff = receivedTotal - line.orderedMeters
                const diffColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#6b7280'

                return (
                  <div key={idx} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
                    {/* Summary row */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 130px 160px 90px',
                      padding: '10px 16px', alignItems: 'center', background: '#fff',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)' }}>
                        {line.fabricLabel || line.fabricId}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>
                        {line.orderedMeters > 0 ? `${line.orderedMeters.toFixed(2)} m` : '—'}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {receivedTotal > 0 ? `${receivedTotal.toFixed(2)} m` : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>0 m</span>}
                        </span>
                        {receivedTotal > 0 && line.orderedMeters > 0 && (
                          <div style={{ fontSize: 11, color: diffColor, marginTop: 1 }}>
                            {diff >= 0 ? '+' : ''}{diff.toFixed(2)} m vs ordered
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
                              <th style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Meters on label</th>
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
                                  <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-muted)' }}>m</span>
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
                const totalReceived = lines.reduce((s, l) => s + l.rolls.reduce((sr, r) => sr + r.quantityMeters, 0), 0)
                return (
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 130px 160px 90px',
                    padding: '8px 16px', background: '#f8fafc',
                    borderTop: '2px solid var(--border)',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    <div style={{ color: 'var(--text-muted)' }}>TOTAL</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{totalOrdered.toFixed(2)} m</div>
                    <div style={{ textAlign: 'right', color: 'var(--navy)' }}>{totalReceived.toFixed(2)} m</div>
                    <div />
                  </div>
                )
              })()}
            </div>
          )}

          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <div className="card">
        {loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>GRN Number</th>
                <th>PO Number</th>
                <th>Received Date</th>
                <th>Items</th>
                <th>Status</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state">No GRNs yet</div></td></tr>
              ) : items.map(g => (
                <tr key={g.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/grn/${g.id}`)}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{g.grnNumber}</td>
                  <td>{g.poNumber}</td>
                  <td>{g.receivedDate}</td>
                  <td>{g.itemCount}</td>
                  <td><span className={`badge ${statusBadge(g.status)}`}>{g.status}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    {g.status !== 'CONFIRMED' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => confirmGrn(g.id)}>Confirm</button>
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
