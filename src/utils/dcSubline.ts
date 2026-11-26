interface SublineItem { styleName?: string }

interface SublineDc {
  orderListLabel?: string | null
  orderSubject?: string | null
  items?: SublineItem[]
}

/** "LIST-1 · Boys Shirt, Girls Pinafore +1" shown under the DC number in list pages. */
export function dcSubline(dc: SublineDc, maxStyles = 2): string {
  const names = [...new Set((dc.items ?? []).map(i => i.styleName).filter((n): n is string => !!n))]
  const styles = names.length
    ? names.slice(0, maxStyles).join(', ') + (names.length > maxStyles ? ` +${names.length - maxStyles}` : '')
    : ''
  return [dc.orderListLabel, styles, dc.orderSubject].filter(Boolean).join(' · ')
}
