import type { ReactNode } from 'react'

/** Maps a document/entity status string to a CSS badge class. */
export function statusBadge(status: string): string {
  const map: Record<string, string> = {
    ACTIVE:             'badge-success',
    DRAFT:              'badge-draft',
    OPEN:               'badge-info',
    CONFIRMED:          'badge-success',
    DISPATCHED:         'badge-success',
    PARTIALLY_RECEIVED: 'badge-warning',
    RECEIVED:           'badge-success',
    CLOSED:             'badge-draft',
    CANCELLED:          'badge-danger',
  }
  return map[status] ?? 'badge-draft'
}

/** Coloured icon + label + value summary card (used on list pages). */
export function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: color + '18', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontWeight: 700, fontSize: 18, color }}>{value}</div>
      </div>
    </div>
  )
}
