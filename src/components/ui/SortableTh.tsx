import type { ThHTMLAttributes } from 'react'

/**
 * A <th> that shows a sort-direction arrow and toggles it on click.
 * Use inside any <thead> where you want client-side date sorting.
 *
 * Usage:
 *   const [sortDesc, setSortDesc] = useState(true)   // newest first by default
 *   <SortableTh label="Date" desc={sortDesc} onToggle={() => setSortDesc(p => !p)} />
 */
export function SortableTh({
  label,
  desc,
  onToggle,
  style,
  ...rest
}: {
  label: string
  desc: boolean
  onToggle: () => void
} & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...rest}
      onClick={onToggle}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
      title={desc ? 'Newest first — click to show oldest first' : 'Oldest first — click to show newest first'}
    >
      {label}{' '}
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
        {desc ? '↓' : '↑'}
      </span>
    </th>
  )
}
