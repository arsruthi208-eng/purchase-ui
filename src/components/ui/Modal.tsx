import type { ReactNode } from 'react'

export function Modal({
  title,
  width = 480,
  onClose,
  children,
}: {
  title: string
  width?: number | string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: 'var(--shadow-md)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="card-header">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  )
}

export function FormError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
      {message}
    </div>
  )
}

export function FormActions({
  onCancel,
  onSave,
  saving,
  saveLabel = 'Save',
}: {
  onCancel: () => void
  onSave: () => void
  saving: boolean
  saveLabel?: string
}) {
  return (
    <div className="flex gap-2 mt-4" style={{ justifyContent: 'flex-end' }}>
      <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      <button className="btn btn-primary" onClick={onSave} disabled={saving}>
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  )
}
