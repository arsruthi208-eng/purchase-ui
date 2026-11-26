import { SearchableSelect } from './SearchableSelect'

const CUSTOM_SENTINEL = '__custom__'

interface Props {
  value: string
  onChange: (value: string) => void
  /** Dropdown values (shown as-is) */
  presets: string[]
  placeholder?: string
  /** Text of the last dropdown row, e.g. "Enter custom transport…" */
  customLabel?: string
  customPlaceholder?: string
  /** Use a textarea for the custom entry (long text such as addresses) */
  multiline?: boolean
  maxLength?: number
  /** Convert custom text on entry (e.g. upper-case units) */
  transform?: (v: string) => string
  style?: React.CSSProperties
}

/**
 * Searchable dropdown of preset values plus a "custom" row. Choosing custom (or holding a
 * value that is not a preset) reveals a text field underneath. Shared by Purchase Order
 * transport / address and the Accessory DC unit.
 */
export function PresetOrCustomSelect({
  value, onChange, presets, placeholder = 'Select…', customLabel = 'Enter custom value…',
  customPlaceholder, multiline, maxLength, transform, style,
}: Props) {
  const isPreset = presets.includes(value)
  return (
    <div style={style}>
      <SearchableSelect
        value={isPreset ? value : CUSTOM_SENTINEL}
        onChange={v => onChange(v === CUSTOM_SENTINEL ? '' : v)}
        placeholder={placeholder}
        options={[
          ...presets.map(p => ({ value: p, label: p })),
          { value: CUSTOM_SENTINEL, label: `✏️ ${customLabel}` },
        ]}
        style={{ marginBottom: isPreset ? 0 : 6 }}
      />
      {!isPreset && (
        multiline ? (
          <textarea
            rows={1}
            placeholder={customPlaceholder}
            maxLength={maxLength}
            value={value}
            onChange={e => onChange(transform ? transform(e.target.value) : e.target.value)}
          />
        ) : (
          <input
            type="text"
            placeholder={customPlaceholder}
            maxLength={maxLength}
            value={value}
            onChange={e => onChange(transform ? transform(e.target.value) : e.target.value)}
          />
        )
      )}
    </div>
  )
}
