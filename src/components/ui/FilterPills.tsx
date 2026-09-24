export function FilterPills({
  options,
  value,
  onChange,
  allLabel = 'All',
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  allLabel?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
      {['', ...options].map(opt => (
        <button
          key={opt || '__all'}
          onClick={() => onChange(opt)}
          style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12.5,
            fontWeight: 500, cursor: 'pointer',
            border: '1.5px solid ' + (value === opt ? 'var(--navy)' : 'var(--border)'),
            background: value === opt ? 'var(--navy)' : 'var(--white)',
            color: value === opt ? 'var(--white)' : 'var(--text-muted)',
          }}
        >
          {opt || allLabel}
        </button>
      ))}
    </div>
  )
}
