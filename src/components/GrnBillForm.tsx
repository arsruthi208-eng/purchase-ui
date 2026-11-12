import type { GrnBill, GrnBillRequest } from '../api/grn'

/** String-based form state so partially typed numbers are not mangled. */
export interface BillFormState {
  billNo: string
  billDate: string
  particulars: string
  qty: string
  price: string
  otherCharges: string
  gst: string
  roundOff: string
}

export const emptyBill = (date: string): BillFormState => ({
  billNo: '', billDate: date, particulars: '', qty: '', price: '', otherCharges: '', gst: '', roundOff: '',
})

export const billFromExisting = (b: GrnBill): BillFormState => ({
  billNo: b.billNo, billDate: b.billDate, particulars: b.particulars ?? '',
  qty: String(b.qty), price: String(b.price),
  otherCharges: b.otherCharges ? String(b.otherCharges) : '', gst: b.gst ? String(b.gst) : '',
  roundOff: b.roundOff ? String(b.roundOff) : '',
})

const n = (v: string) => Number(v) || 0
const r2 = (v: number) => Math.round(v * 100) / 100

export function calcBill(f: BillFormState) {
  const amount = r2(n(f.qty) * n(f.price))
  const taxable = r2(amount + n(f.otherCharges))
  const total = r2(taxable + n(f.gst) + n(f.roundOff))
  return { amount, taxable, total }
}

/** True when the user has typed anything into the bill block. */
export const billTouched = (f: BillFormState) =>
  !!(f.billNo.trim() || f.particulars.trim() || f.qty || f.price || f.otherCharges || f.gst || f.roundOff)

export function billToRequest(f: BillFormState): GrnBillRequest {
  return {
    billNo: f.billNo.trim(), billDate: f.billDate, particulars: f.particulars.trim() || undefined,
    qty: n(f.qty), price: n(f.price), otherCharges: n(f.otherCharges), gst: n(f.gst), roundOff: n(f.roundOff),
  }
}

const money = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function GrnBillForm({ value, onChange, amountPaid = 0 }: {
  value: BillFormState
  onChange: (v: BillFormState) => void
  /** Read-only: comes from party payments (Purchase Outstandings) */
  amountPaid?: number
}) {
  const set = (k: keyof BillFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [k]: e.target.value })
  const { amount, taxable, total } = calcBill(value)
  const balance = total - amountPaid

  const field = (k: keyof BillFormState, label: string, opts: { step?: string; ph?: string } = {}) => (
    <div className="form-group" style={{ marginBottom: 10 }}>
      <label>{label}</label>
      <input type="number" step={opts.step ?? '0.01'} placeholder={opts.ph ?? '0.00'} value={value[k]} onChange={set(k)}
        style={{ textAlign: 'right' }} />
    </div>
  )
  const row = (label: string, v: number, o: { bold?: boolean; top?: boolean; color?: string; sign?: string } = {}) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: o.bold ? '9px 0' : '6px 0', fontSize: o.bold ? 14 : 13,
      fontWeight: o.bold ? 700 : 400, color: o.color ?? (o.bold ? 'var(--navy)' : '#334155'),
      borderTop: o.top ? '1.5px solid #94a3b8' : 'none', fontVariantNumeric: 'tabular-nums',
    }}>
      <span>{label}</span><span>{o.sign ?? ''}{money(v)}</span>
    </div>
  )

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      {/* Invoice header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12, padding: '14px 18px 4px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
        <div className="form-group">
          <label>Bill / Invoice No</label>
          <input value={value.billNo} onChange={set('billNo')} placeholder="e.g. 302232" />
        </div>
        <div className="form-group">
          <label>Bill Date</label>
          <input type="date" value={value.billDate} onChange={set('billDate')} />
        </div>
        <div className="form-group">
          <label>Particulars</label>
          <input value={value.particulars} onChange={set('particulars')} placeholder="Description of goods" />
        </div>
      </div>

      {/* Inputs (left) and live invoice summary (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr' }}>
        <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 12, alignContent: 'start' }}>
          {field('qty', 'Qty (mtrs)', { step: '0.001' })}
          {field('price', 'Price per unit')}
          {field('otherCharges', 'Others (Ins / Packaging)')}
          {field('gst', 'GST Amount')}
          {field('roundOff', 'Round Off (+/-)')}
        </div>
        <div style={{ padding: '14px 20px', background: '#f8fafc', borderLeft: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
            Bill Summary
          </div>
          {row('Amount (Qty × Price)', amount)}
          {row('Others', Number(value.otherCharges) || 0, { sign: '+ ' })}
          {row('Taxable Value', taxable, { top: true, bold: false })}
          {row('GST', Number(value.gst) || 0, { sign: '+ ' })}
          {row('Round Off', Number(value.roundOff) || 0)}
          <div style={{ background: 'var(--navy)', color: '#fff', borderRadius: 6, padding: '0 12px', margin: '6px 0' }}>
            {row('TOTAL', total, { bold: true, color: '#fff' })}
          </div>
          {row('Amount Paid', amountPaid, { color: '#15803d' })}
          {row('Current Balance', balance, { top: true, bold: true, color: balance > 0.005 ? '#b91c1c' : '#15803d' })}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 18px', borderTop: '1px solid var(--border)' }}>
        Amount Paid is updated automatically from payments recorded under Purchase Outstandings.
      </div>
    </div>
  )
}
