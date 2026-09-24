import { useParams, useNavigate } from 'react-router-dom'
import { FileText } from '../icons'
import { purchasePartiesApi, type PurchaseParty } from '../api/purchaseParties'
import { useApiData } from '../hooks/useApiData'
import { BackButton, InfoRow, statusBadge } from '../components/ui'

export default function PurchasePartyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: party, loading, error } = useApiData(
    () => id ? purchasePartiesApi.getById(id) : Promise.resolve(null as PurchaseParty | null),
    [id]
  )

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>
  if (error || !party) return (
    <div className="page">
      <BackButton onClick={() => navigate('/purchase-parties')} />
      <div className="empty-state" style={{ marginTop: 24 }}>
        <FileText size={40} />
        <p>{error || 'Purchase party not found'}</p>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton onClick={() => navigate('/purchase-parties')} />
          <div>
            <div className="page-title" style={{ marginBottom: 2 }}>{party.partyName}</div>
            <span className={`badge ${statusBadge(party.status)}`}>{party.status}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Purchase Party
          </h2>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 40 }}>
          <InfoRow label="Party Name" value={party.partyName} />
          <InfoRow label="Kind" value={party.partyKind === 'ACCESSORY' ? 'Accessory' : 'Fabric'} />
          <InfoRow label="GST Number" value={party.gstNumber ?? '—'} />
          <InfoRow label="Person Name" value={party.companyName ?? '—'} />
          <InfoRow label="Phone" value={party.phone ?? '—'} />
          <InfoRow label="Email" value={party.email ?? '—'} />
          <InfoRow label="Status" value={party.status} />
          {party.address && (
            <div style={{ gridColumn: '1 / -1' }}>
              <InfoRow label="Address" value={party.address} />
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Purchase Orders
          </h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>PO number</th>
              <th>Item details</th>
              <th>Order value</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(party.orders ?? []).length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">No purchase orders for this party yet.</div>
                </td>
              </tr>
            ) : (party.orders ?? []).map(order => (
              <tr key={order.poId}>
                <td>
                  <button
                    type="button"
                    className="btn-icon"
                    style={{ fontWeight: 600, color: 'var(--navy)', width: 'auto', padding: 0 }}
                    onClick={() => navigate(
                      order.poKind === 'ACCESSORY' || order.poNumber.startsWith('APO-')
                        ? `/accessory-purchase-orders/${order.poId}`
                        : `/purchase-orders/${order.poId}`
                    )}
                  >
                    {order.poNumber}
                  </button>
                </td>
                <td style={{ fontSize: 13 }}>{order.itemDetails}</td>
                <td>₹{Number(order.orderValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td>{order.poDate}</td>
                <td><span className={`badge ${statusBadge(order.status)}`}>{order.status.replace(/_/g, ' ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
