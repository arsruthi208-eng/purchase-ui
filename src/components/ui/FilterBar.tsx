export interface FilterDef {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  allLabel?: string
}

export function FilterBar({
  filters,
  search,
  count,
  countLabel = 'records',
}: {
  filters: FilterDef[]
  search: { placeholder: string; value: string; onChange: (v: string) => void }
  count?: number
  countLabel?: string
}) {
  const colTemplate = [
    ...filters.map(() => 'minmax(140px, 1fr)'),
    'minmax(180px, 1.4fr)',
  ].join(' ')

  return (
    <div style={{
      display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
      padding: '12px 16px', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: colTemplate, gap: 10, flex: 1, minWidth: 0 }}>
        {filters.map((f, i) => (
          <div key={i} className="form-group" style={{ marginBottom: 0 }}>
            <label>{f.label}</label>
            <select value={f.value} onChange={e => f.onChange(e.target.value)}>
              <option value="">{f.allLabel ?? `All ${f.label.toLowerCase()}`}</option>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Search</label>
          <input
            placeholder={search.placeholder}
            value={search.value}
            onChange={e => search.onChange(e.target.value)}
          />
        </div>
      </div>
      {count != null && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 8, whiteSpace: 'nowrap' }}>
          {count.toLocaleString()} {countLabel}
        </div>
      )}
    </div>
  )
}
