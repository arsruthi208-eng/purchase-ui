import { useState, useRef, useEffect } from 'react'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  style?: React.CSSProperties
  className?: string
}

export function SearchableSelect({ value, onChange, options, placeholder = 'Select…', disabled, style, className }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    if (disabled) return
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSelect = (opt: SelectOption) => {
    onChange(opt.value)
    setOpen(false)
    setQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setOpen(false)
    setQuery('')
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', ...style }}
      className={className}
    >
      {/* Trigger */}
      <div
        onClick={handleOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '8px 32px 8px 12px',
          border: `1.5px solid ${open ? 'var(--navy)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          fontSize: 14,
          fontFamily: 'inherit',
          color: selected ? 'var(--text-main)' : 'var(--text-muted, #9ca3af)',
          background: disabled ? 'var(--off-white, #f9fafb)' : 'var(--white)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          minHeight: 38,
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        {/* Clear button when value selected */}
        {value && !disabled && (
          <span
            onMouseDown={handleClear}
            style={{
              position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1,
            }}
            title="Clear"
          >×</span>
        )}
        {/* Chevron */}
        <span style={{
          position: 'absolute', right: 8, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          fontSize: 10, color: 'var(--text-muted)', transition: 'transform 0.15s', pointerEvents: 'none',
        }}>▼</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          background: 'var(--white)', border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          maxHeight: 220, display: 'flex', flexDirection: 'column',
        }}>
          {/* Search input */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search…"
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', padding: '5px 8px', border: '1px solid var(--border)',
                borderRadius: 4, fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          {/* Options */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-muted)' }}>No options</div>
            ) : (
              filtered.map(opt => (
                <div
                  key={opt.value}
                  onMouseDown={() => handleSelect(opt)}
                  style={{
                    padding: '8px 12px', fontSize: 14, cursor: 'pointer',
                    background: opt.value === value ? 'var(--off-white, #f3f4f6)' : 'transparent',
                    fontWeight: opt.value === value ? 600 : 400,
                    color: 'var(--text-main)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--off-white, #f3f4f6)')}
                  onMouseLeave={e => (e.currentTarget.style.background = opt.value === value ? 'var(--off-white, #f3f4f6)' : 'transparent')}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
