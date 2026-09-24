import type { ReactNode } from 'react'
import { statusBadge } from './Badges'

/** Small label + value card, typically used in a grid of metadata. */
export function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '12px 16px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{value}</div>
    </div>
  )
}

/** Navy background stat card. */
export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--navy)', color: '#fff', borderRadius: 8, padding: '14px 18px' }}>
      <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: 20 }}>{value}</div>
    </div>
  )
}

/** Page shell for detail pages: back button + doc number + status + optional action button. */
export function DetailPageShell({
  docNumber,
  status,
  onBack,
  action,
  children,
}: {
  docNumber: string
  status: string
  onBack: () => void
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Back
          </button>
          <div>
            <div className="page-title" style={{ marginBottom: 2 }}>{docNumber}</div>
            <span className={`badge ${statusBadge(status)}`}>{status.replace(/_/g, ' ')}</span>
          </div>
        </div>
        {action && <div style={{ display: 'flex', gap: 8 }}>{action}</div>}
      </div>
      {children}
    </div>
  )
}

/** Thin wrapper around a <table> that accepts typed column headers. */
export function ItemsTable({
  headers,
  children,
  footer,
}: {
  headers: string[]
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <table>
      <thead>
        <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
      {footer && <tfoot>{footer}</tfoot>}
    </table>
  )
}
