import { useEffect, useState, useMemo } from 'react'
import { Plus, Pencil, Trash2 } from '../icons'
import { stylesApi, type Style, type CreateStyleRequest, type UpdateStyleRequest } from '../api/styles'
import { schoolsApi, type School } from '../api/schools'
import { Modal, FormError, FormActions, statusBadge, LoadError, FilterBar } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

const emptyCreate: CreateStyleRequest = { styleCode: '', styleName: '', pattern: '', fabricConsumptionRate: undefined, schoolIds: [] }

export default function Styles() {
  const [items, setItems] = useState<Style[]>([])
  const [patterns, setPatterns] = useState<string[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [patternFilter, setPatternFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Style | null>(null)
  const [form, setForm] = useState<CreateStyleRequest>(emptyCreate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [schoolSearch, setSchoolSearch] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true)
    setLoadError('')
    Promise.all([
      stylesApi.list(patternFilter || undefined),
      stylesApi.patterns(),
      schoolsApi.list(),
    ]).then(([s, p, sc]) => {
      setItems(s)
      setPatterns(p)
      setSchools(sc.filter(sc => sc.status === 'ACTIVE').sort((a, b) => a.schoolName.localeCompare(b.schoolName)))
    }).catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [patternFilter])

  const filtered = items.filter(s => {
    const matchSearch =
      s.styleName.toLowerCase().includes(search.toLowerCase()) ||
      s.styleCode.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || s.status === statusFilter
    return matchSearch && matchStatus
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyCreate, pattern: patternFilter || patterns[0] || '', schoolIds: [] })
    setError('')
    setSchoolSearch('')
    setShowForm(true)
  }

  const openEdit = (s: Style) => {
    setEditing(s)
    setForm({
      styleCode: s.styleCode,
      styleName: s.styleName,
      pattern: s.pattern,
      fabricConsumptionRate: s.fabricConsumptionRate,
      schoolIds: s.schoolIds ?? [],
    })
    setError('')
    setSchoolSearch('')
    setShowForm(true)
  }

  const toggleSchool = (schoolId: string) => {
    setForm(prev => {
      const current = prev.schoolIds ?? []
      return {
        ...prev,
        schoolIds: current.includes(schoolId)
          ? current.filter(id => id !== schoolId)
          : [...current, schoolId],
      }
    })
  }

  const selectAllSchools = () => setForm(prev => ({ ...prev, schoolIds: schools.map(s => s.id) }))
  const clearAllSchools  = () => setForm(prev => ({ ...prev, schoolIds: [] }))

  const filteredSchools = useMemo(() =>
    schoolSearch.trim()
      ? schools.filter(s => s.schoolName.toLowerCase().includes(schoolSearch.toLowerCase()))
      : schools,
    [schools, schoolSearch]
  )

  const save = async () => {
    if (!form.styleCode.trim() || !form.styleName.trim() || !form.pattern.trim()) {
      setError('Style code, name, and pattern are required'); return
    }
    setSaving(true); setError('')
    try {
      if (editing) {
        const req: UpdateStyleRequest = {
          styleName: form.styleName,
          pattern: form.pattern,
          fabricConsumptionRate: form.fabricConsumptionRate,
          schoolIds: form.schoolIds ?? [],
        }
        await stylesApi.update(editing.id, req)
      } else {
        await stylesApi.create(form)
      }
      setShowForm(false); load()
    } catch (e: any) {
      if (isForbiddenError(e)) showError('Access Denied', PERMISSION_DENIED_MSG)
      else setError(e.message)
    } finally { setSaving(false) }
  }

  const deactivate = (id: string) => {
    showConfirm(
      'Deactivate Style',
      'This style will be hidden from new entries. Existing records are unaffected.',
      async () => { try { await stylesApi.deactivate(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Deactivate Failed', e.message) } }
    )
  }

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Styles</div>
          <div className="page-subtitle">{items.length} active styles</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Add Style</button>
      </div>


      {showForm && (
        <Modal title={editing ? 'Edit Style' : 'Add Style'} onClose={() => setShowForm(false)}>
          <FormError message={error} />
          {!editing && (
            <div className="form-group">
              <label>Style Code *</label>
              <input
                placeholder="e.g. STY001"
                value={form.styleCode}
                onChange={e => setForm(p => ({ ...p, styleCode: e.target.value.toUpperCase() }))}
              />
            </div>
          )}
          <div className="form-group">
            <label>Style Name *</label>
            <input value={form.styleName} onChange={e => setForm(p => ({ ...p, styleName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Pattern *</label>
            {patterns.length > 0 ? (
              <select value={form.pattern} onChange={e => setForm(p => ({ ...p, pattern: e.target.value }))}>
                <option value="">Select pattern</option>
                {patterns.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <input value={form.pattern} onChange={e => setForm(p => ({ ...p, pattern: e.target.value }))} />
            )}
          </div>
          <div className="form-group">
            <label>Fabric Consumption Rate <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(metres per piece)</span></label>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 1.2"
              value={form.fabricConsumptionRate ?? ''}
              onChange={e => setForm(p => ({ ...p, fabricConsumptionRate: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>

          {/* School association */}
          <div className="form-group">
            {/* Header row: label + counts + bulk actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ margin: 0 }}>
                Schools
                <span style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 700,
                  background: (form.schoolIds ?? []).length > 0 ? 'var(--navy)' : '#e5e7eb',
                  color: (form.schoolIds ?? []).length > 0 ? '#fff' : '#6b7280',
                  borderRadius: 20, padding: '1px 8px',
                }}>
                  {(form.schoolIds ?? []).length} / {schools.length}
                </span>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={selectAllSchools}
                  style={{ fontSize: 11, padding: '2px 10px', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: '#f8fafc', color: '#374151' }}>
                  Select All
                </button>
                <button type="button" onClick={clearAllSchools}
                  style={{ fontSize: 11, padding: '2px 10px', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', background: '#fff1f2', color: '#dc2626' }}>
                  Clear All
                </button>
              </div>
            </div>

            {/* Search inside schools */}
            <input
              type="text"
              placeholder="🔍  Search school name…"
              value={schoolSearch}
              onChange={e => setSchoolSearch(e.target.value)}
              style={{ marginBottom: 6, fontSize: 12 }}
            />

            {/* Schools grid */}
            <div style={{
              border: '1px solid var(--border)', borderRadius: 6,
              maxHeight: 240, overflowY: 'auto', background: '#fafafa',
            }}>
              {schools.length === 0 ? (
                <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                  Loading schools…
                </div>
              ) : filteredSchools.length === 0 ? (
                <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                  No schools match "{schoolSearch}"
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 3, padding: 6,
                }}>
                  {filteredSchools.map(sc => {
                    const checked = (form.schoolIds ?? []).includes(sc.id)
                    return (
                      <label
                        key={sc.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 10px', borderRadius: 5, cursor: 'pointer',
                          background: checked ? '#eff6ff' : '#fff',
                          border: `1.5px solid ${checked ? '#93c5fd' : '#e5e7eb'}`,
                          transition: 'background 0.1s, border-color 0.1s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSchool(sc.id)}
                          style={{ margin: 0, flexShrink: 0, accentColor: 'var(--navy)', width: 14, height: 14 }}
                        />
                        <span style={{
                          fontSize: 12,
                          fontWeight: checked ? 600 : 400,
                          color: checked ? '#1e40af' : '#374151',
                          lineHeight: 1.35,
                          wordBreak: 'break-word',
                        }}>
                          {sc.schoolName}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Selected school chips preview */}
            {(form.schoolIds ?? []).length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(form.schoolIds ?? []).slice(0, 8).map(sid => {
                  const sc = schools.find(s => s.id === sid)
                  return sc ? (
                    <span key={sid} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: '#eff6ff', color: 'var(--navy)',
                      border: '1px solid #bfdbfe', borderRadius: 20,
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', cursor: 'pointer',
                    }} onClick={() => toggleSchool(sid)} title="Click to remove">
                      {sc.schoolName} ×
                    </span>
                  ) : null
                })}
                {(form.schoolIds ?? []).length > 8 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 4px', alignSelf: 'center' }}>
                    +{(form.schoolIds ?? []).length - 8} more
                  </span>
                )}
              </div>
            )}
          </div>

          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <div className="card">
        <FilterBar
          filters={[
            { label: 'Pattern', options: patterns.map(p => ({ value: p, label: p })), value: patternFilter, onChange: setPatternFilter, allLabel: 'All patterns' },
            { label: 'Status', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }], value: statusFilter, onChange: setStatusFilter, allLabel: 'All statuses' },
          ]}
          search={{ placeholder: 'Style code or name…', value: search, onChange: setSearch }}
          count={filtered.length} countLabel="styles"
        />
        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Style Name</th>
                <th>Pattern</th>
                <th style={{ textAlign: 'right' }}>m/piece</th>
                <th>Schools</th>
                <th>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state">No styles found</div></td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{s.styleCode}</td>
                  <td style={{ fontWeight: 500 }}>{s.styleName}</td>
                  <td><span className="badge badge-info">{s.pattern}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 500, color: s.fabricConsumptionRate ? 'var(--navy)' : 'var(--text-muted)' }}>
                    {s.fabricConsumptionRate != null ? `${s.fabricConsumptionRate} m` : '—'}
                  </td>
                  <td>
                    <SchoolTags names={s.schoolNames ?? []} />
                  </td>
                  <td><span className={`badge ${statusBadge(s.status)}`}>{s.status}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(s)}><Pencil size={14} /></button>
                      <button className="btn-icon" title="Deactivate" onClick={() => deactivate(s.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Helper: school name tags ─────────────────────────────────────────────────
function SchoolTags({ names }: { names: string[] }) {
  if (names.length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>

  const MAX_VISIBLE = 2
  const visible = names.slice(0, MAX_VISIBLE)
  const extra = names.length - MAX_VISIBLE

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {visible.map(name => (
        <span
          key={name}
          style={{
            background: '#eff6ff',
            color: '#1d4ed8',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
      ))}
      {extra > 0 && (
        <span
          title={names.slice(MAX_VISIBLE).join(', ')}
          style={{
            background: '#f1f5f9',
            color: '#64748b',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 11,
            cursor: 'default',
          }}
        >
          +{extra} more
        </span>
      )}
    </div>
  )
}
