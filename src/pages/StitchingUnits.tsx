import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from '../icons'
import { stitchingUnitsApi, type StitchingUnit, type CreateStitchingUnitRequest } from '../api/stitchingUnits'
import { Modal, FormError, FormActions, SearchBar, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

const UNIT_TYPES = ['Shirt Unit', 'Pant Unit', 'Coat Unit', 'Skirt Unit', 'Pinafore Unit', 'Frock Unit', 'Half Pant Unit', 'Other']

const empty: CreateStitchingUnitRequest = { unitName: '', unitType: '', address: '', phone: '' }

export default function StitchingUnits() {
  const [items, setItems] = useState<StitchingUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StitchingUnit | null>(null)
  const [form, setForm] = useState<CreateStitchingUnitRequest>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true)
    stitchingUnitsApi.list().then(setItems).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = items.filter(u =>
    u.unitName.toLowerCase().includes(search.toLowerCase()) ||
    (u.phone ?? '').includes(search)
  )

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setError('')
    setShowForm(true)
  }

  const openEdit = (u: StitchingUnit) => {
    setEditing(u)
    setForm({ unitName: u.unitName, unitType: u.unitType ?? '', address: u.address, phone: u.phone })
    setError('')
    setShowForm(true)
  }

  const save = async () => {
    if (!form.unitName.trim()) { setError('Unit name is required'); return }
    setSaving(true); setError('')
    try {
      if (editing) await stitchingUnitsApi.update(editing.id, form)
      else await stitchingUnitsApi.create(form)
      setShowForm(false); load()
    } catch (e: any) {
      if (isForbiddenError(e)) showError('Access Denied', PERMISSION_DENIED_MSG)
      else setError(e.message)
    } finally { setSaving(false) }
  }

  const deactivate = (id: string) => {
    showConfirm(
      'Deactivate Stitching Unit',
      'This unit will be hidden from new entries. Existing records are unaffected.',
      async () => { try { await stitchingUnitsApi.deactivate(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Deactivate Failed', e.message) } }
    )
  }

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Stitching Units</div>
          <div className="page-subtitle">{items.length} active units</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Add Unit</button>
      </div>

      {showForm && (
        <Modal title={editing ? 'Edit Stitching Unit' : 'Add Stitching Unit'} onClose={() => setShowForm(false)}>
          <FormError message={error} />
          <div className="form-group">
            <label>Unit Name *</label>
            <input value={form.unitName} onChange={e => setForm(p => ({ ...p, unitName: e.target.value }))} placeholder="e.g. Shirt Unit" />
          </div>
          <div className="form-group">
            <label>Unit Type</label>
            <select value={form.unitType ?? ''} onChange={e => setForm(p => ({ ...p, unitType: e.target.value }))}>
              <option value="">Select type…</option>
              {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={form.phone ?? ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea rows={2} value={form.address ?? ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
          </div>
          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <div className="card">
        <SearchBar value={search} onChange={setSearch} placeholder="Search stitching units…" />
        {loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>Unit Name</th>
                <th>Unit Type</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state">No stitching units found</div></td></tr>
              ) : filtered.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.unitName}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{u.unitType ?? '—'}</td>
                  <td>{u.phone ?? '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.address ?? '—'}</td>
                  <td><span className={`badge ${statusBadge(u.status)}`}>{u.status}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(u)}><Pencil size={14} /></button>
                      <button className="btn-icon" title="Deactivate" onClick={() => deactivate(u.id)}><Trash2 size={14} /></button>
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
