/** Short display suffix for a stored unit of measure. */
export function shortUnit(uom?: string | null): string {
  switch ((uom ?? '').trim().toUpperCase()) {
    case 'METER':
    case 'METRE':
    case 'MTR':
    case 'MTRS':
      return 'm'
    case 'KG':
      return 'kg'
    case 'PCS':
    case 'PIECE':
    case 'PIECES':
      return 'pcs'
    case 'CONE':
      return 'cone'
    case 'SETS':
    case 'SET':
      return 'sets'
    default:
      return uom ? uom.toLowerCase() : ''
  }
}

/** Column-header word, e.g. "Meters (from label)". */
export function unitWord(uom?: string | null): string {
  switch ((uom ?? '').trim().toUpperCase()) {
    case 'METER':
    case 'METRE':
    case 'MTR':
    case 'MTRS':
      return 'Meters'
    case 'KG':
      return 'Kg'
    case 'PCS':
    case 'PIECE':
    case 'PIECES':
      return 'Pieces'
    case 'CONE':
      return 'Cones'
    case 'SETS':
    case 'SET':
      return 'Sets'
    default:
      return uom ? uom : 'Quantity'
  }
}

/** " 12.5 kg". Empty suffix when the unit is unknown. */
export function qtyWithUnit(value: number, uom?: string | null, digits?: number): string {
  const text = digits != null ? value.toFixed(digits) : value.toLocaleString()
  const unit = shortUnit(uom)
  return unit ? `${text} ${unit}` : text
}

/** Suffix including a leading space when every entry shares one unit; otherwise empty. */
export function sharedUnitSuffix(uoms: (string | null | undefined)[]): string {
  const labels = [...new Set(uoms.map(u => shortUnit(u)).filter(Boolean))]
  return labels.length === 1 ? ` ${labels[0]}` : ''
}
