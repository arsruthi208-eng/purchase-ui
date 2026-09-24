import type { ReactNode } from 'react'

export interface StockShortfall {
  name: string
  required: number
  available: number
  shortfall: number
  unit?: string
}

/**
 * Generic alert / confirm dialog — used for validation errors, stock warnings,
 * and any destructive-action confirmations that need more context than window.alert().
 *
 * variant="error"   → red heading, single "OK" button
 * variant="warning" → amber heading, "Cancel" + "Proceed anyway" buttons
 * variant="confirm" → navy heading, "Cancel" + "Confirm" buttons
 */
export function AlertDialog({
  title,
  message,
  details,
  stockShortfalls,
  variant = 'error',
  onClose,
  onConfirm,
  confirmLabel = 'Confirm',
}: {
  title: string
  message?: string
  details?: ReactNode
  stockShortfalls?: StockShortfall[]
  variant?: 'error' | 'warning' | 'confirm'
  onClose: () => void
  onConfirm?: () => void
  confirmLabel?: string
}) {
  const colors = {
    error:   { bg: '#fef2f2', border: '#fca5a5', heading: '#b91c1c', icon: '✕' },
    warning: { bg: '#fffbeb', border: '#fcd34d', heading: '#92400e', icon: '⚠' },
    confirm: { bg: '#f0f9ff', border: '#93c5fd', heading: '#1e40af', icon: '?' },
  }[variant]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 60, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          width: stockShortfalls ? 520 : 400, maxWidth: '100%', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, color: colors.heading }}>{colors.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: colors.heading }}>{title}</span>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          {message && (
            <p style={{ fontSize: 14, color: '#374151', marginBottom: stockShortfalls ? 14 : 0, lineHeight: 1.5 }}>
              {message}
            </p>
          )}
          {details && <div style={{ fontSize: 13, color: '#4b5563' }}>{details}</div>}

          {/* Stock shortfall table */}
          {stockShortfalls && stockShortfalls.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>Item</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>Required</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>Available</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>Short</th>
                </tr>
              </thead>
              <tbody>
                {stockShortfalls.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '7px 8px', fontWeight: 500 }}>{s.name}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>{s.required.toLocaleString()} {s.unit ?? ''}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: s.available <= 0 ? '#dc2626' : '#374151' }}>
                      {s.available.toLocaleString()} {s.unit ?? ''}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                      -{s.shortfall.toLocaleString()} {s.unit ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {variant !== 'error' && (
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          )}
          {variant === 'warning' && onConfirm && (
            <button
              className="btn"
              style={{ background: '#d97706', color: '#fff', border: 'none' }}
              onClick={() => { onClose(); onConfirm() }}
            >
              {confirmLabel}
            </button>
          )}
          {variant === 'confirm' && onConfirm && (
            <button className="btn btn-primary" onClick={() => { onClose(); onConfirm() }}>
              {confirmLabel}
            </button>
          )}
          {variant === 'error' && (
            <button className="btn btn-primary" onClick={onClose}>OK</button>
          )}
        </div>
      </div>
    </div>
  )
}
