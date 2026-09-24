import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from '../icons'
import { coloursApi, type Colour, type CreateColourRequest } from '../api/colours'
import { Modal, FormError, FormActions, statusBadge, LoadError, FilterBar } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

const empty: CreateColourRequest = { colourName: '', hexCode: '' }

export default function Colours() {
  const [items, setItems] = useState<Colour[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Colour | null>(null)
  const [form, setForm] = useState<CreateColourRequest>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true)
    setLoadError('')
    coloursApi.list()
      .then(setItems)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = items.filter(c => {
    if (statusFilter && c.status !== statusFilter) return false
    return (
      c.colourName.toLowerCase().includes(search.toLowerCase()) ||
      (c.hexCode ?? '').toLowerCase().includes(search.toLowerCase())
    )
  })

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setError('')
    setShowForm(true)
  }

  const openEdit = (c: Colour) => {
    setEditing(c)
    setForm({ colourName: c.colourName, hexCode: c.hexCode })
    setError('')
    setShowForm(true)
  }

  const save = async () => {
    if (!form.colourName.trim()) { setError('Colour name is required'); return }
    setSaving(true); setError('')
    try {
      if (editing) await coloursApi.update(editing.id, form)
      else await coloursApi.create(form)
      setShowForm(false); load()
    } catch (e: any) {
      if (isForbiddenError(e)) showError('Access Denied', PERMISSION_DENIED_MSG)
      else setError(e.message)
    } finally { setSaving(false) }
  }

  const deactivate = (id: string) => {
    showConfirm(
      'Deactivate Colour',
      'This colour will be hidden from new entries. Existing records are unaffected.',
      async () => { try { await coloursApi.deactivate(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Deactivate Failed', e.message) } }
    )
  }

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Colours</div>
          <div className="page-subtitle">{items.length} active colours</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Add Colour</button>
      </div>

      {showForm && (
        <Modal title={editing ? 'Edit Colour' : 'Add Colour'} onClose={() => setShowForm(false)}>
          <FormError message={error} />
          <div className="form-group">
            <label>Colour Name *</label>
            <input value={form.colourName} onChange={e => setForm(p => ({ ...p, colourName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Hex Code</label>
            <div className="flex gap-2" style={{ alignItems: 'center' }}>
              <input
                type="color"
                value={form.hexCode && /^#[0-9A-Fa-f]{6}$/.test(form.hexCode) ? form.hexCode : '#000000'}
                onChange={e => setForm(p => ({ ...p, hexCode: e.target.value.toUpperCase() }))}
                style={{ width: 40, height: 36, padding: 2, cursor: 'pointer' }}
              />
              <input
                placeholder="#RRGGBB"
                value={form.hexCode ?? ''}
                onChange={e => setForm(p => ({ ...p, hexCode: e.target.value.toUpperCase() }))}
                style={{ flex: 1 }}
              />
            </div>
          </div>
          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <div className="card">
        <FilterBar
          filters={[{ label: 'Status', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }], value: statusFilter, onChange: setStatusFilter, allLabel: 'All statuses' }]}
          search={{ placeholder: 'Colour name or hex code…', value: search, onChange: setSearch }}
          count={filtered.length} countLabel="colours"
        />
        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>Swatch</th>
                <th>Colour Name</th>
                <th>Hex</th>
                <th>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state">No colours found</div></td></tr>
              ) : filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        background: c.hexCode || '#ccc',
                      }}
                      title={c.hexCode}
                    />
                  </td>
                  <td style={{ fontWeight: 500 }}>{c.colourName}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.hexCode ?? '—'}</td>
                  <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(c)}><Pencil size={14} /></button>
                      <button className="btn-icon" title="Deactivate" onClick={() => deactivate(c.id)}><Trash2 size={14} /></button>
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
