import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from '../icons'
import { schoolsApi, type School, type CreateSchoolRequest } from '../api/schools'
import { SearchBar } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

export default function Schools() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<School | null>(null)
  const [form, setForm] = useState<CreateSchoolRequest>({ schoolCode: '', schoolName: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true)
    schoolsApi.list().then(setSchools).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = schools.filter(s =>
    s.schoolName.toLowerCase().includes(search.toLowerCase()) ||
    s.schoolCode.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditing(null)
    setForm({ schoolCode: '', schoolName: '' })
    setError('')
    setShowForm(true)
  }

  const openEdit = (s: School) => {
    setEditing(s)
    setForm({ schoolCode: s.schoolCode, schoolName: s.schoolName, contactPerson: s.contactPerson, phone: s.phone, email: s.email, address: s.address })
    setError('')
    setShowForm(true)
  }

  const save = async () => {
    if (!form.schoolCode.trim() || !form.schoolName.trim()) { setError('Code and name are required'); return }
    setSaving(true); setError('')
    try {
      if (editing) await schoolsApi.update(editing.id, form)
      else await schoolsApi.create(form)
      setShowForm(false); load()
    } catch (e: any) {
      if (isForbiddenError(e)) showError('Access Denied', PERMISSION_DENIED_MSG)
      else setError(e.message)
    } finally { setSaving(false) }
  }

  const deactivate = (id: string) => {
    showConfirm(
      'Deactivate School',
      'This school will be hidden from new entries. Existing orders are unaffected.',
      async () => { try { await schoolsApi.deactivate(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Deactivate Failed', e.message) } }
    )
  }

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Schools</div>
          <div className="page-subtitle">{schools.length} active school clients</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Add School</button>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 480, boxShadow: 'var(--shadow-md)' }}>
            <div className="card-header"><h2>{editing ? 'Edit School' : 'Add School'}</h2></div>
            <div className="card-body">
              {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>{error}</div>}
              {!editing && (
                <div className="form-group">
                  <label>School Code *</label>
                  <input placeholder="e.g. AUSCH026" value={form.schoolCode} onChange={e => setForm(p => ({ ...p, schoolCode: e.target.value.toUpperCase() }))} />
                </div>
              )}
              <div className="form-group"><label>School Name *</label><input value={form.schoolName} onChange={e => setForm(p => ({ ...p, schoolName: e.target.value }))} /></div>
              <div className="form-group"><label>Contact Person</label><input value={form.contactPerson ?? ''} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label>Phone</label><input value={form.phone ?? ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                <div className="form-group"><label>Email</label><input value={form.email ?? ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label>Address</label><textarea rows={2} value={form.address ?? ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
              <div className="flex gap-2 mt-4" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <SearchBar value={search} onChange={setSearch} placeholder="Search schools…" />
        {loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead><tr><th>Code</th><th>School Name</th><th>Contact</th><th>Phone</th><th>Status</th><th style={{ width: 80 }}></th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state">No schools found</div></td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{s.schoolCode}</td>
                  <td style={{ fontWeight: 500 }}>{s.schoolName}</td>
                  <td>{s.contactPerson ?? '—'}</td>
                  <td>{s.phone ?? '—'}</td>
                  <td><span className={`badge ${s.status === 'ACTIVE' ? 'badge-success' : 'badge-draft'}`}>{s.status}</span></td>
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
