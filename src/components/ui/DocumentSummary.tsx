import type { ReactNode } from 'react'
import { ArrowLeft } from '../../icons'

/** Consistent back-navigation button used on every detail page. */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <ArrowLeft size={15} /> Back
    </button>
  )
}

/** Key–value pair row rendered inside a document summary card. */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-main)' }}>{value}</span>
    </div>
  )
}

/** Single metric shown inside a StatsStrip at the bottom of a summary card. */
export function DocStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {label}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}>{value}</span>
    </div>
  )
}

/** Grey background strip at the bottom of a document summary card. */
export function StatsStrip({ children }: { children: ReactNode }) {
  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      padding: '12px 20px',
      display: 'flex',
      gap: 32,
      background: 'var(--off-white)',
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
    }}>
      {children}
    </div>
  )
}

/** Thin vertical divider between DocStat entries inside a StatsStrip. */
export const StatDivider = () => (
  <div style={{ width: 1, background: 'var(--border)' }} />
)
