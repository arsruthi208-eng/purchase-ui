import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText } from '../icons'
import { grnApi, type GrnDetail as GrnDetailType } from '../api/grn'
import { fabricsApi } from '../api/fabrics'
import { accessoriesApi } from '../api/accessories'
import { useApiData, useApiList } from '../hooks/useApiData'
import { BackButton, InfoRow, DocStat, StatsStrip, StatDivider, statusBadge, Modal, FormError, FormActions, today } from '../components/ui'
import { GrnBillForm, emptyBill, billFromExisting, billToRequest, type BillFormState } from '../components/GrnBillForm'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'
import { shortUnit, sharedUnitSuffix } from '../utils/units'

export default function GrnDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: grn, loading, error, reload } = useApiData(
    () => id ? grnApi.getById(id) : Promise.resolve(null as GrnDetailType | null),
    [id]
  )
  const { data: fabrics } = useApiList(() => fabricsApi.list())
  const { data: accessories } = useApiList(() => accessoriesApi.list())
  const [actionBusy, setActionBusy] = useState(false)
  const { dialog, showError, showConfirm } = useAlertDialog()
  const [billOpen, setBillOpen] = useState(false)
  const [billForm, setBillForm] = useState<BillFormState>(emptyBill(today()))
  const [billErr, setBillErr] = useState('')
  const [billSaving, setBillSaving] = useState(false)

  const openBill = () => {
    if (!grn) return
    const recv = grn.items.reduce((s, i) => s + i.receivedQuantity, 0)
    const price = grn.items.length === 1 ? grn.items[0].unitPrice : 0
    setBillForm(grn.bill ? billFromExisting(grn.bill) : { ...emptyBill(grn.receivedDate), qty: String(recv), price: price ? String(price) : '' })
    setBillErr('')
    setBillOpen(true)
  }
  const saveBill = async () => {
    if (!grn) return
    if (!billForm.billNo.trim()) { setBillErr('Bill No is required'); return }
    if (!billForm.billDate) { setBillErr('Bill Date is required'); return }
    setBillSaving(true); setBillErr('')
    try { await grnApi.saveBill(grn.id, billToRequest(billForm)); setBillOpen(false); reload() }
    catch (e: any) { isForbiddenError(e) ? setBillErr(PERMISSION_DENIED_MSG) : setBillErr(e.message) }
    finally { setBillSaving(false) }
  }

  const doConfirmGrn = async () => {
    if (!grn) return
    setActionBusy(true)
    try { await grnApi.confirm(grn.id); reload() }
    catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } finally { setActionBusy(false) }
  }

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (error || !grn) return (
    <div className="page">
      <BackButton onClick={() => navigate(-1)} />
      <div className="empty-state" style={{ marginTop: 24 }}><FileText size={40} /><p>{error || 'Not found'}</p></div>
    </div>
  )

  const isAccessory = grn.grnKind === 'ACCESSORY'
  const unitOfCode = (code: string) =>
    fabrics.find(f => f.fabricCode === code)?.unitOfMeasure
    ?? accessories.find(a => a.accessoryCode === code)?.unitOfMeasure
    ?? 'METER'
  const totalReceived = grn.items.reduce((s, i) => s + i.receivedQuantity, 0)
  const totalValue    = grn.items.reduce((s, i) => s + i.receivedQuantity * i.unitPrice, 0)
  const totalSuffix = sharedUnitSuffix(grn.items.map(i => i.unitOfMeasure ?? unitOfCode(i.fabricCode)))

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton onClick={() => navigate(-1)} />
          <div>
            <div className="page-title" style={{ marginBottom: 2 }}>{grn.grnNumber}</div>
            <span className={`badge ${statusBadge(grn.status)}`}>{grn.status}</span>
          </div>
        </div>
        {grn.status !== 'CONFIRMED' && (
          <button className="btn btn-primary" disabled={actionBusy}
            onClick={() => showConfirm('Confirm GRN', isAccessory ? 'Please ensure the accessories have been received and stored in the stockroom. This cannot be undone.' : 'Please ensure that the fabric rolls have been received and stored in the stockroom. This cannot be undone.', doConfirmGrn)}>
            {actionBusy ? 'Confirming…' : 'Confirm GRN'}
          </button>
        )}
      </div>

      {/* ── Section 1: Summary ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Document Summary
          </h2>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 40 }}>
          <InfoRow label="GRN Number"    value={grn.grnNumber} />
          <InfoRow label="PO Number"     value={grn.poNumber} />
          <InfoRow label="Received Date" value={grn.receivedDate} />
          <InfoRow label="Purchase Party" value={grn.purchasePartyName ?? '—'} />
          <InfoRow label="Vehicle No."   value={grn.vehicleNumber ?? '—'} />
          <InfoRow label="Status"        value={grn.status} />
          <InfoRow label="Kind"          value={isAccessory ? 'Accessory' : 'Fabric'} />
          {grn.notes && <div style={{ gridColumn: '1 / -1' }}><InfoRow label="Notes" value={grn.notes} /></div>}
        </div>
        <StatsStrip>
          <DocStat label="Items"              value={grn.items.length.toString()} />
          <StatDivider />
          <DocStat label="Total Qty Received" value={`${totalReceived.toLocaleString()}${totalSuffix}`} />
          <StatDivider />
          <DocStat label="Total Value"        value={`₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
        </StatsStrip>
      </div>

      {/* ── Supplier bill ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2>Supplier Bill</h2>
          <button className="btn btn-sm btn-secondary" onClick={openBill}>{grn.bill ? 'Edit Bill' : 'Add Bill'}</button>
        </div>
        {grn.bill ? (() => {
          const b = grn.bill
          const m = (v: number) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          return (
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', rowGap: 14, columnGap: 40 }}>
              <InfoRow label="Bill No" value={b.billNo} />
              <InfoRow label="Bill Date" value={b.billDate} />
              <InfoRow label="Particulars" value={b.particulars ?? '—'} />
              <InfoRow label="Qty" value={Number(b.qty).toLocaleString()} />
              <InfoRow label="Price" value={m(b.price)} />
              <InfoRow label="Amount" value={m(b.amount)} />
              <InfoRow label="Others (Ins/Packaging)" value={m(b.otherCharges)} />
              <InfoRow label="Taxable" value={m(b.taxable)} />
              <InfoRow label="GST" value={m(b.gst)} />
              <InfoRow label="R.Off" value={m(b.roundOff)} />
              <InfoRow label="Total" value={m(b.total)} />
            </div>
          )
        })() : (
          <div style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-muted)' }}>No bill entered for this GRN yet.</div>
        )}
      </div>

      {billOpen && (
        <Modal title={grn.bill ? 'Edit Bill' : 'Add Bill'} onClose={() => setBillOpen(false)} width={860}>
          <FormError message={billErr} />
          <GrnBillForm value={billForm} onChange={setBillForm} />
          <FormActions onCancel={() => setBillOpen(false)} onSave={saveBill} saving={billSaving} />
        </Modal>
      )}

      {/* ── Section 2: Items ── */}
      <div className="card">
        <div className="card-header">
          <h2>Received Items</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{grn.items.length} line{grn.items.length !== 1 ? 's' : ''}</span>
        </div>

        {grn.items.map((item, idx) => {
          const rollTotal = item.rolls?.reduce((s, r) => s + Number(r.quantityMeters), 0) ?? 0
          const unit = shortUnit(item.unitOfMeasure ?? unitOfCode(item.fabricCode))
          return (
            <div key={item.id} style={{ borderTop: idx === 0 ? '1px solid var(--border)' : '2px solid var(--border)' }}>

              {/* ── Fabric header bar ── */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px', background: '#f8fafc',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', background: 'var(--navy)',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{idx + 1}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{item.itemCode ?? item.fabricCode}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{item.itemName ?? item.fabricName}{item.accessoryType ? ` · ${item.accessoryType}` : ''}</div>
                  </div>
                  {item.colourName && (
                    <span style={{
                      fontSize: 12, padding: '2px 10px', background: '#e0e7ff', color: '#3730a3',
                      borderRadius: 20, fontWeight: 600,
                    }}>{item.colourName}</span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>
                    {Number(item.receivedQuantity).toFixed(2)} {unit}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {isAccessory
                      ? (Number(item.unitPrice) > 0 ? `@ ₹${Number(item.unitPrice).toFixed(2)}` : 'No price')
                      : `${item.rolls?.length ?? 0} roll${(item.rolls?.length ?? 0) !== 1 ? 's' : ''}`}
                  </div>
                </div>
              </div>

              {/* ── Rolls table ── */}
              {isAccessory ? (
                item.notes ? <div style={{ padding: '10px 20px', fontSize: 13, color: 'var(--text-muted)' }}>{item.notes}</div> : null
              ) : item.rolls && item.rolls.length > 0 ? (
                <div style={{ padding: '0 20px 16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '33.33%' }} />
                      <col style={{ width: '33.33%' }} />
                      <col style={{ width: '33.33%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                        <th style={{ padding: '9px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Roll No</th>
                        <th style={{ padding: '9px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty per roll</th>
                        <th style={{ padding: '9px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.rolls.map((r) => {
                        const isPending = (r as any).status === 'PENDING'
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '11px 20px', fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>
                              {r.rollNumber}
                            </td>
                            <td style={{ padding: '11px 20px', fontSize: 14, fontWeight: 600, color: '#111' }}>
                              {Number(r.quantityMeters).toFixed(2)}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>
                            </td>
                            <td style={{ padding: '11px 20px' }}>
                              <span style={{
                                fontSize: 11, padding: '3px 12px', borderRadius: 20, fontWeight: 600,
                                background: isPending ? '#fef9c3' : '#dcfce7',
                                color: isPending ? '#854d0e' : '#15803d',
                              }}>
                                {isPending ? 'Pending' : 'Available'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid var(--border)' }}>
                        <td style={{ padding: '9px 20px', fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</td>
                        <td style={{ padding: '9px 20px', fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>
                          {rollTotal.toFixed(2)}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)' }}>No roll details recorded.</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
