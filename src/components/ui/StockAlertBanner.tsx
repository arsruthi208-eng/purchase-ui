interface BelowMinItem {
  name: string
  balance: number
  minStockMeters: number
  /** Short label such as "m" or "kg". */
  unit: string
}

interface Props {
  items: BelowMinItem[]
}

export function StockAlertBanner({ items }: Props) {
  if (items.length === 0) return null
  return (
    <div style={{
      background: '#fef2f2',
      border: '1px solid #fca5a5',
      borderRadius: 8,
      padding: '12px 16px',
      marginBottom: 20,
    }}>
      <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 8, fontSize: 14 }}>
        ⚠ Stock Alert — {items.length} fabric{items.length > 1 ? 's are' : ' is'} below minimum level
      </div>
      <ul style={{ margin: 0, paddingLeft: 20, color: '#7f1d1d', fontSize: 13 }}>
        {items.map(i => (
          <li key={i.name} style={{ marginBottom: 2 }}>
            <b>{i.name}</b>
            {' — '}Current: <b>{i.balance.toLocaleString()} {i.unit}</b>
            {' | '}Minimum: {i.minStockMeters.toLocaleString()} {i.unit}
            {' | '}Short by: <b style={{ color: '#dc2626' }}>{(i.minStockMeters - i.balance).toLocaleString()} {i.unit}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}
