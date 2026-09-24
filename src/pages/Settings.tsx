import { useEffect, useRef, useState } from 'react'
import { settingsApi, type SignerConfig, type SignatureSettings } from '../api/settings'

// ── Roles ────────────────────────────────────────────────────────────────────
const ROLES = [
  { key: 'preparedBy'   as const, label: 'Prepared by'    },
  { key: 'checkedBy'    as const, label: 'Checked by'     },
  { key: 'authorisedBy' as const, label: 'Authorised by'  },
]

// ── SignaturePad component ───────────────────────────────────────────────────
function SignaturePad({
  value,
  onChange,
}: {
  value: string
  onChange: (dataUrl: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing   = useRef(false)
  const lastPos   = useRef<{ x: number; y: number } | null>(null)

  // If an existing value is provided, draw it on mount / value change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (value && value.startsWith('data:image')) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = value
    }
  }, [])   // only on mount — user drawing will update via emit

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY }
  }

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    drawing.current = true
    const canvas = canvasRef.current!
    lastPos.current = getPos(e, canvas)
  }
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current!
    onChange(canvas.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div>
      <div style={{
        border: '1.5px solid #cbd5e1', borderRadius: 8, background: '#f8fafc',
        display: 'inline-block', cursor: 'crosshair', touchAction: 'none',
      }}>
        <canvas
          ref={canvasRef}
          width={340}
          height={120}
          style={{ display: 'block', borderRadius: 8 }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
      </div>
      <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }} onClick={clear}>
          Clear
        </button>
        <label className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px', cursor: 'pointer' }}>
          Upload image
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = ev => {
                const dataUrl = ev.target?.result as string
                const canvas  = canvasRef.current!
                const ctx     = canvas.getContext('2d')!
                const img     = new Image()
                img.onload = () => {
                  ctx.clearRect(0, 0, canvas.width, canvas.height)
                  // Scale to fit
                  const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
                  const w = img.width * scale
                  const h = img.height * scale
                  ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
                  onChange(canvas.toDataURL('image/png'))
                }
                img.src = dataUrl
                e.target.value = ''
              }
              reader.readAsDataURL(file)
            }}
          />
        </label>
      </div>
    </div>
  )
}

// ── Main Settings page ───────────────────────────────────────────────────────
export default function Settings() {
  const [settings, setSettings] = useState<SignatureSettings>({
    preparedBy: null, checkedBy: null, authorisedBy: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    settingsApi.getSignatures()
      .then(s => setSettings(s))
      .finally(() => setLoading(false))
  }, [])

  const updateRole = (key: keyof SignatureSettings, field: keyof SignerConfig, val: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { name: '', image: '' }), [field]: val },
    }))
    setSaved(false)
  }

  const save = async () => {
    // Validate: if a role has an image it must have a name (and vice versa)
    for (const { key, label } of ROLES) {
      const cfg = settings[key]
      if (cfg && (!cfg.name.trim() || !cfg.image)) {
        setError(`${label}: both name and signature are required if you want to configure this role.`)
        return
      }
    }
    setSaving(true); setError('')
    try {
      const updated = await settingsApi.updateSignatures(settings)
      setSettings(updated)
      setSaved(true)
    } catch (e: any) {
      setError(e.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page"><div className="page-header"><div className="page-title">Settings</div></div><p>Loading…</p></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Configure e-signatures for Purchase Orders</div>
        </div>
      </div>

      <div style={{ maxWidth: 820 }}>
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
          padding: '10px 14px', marginBottom: 24, fontSize: 13, color: '#1d4ed8'
        }}>
          <strong>How it works:</strong> Set up the name and signature image for each role once here.
          When you sign a PO, the current signature is stamped permanently on that PO's PDF.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {ROLES.map(({ key, label }) => {
            const cfg = settings[key]
            return (
              <div key={key} style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                padding: '18px 20px'
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: '#1e293b' }}>
                  {label}
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* Name field */}
                  <div style={{ flex: '0 0 220px' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
                      Full Name
                    </label>
                    <input
                      placeholder={`${label} name`}
                      value={cfg?.name ?? ''}
                      onChange={e => updateRole(key, 'name', e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                    {cfg?.image && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#16a34a' }}>✓ Signature configured</div>
                    )}
                  </div>

                  {/* Signature pad */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
                      Signature (draw or upload)
                    </label>
                    <SignaturePad
                      value={cfg?.image ?? ''}
                      onChange={val => updateRole(key, 'image', val)}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {error && (
          <div style={{
            marginTop: 16, background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13
          }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Signatures'}
          </button>
          {saved && <span style={{ color: '#16a34a', fontSize: 13, fontWeight: 600 }}>✓ Saved successfully</span>}
        </div>
      </div>
    </div>
  )
}
