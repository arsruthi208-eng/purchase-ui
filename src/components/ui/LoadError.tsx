/** Shown when a list/detail fetch fails — replaces silent empty tables. */
export function LoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      className="empty-state"
      style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 8,
        margin: 16,
        color: '#991b1b',
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 6 }}>Could not load data</p>
      <p style={{ fontSize: 13, color: '#b91c1c', marginBottom: onRetry ? 14 : 0 }}>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-primary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}
