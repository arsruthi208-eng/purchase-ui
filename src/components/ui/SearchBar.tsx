import { Search } from '../../icons'

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div style={{
      padding: '12px 16px', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <Search size={16} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ border: 'none', outline: 'none', flex: 1, background: 'transparent', fontSize: 14 }}
      />
    </div>
  )
}
