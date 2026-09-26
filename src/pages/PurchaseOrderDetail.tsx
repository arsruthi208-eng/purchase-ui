import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Printer } from '../icons'
import { purchaseOrdersApi, type PoDetail } from '../api/purchaseOrders'
import { useApiData } from '../hooks/useApiData'
import { BackButton, InfoRow, DocStat, StatsStrip, StatDivider, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'
import { printPurchaseOrder } from '../utils/printPurchaseOrder'

const SIGN_ROLES = [
  { role: 'PREPARED_BY',   label: 'Prepared by',   requiredStatus: 'DRAFT'     },
  { role: 'CHECKED_BY',    label: 'Checked by',    requiredStatus: 'PREPARED'  },
  { role: 'AUTHORISED_BY', label: 'Authorised by', requiredStatus: 'CHECKED'   },
]

function fmtSignedAt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: po, loading, error, reload } = useApiData(
    () => id ? purchaseOrdersApi.getById(id) : Promise.resolve(null as PoDetail | null),
    [id]
  )
  const [actionBusy, setActionBusy] = useState(false)
  const [signingRole, setSigningRole] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const { dialog, showError, showConfirm } = useAlertDialog()

  const doChangeStatus = async (status: string) => {
    if (!po) return
    setActionBusy(true)
    try { await purchaseOrdersApi.updateStatus(po.id, status); reload() }
    catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Status Update Failed', e.message) } finally { setActionBusy(false) }
  }

  const doSign = async (role: string, label: string) => {
    if (!po) return
    setSigningRole(role)
    try { await purchaseOrdersApi.sign(po.id, role); reload() }
    catch (e: any) { showError(`Sign as ${label} Failed`, e.message) }
    finally { setSigningRole(null) }
  }

  const handleSign = (role: string, label: string) => {
    showConfirm(
      `Sign as ${label}`,
      `Sign PO ${po?.poNumber} as "${label}"? This will advance the PO status and cannot be undone.`,
      () => doSign(role, label),
      `Sign as ${label}`
    )
  }

  const changeStatus = (status: string) => {
    if (!po) return
    const action = status === 'OPEN' ? 'Open' : 'Close'
    const totalValue = po.items.reduce((s, i) => s + i.orderedQuantity * i.unitPrice, 0)
    showConfirm(
      `${action} Purchase Order`,
      `${action} PO ${po.poNumber} for ${po.purchasePartyName ?? 'purchase party'}?`,
      () => doChangeStatus(status),
      action,
      <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>
        <div><strong>Items:</strong> {po.items.length}</div>
        <div><strong>Total Value:</strong> ₹{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>
    )
  }

  const handlePrint = async () => {
    if (!po) return
    setPrinting(true)
    try { await printPurchaseOrder(po) }
    catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Print Failed', e.message) }
    finally { setPrinting(false) }
  }

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (error || !po) return (
    <div className="page">
      <BackButton onClick={() => navigate(-1)} />
      <div className="empty-state" style={{ marginTop: 24 }}><FileText size={40} /><p>{error || 'Not found'}</p></div>
    </div>
  )

  const isAccessory = po.poKind === 'ACCESSORY'
  const listPath = isAccessory ? '/accessory-purchase-orders' : '/purchase-orders'
  const totalOrdered = po.items.reduce((s, i) => s + i.orderedQuantity, 0)
  const _totalValue  = po.items.reduce((s, i) => s + i.orderedQuantity * i.unitPrice, 0)
  const uoms = [...new Set(po.items.map(i => i.unitOfMeasure))]
  const qtySuffix = isAccessory
    ? (uoms.length === 1 ? ` ${uoms[0]}` : '')
    : ' m'

  return (
    <div className="page">
      {dialog}

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton onClick={() => navigate(listPath)} />
          <div>
            <div className="page-title" style={{ marginBottom: 2 }}>{po.poNumber}</div>
            <span className={`badge ${statusBadge(po.status)}`}>{po.status.replace(/_/g, ' ')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={handlePrint}
            disabled={printing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} weight="fill" />
            {printing ? 'Preparing…' : 'Print / PDF'}
          </button>
          {/* E-sign buttons — show only the next applicable role */}
          {SIGN_ROLES.filter(r => r.requiredStatus === po.status).map(r => (
            <button
              key={r.role}
              className="btn btn-primary"
              disabled={signingRole !== null}
              onClick={() => handleSign(r.role, r.label)}
            >
              {signingRole === r.role ? 'Signing…' : `Sign as ${r.label}`}
            </button>
          ))}
          {/* AUTHORISED → OPEN */}
          {po.status === 'AUTHORISED' && (
            <button className="btn btn-primary" disabled={actionBusy} onClick={() => changeStatus('OPEN')}>
              {actionBusy ? '…' : 'Open PO'}
            </button>
          )}
          {po.status === 'OPEN' && (
            <button className="btn btn-secondary" disabled={actionBusy} onClick={() => changeStatus('CLOSED')}>
              {actionBusy ? '…' : 'Close PO'}
            </button>
          )}
        </div>
      </div>

      {/* ── Section 1: Summary ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Order Summary
          </h2>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 40 }}>
          <InfoRow label="PO Number"         value={po.poNumber} />
          <InfoRow label="PO Date"           value={po.poDate} />
          <InfoRow label="Expected Delivery" value={po.expectedDeliveryDate ?? '—'} />
          <InfoRow label="Status"            value={po.status.replace(/_/g, ' ')} />
          {po.schoolOrderNumber && <InfoRow label="Sales Order"  value={po.schoolOrderNumber} />}
          {po.schoolName        && <InfoRow label="School"        value={po.schoolName} />}
          <InfoRow label="Purchase Party"    value={po.purchasePartyName ?? '—'} />
          {po.purchasePartyPhone   && <InfoRow label="Party Phone"   value={po.purchasePartyPhone} />}
          {po.purchasePartyAddress && <InfoRow label="Party Address" value={po.purchasePartyAddress} />}
          <InfoRow label="Party GST"         value={po.gstNumber ?? '—'} />
          {po.styleName  && <InfoRow label="Style"  value={po.styleName} />}
          {po.deliveryAddress  && <div style={{ gridColumn: '1 / -1' }}><InfoRow label="Delivery Address"  value={po.deliveryAddress} /></div>}
          {po.shippingAddress  && <div style={{ gridColumn: '1 / -1' }}><InfoRow label="Shipping Address"  value={po.shippingAddress} /></div>}
          {po.transportDetails && <div style={{ gridColumn: '1 / -1' }}><InfoRow label="Transport Details" value={po.transportDetails} /></div>}
          {po.notes            && <div style={{ gridColumn: '1 / -1' }}><InfoRow label="Notes"             value={po.notes} /></div>}
        </div>
        <StatsStrip>
          <DocStat label="Line Items"    value={po.items.length.toString()} />
          <StatDivider />
          <DocStat label="Total Ordered" value={`${totalOrdered.toLocaleString()}${qtySuffix}`} />
        </StatsStrip>
      </div>

      {/* ── Section 2: E-Signatures ── */}
      {(() => {
        const sigs = po.signatures ?? []
        const allRolesWithStatus = SIGN_ROLES.map(r => ({
          ...r,
          sig: sigs.find(s => s.role === r.role) ?? null,
        }))
        return (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Signatures
              </h2>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {allRolesWithStatus.map(({ role, label, sig }) => (
                <div key={role} style={{
                  flex: '1 1 200px', border: '1px solid var(--border)', borderRadius: 8,
                  padding: 14, background: sig ? '#f0fdf4' : '#f8fafc', minWidth: 180
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
                    {label}
                  </div>
                  {sig ? (
                    <>
                      <img src={sig.signatureImage} alt="signature" style={{ height: 56, maxWidth: '100%', objectFit: 'contain', display: 'block', marginBottom: 6 }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>{sig.signerName}</div>
                      <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>{fmtSignedAt(sig.signedAt)}</div>
                    </>
                  ) : (
                    <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      Not yet signed
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── Section 3: Line items ── */}
      <div className="card">
        <div className="card-header">
          <h2>Line Items</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{po.items.length} item{po.items.length !== 1 ? 's' : ''}</span>
        </div>
        <table>
          <thead>
            {isAccessory ? (
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Accessory</th>
                <th>UoM</th>
                <th style={{ textAlign: 'right' }}>Quantity</th>
                <th style={{ textAlign: 'right' }}>Unit Price</th>
                <th>Status</th>
              </tr>
            ) : (
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Fabric</th>
                <th>Colour</th>
                <th style={{ textAlign: 'right' }}>Width</th>
                <th style={{ textAlign: 'right' }}>GSM</th>
                <th>UoM</th>
                <th style={{ textAlign: 'right' }}>Meters (ordered)</th>
                <th style={{ textAlign: 'right' }}>Received Qty</th>
                <th style={{ textAlign: 'right' }}>Unit Price</th>
                <th>Status</th>
              </tr>
            )}
          </thead>
          <tbody>
            {po.items.map((item, idx) => isAccessory ? (
              <tr key={item.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                <td>{item.accessoryType ?? '—'}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.accessoryCode}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.accessoryName}</div>
                </td>
                <td>{item.unitOfMeasure}</td>
                <td style={{ textAlign: 'right' }}>{item.orderedQuantity.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>₹{item.unitPrice.toFixed(2)}</td>
                <td><span className={`badge ${statusBadge(item.status)}`}>{item.status.replace(/_/g, ' ')}</span></td>
              </tr>
            ) : (
              <tr key={item.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                <td>{item.fabricType ?? '—'}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.fabricCode}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.fabricName}</div>
                </td>
                <td>{item.colourName ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{item.widthInches != null ? `${item.widthInches}"` : '—'}</td>
                <td style={{ textAlign: 'right' }}>{item.weightGsm != null ? item.weightGsm : '—'}</td>
                <td>{item.unitOfMeasure}</td>
                <td style={{ textAlign: 'right' }}>{item.orderedQuantity.toLocaleString()} m</td>
                <td style={{ textAlign: 'right', color: item.receivedQuantity > 0 ? 'var(--navy)' : 'var(--text-muted)' }}>
                  {item.receivedQuantity.toLocaleString()}
                </td>
                <td style={{ textAlign: 'right' }}>₹{item.unitPrice.toFixed(2)}</td>
                <td><span className={`badge ${statusBadge(item.status)}`}>{item.status.replace(/_/g, ' ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
