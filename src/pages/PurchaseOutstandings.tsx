import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { outstandingsApi, type PartyOutstanding, type PartyPayment } from '../api/outstandings'
import { Modal, FormError, FormActions, today, LoadError } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

const inr = (v: number) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', fontWeight: 700 }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }

export default function PurchaseOutstandings() {
  const navigate = useNavigate()
  const [parties, setParties] = useState<PartyOutstanding[]>([])
  const [payments, setPayments] = useState<PartyPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [partyFilter, setPartyFilter] = useState('')
  const [onlyDue, setOnlyDue] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showPay, setShowPay] = useState<PartyOutstanding | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(today())
  const [payMode, setPayMode] = useState('')
  const [payRef, setPayRef] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true); setLoadError('')
    Promise.all([outstandingsApi.summary(), outstandingsApi.payments()])
      .then(([s, p]) => { setParties(s); setPayments(p) })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const visible = parties.filter(p =>
    (!partyFilter || p.purchasePartyId === partyFilter) && (!onlyDue || p.outstanding > 0.005 || p.advance > 0.005))
  const grandOutstanding = visible.reduce((s, p) => s + p.outstanding, 0)

  const openPay = (p: PartyOutstanding) => {
    setShowPay(p); setPayAmount(''); setPayDate(today()); setPayMode(''); setPayRef(''); setError('')
  }

  // Preview of how the amount will be spread: oldest bill first, after any advance already held
  const split = useMemo(() => {
    if (!showPay) return []
    let left = Number(payAmount) || 0
    return showPay.bills
      .filter(b => b.outstanding > 0.005)
      .map(b => {
        const take = Math.min(left, b.outstanding)
        left -= take
        return { bill: b, take, after: b.outstanding - take }
      })
  }, [showPay, payAmount])
  const unallocated = showPay ? Math.max(0, (Number(payAmount) || 0) - split.reduce((s, r) => s + r.take, 0)) : 0

  const savePayment = async () => {
    if (!showPay) return
    const amount = Number(payAmount)
    if (!(amount > 0)) { setError('Enter an amount greater than 0'); return }
    if (!payDate) { setError('Payment date is required'); return }
    setSaving(true); setError('')
    try {
      await outstandingsApi.recordPayment({
        purchasePartyId: showPay.purchasePartyId, paymentDate: payDate, amount,
        mode: payMode || undefined, reference: payRef || undefined,
      })
      setShowPay(null); load()
    } catch (e: any) { isForbiddenError(e) ? setError(PERMISSION_DENIED_MSG) : setError(e.message) }
    finally { setSaving(false) }
  }

  const reverse = (p: PartyPayment) =>
    showConfirm('Reverse payment', `Reverse payment of ₹${inr(p.amount)} on ${p.paymentDate}? Bill balances will be recalculated.`, async () => {
      try { await outstandingsApi.deletePayment(p.id); load() }
      catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Reverse Failed', e.message) }
    })

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Purchase Outstandings</div>
          <div className="page-subtitle" style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginTop: 4 }}>Total outstanding ₹{inr(grandOutstanding)} across {visible.length} part{visible.length === 1 ? 'y' : 'ies'}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', padding: '12px 16px' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 240 }}>
            <label>Purchase Party</label>
            <select value={partyFilter} onChange={e => setPartyFilter(e.target.value)}>
              <option value="">All parties</option>
              {parties.map(p => <option key={p.purchasePartyId} value={p.purchasePartyId}>{p.purchasePartyName}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, paddingBottom: 8 }}>
            <input type="checkbox" checked={onlyDue} onChange={e => setOnlyDue(e.target.checked)} style={{ width: 'auto' }} />
            Only parties with balance
          </label>
        </div>
      </div>

      {loadError ? <LoadError message={loadError} onRetry={load} /> : loading ? <div className="loading">Loading…</div> :
        visible.length === 0 ? <div className="card"><div className="empty-state">No outstanding bills</div></div> :
        visible.map(p => {
          const open = !collapsed[p.purchasePartyId]
          // chronological payments of this party (API returns newest first)
          const partyPayments = payments.filter(x => x.purchasePartyId === p.purchasePartyId).slice().reverse()
          const payLinesFor = (billNo: string) => partyPayments.flatMap(pay =>
            pay.allocations.filter(a => a.billNo === billNo).map(a => ({ pay, applied: a.amount })))
          const status = (b: { outstanding: number; amountPaid: number }) =>
            b.outstanding <= 0.005 ? { t: 'PAID', c: '#15803d', bg: '#dcfce7' }
              : b.amountPaid > 0.005 ? { t: 'PARTIAL', c: '#b45309', bg: '#fef3c7' }
              : { t: 'UNPAID', c: '#b91c1c', bg: '#fee2e2' }
          const pct = p.totalAmount > 0 ? Math.min(100, (p.amountPaid / p.totalAmount) * 100) : 0
          return (
            <div key={p.purchasePartyId} style={{ marginBottom: 20, border: '1px solid #cbd5e1', borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
              {/* Party header */}
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', cursor: 'pointer', background: 'linear-gradient(90deg,#0f1f4d,#1e3a8a)', color: '#fff' }}
                onClick={() => setCollapsed(c => ({ ...c, [p.purchasePartyId]: open }))}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '0.01em' }}>
                    <span style={{ opacity: 0.7, marginRight: 8, fontSize: 12 }}>{open ? '▼' : '▶'}</span>{p.purchasePartyName}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                    Account statement · {p.bills.length} bill{p.bills.length !== 1 ? 's' : ''}
                    {p.advance > 0.005 && <> · advance ₹{inr(p.advance)}</>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                  {[['Billed', p.totalAmount, '#fff'], ['Paid', p.amountPaid, '#86efac'], ['Outstanding', p.outstanding, p.outstanding > 0.005 ? '#fca5a5' : '#86efac']].map(([l, v, c]) => (
                    <div key={l as string} style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>{l as string}</div>
                      <div style={{ fontSize: l === 'Outstanding' ? 20 : 15, fontWeight: 700, color: c as string, fontVariantNumeric: 'tabular-nums' }}>₹{inr(v as number)}</div>
                    </div>
                  ))}
                  <button className="btn btn-sm" style={{ background: '#fff', color: '#0f1f4d', fontWeight: 700 }}
                    onClick={e => { e.stopPropagation(); openPay(p) }}>Record Payment</button>
                </div>
              </div>
              <div style={{ height: 3, background: '#e2e8f0' }}><div style={{ width: `${pct}%`, height: '100%', background: '#16a34a' }} /></div>

              {open && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ ...th, textAlign: 'left' }}>Invoice No</th>
                      <th style={{ ...th, textAlign: 'left' }}>Bill Date</th>
                      <th style={{ ...th, textAlign: 'left' }}>GRN / PO</th>
                      <th style={{ ...th, textAlign: 'center' }}>Status</th>
                      <th style={{ ...th, textAlign: 'right' }}>Debit (Bill)</th>
                      <th style={{ ...th, textAlign: 'right' }}>Credit (Paid)</th>
                      <th style={{ ...th, textAlign: 'right' }}>Balance</th>
                      <th style={{ ...th, width: 110 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {p.bills.map(b => {
                      const st = status(b)
                      const lines = payLinesFor(b.billNo)
                      let running = b.totalAmount
                      return (
                        <Fragment key={b.billId}>
                          <tr style={{ background: '#fff', borderTop: '1px solid #cbd5e1', cursor: 'pointer' }} onClick={() => navigate(`/grn/${b.grnId}`)}>
                            <td style={{ ...td, fontWeight: 700, color: 'var(--navy)' }}>{b.billNo}</td>
                            <td style={td}>{b.billDate}</td>
                            <td style={{ ...td, color: '#475569' }}>{b.grnNumber} / {b.poNumber}</td>
                            <td style={{ ...td, textAlign: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 12, color: st.c, background: st.bg, letterSpacing: '0.05em' }}>{st.t}</span>
                            </td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{inr(b.totalAmount)}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#15803d' }}>{inr(b.amountPaid)}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: b.outstanding > 0.005 ? '#b91c1c' : '#15803d' }}>{inr(b.outstanding)}</td>
                            <td />
                          </tr>
                          {lines.length > 0 && (
                            <tr>
                              <td colSpan={8} style={{ padding: '0 0 0 36px', background: '#f8fafc', borderTop: '1px dashed #e2e8f0' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600 }}>Payment Date</th>
                                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600 }}>Mode</th>
                                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600 }}>Reference</th>
                                      <th style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 600 }}>Applied to Bill</th>
                                      <th style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 600 }}>Balance After</th>
                                      <th style={{ width: 110 }} />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lines.map(({ pay, applied }) => {
                                      running -= applied
                                      return (
                                        <tr key={pay.id + b.billId} style={{ borderTop: '1px solid #e2e8f0' }}>
                                          <td style={{ padding: '7px 14px' }}>{pay.paymentDate}</td>
                                          <td style={{ padding: '7px 14px' }}>{pay.mode ?? '—'}</td>
                                          <td style={{ padding: '7px 14px', color: '#475569' }}>{pay.reference ?? '—'}</td>
                                          <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: '#15803d' }}>
                                            {inr(applied)}
                                            {Math.abs(pay.amount - applied) > 0.005 && (
                                              <div style={{ fontSize: 10, fontWeight: 400, color: '#64748b' }}>part of ₹{inr(pay.amount)} payment</div>
                                            )}
                                          </td>
                                          <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 600 }}>{inr(running)}</td>
                                          <td style={{ padding: '4px 14px', textAlign: 'right' }}>
                                            <button className="btn btn-sm btn-secondary" style={{ fontSize: 11 }} onClick={() => reverse(pay)}>Reverse</button>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#0f1f4d', color: '#fff', fontWeight: 700 }}>
                      <td style={{ ...td, background: '#0f1f4d', fontSize: 12, letterSpacing: '0.06em', color: '#fff' }} colSpan={4}>TOTAL</td>
                      <td style={{ ...td, background: '#0f1f4d', textAlign: 'right', color: '#fff' }}>{inr(p.totalAmount)}</td>
                      <td style={{ ...td, background: '#0f1f4d', textAlign: 'right', color: '#86efac' }}>{inr(p.amountPaid)}</td>
                      <td style={{ ...td, background: '#0f1f4d', textAlign: 'right', color: p.outstanding > 0.005 ? '#fca5a5' : '#86efac' }}>{inr(p.outstanding)}</td>
                      <td style={{ background: '#0f1f4d' }} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )
        })}

      {showPay && (
        <Modal title={`Record Payment — ${showPay.purchasePartyName}`} onClose={() => setShowPay(null)} width={640}>
          <FormError message={error} />
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            Current outstanding: <b>₹{inr(showPay.outstanding)}</b>. The amount clears the oldest bill first, then the next.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Amount Paid *</label>
              <input type="number" step="0.01" min="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label>Payment Date *</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Mode</label>
              <select value={payMode} onChange={e => setPayMode(e.target.value)}>
                <option value="">—</option>
                {['CASH', 'BANK TRANSFER', 'UPI', 'CHEQUE'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Reference</label>
              <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="UTR / cheque no" />
            </div>
          </div>
          {split.length > 0 && (
            <table style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}>Invoice</th>
                  <th style={{ ...th, textAlign: 'right' }}>Outstanding</th>
                  <th style={{ ...th, textAlign: 'right' }}>This payment</th>
                  <th style={{ ...th, textAlign: 'right' }}>Balance after</th>
                </tr>
              </thead>
              <tbody>
                {split.map(r => (
                  <tr key={r.bill.billId}>
                    <td style={td}>{r.bill.billNo}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{inr(r.bill.outstanding)}</td>
                    <td style={{ ...td, textAlign: 'right', color: r.take > 0 ? '#16a34a' : undefined }}>{inr(r.take)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{inr(r.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {unallocated > 0.005 && (
            <div style={{ fontSize: 12, color: '#b45309', marginTop: 6 }}>
              ₹{inr(unallocated)} is more than the outstanding; it is kept as advance and applied to the next bill.
            </div>
          )}
          <FormActions onCancel={() => setShowPay(null)} onSave={savePayment} saving={saving} />
        </Modal>
      )}
    </div>
  )
}
