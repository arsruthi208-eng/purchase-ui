interface SummaryItem {
  styleName: string
  gender?: string
  standard?: string
  size?: string
}

/** "Shirt (BOYS) - Std 5, 6 | Pant - Size 30, 32" — mirrors what the DC itself shows. */
export function summarizeItems(items: SummaryItem[] | undefined, maxStyles = 3): string {
  if (!items || items.length === 0) return ''
  const groups = new Map<string, string[]>()
  items.forEach(it => {
    const key = it.gender ? `${it.styleName} (${it.gender})` : it.styleName
    const label = it.size ? `Size ${it.size}` : it.standard ? `Std ${it.standard}` : ''
    const list = groups.get(key) ?? []
    if (label && !list.includes(label)) list.push(label)
    groups.set(key, list)
  })
  const parts = [...groups.entries()].map(([k, v]) => {
    const std = v.filter(l => l.startsWith('Std ')).map(l => l.slice(4))
    const size = v.filter(l => l.startsWith('Size ')).map(l => l.slice(5))
    const bits = [std.length ? `Std ${std.join(', ')}` : '', size.length ? `Size ${size.join(', ')}` : ''].filter(Boolean)
    return bits.length ? `${k} - ${bits.join(' / ')}` : k
  })
  const shown = parts.slice(0, maxStyles).join(' | ')
  return parts.length > maxStyles ? `${shown} | +${parts.length - maxStyles} more` : shown
}
