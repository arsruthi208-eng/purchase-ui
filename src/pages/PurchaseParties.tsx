import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from '../icons'
import { purchasePartiesApi, type PurchaseParty, type CreatePurchasePartyRequest } from '../api/purchaseParties'
import { Modal, FormError, FormActions, SearchBar, FilterPills, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

const empty: CreatePurchasePartyRequest = {
  partyName: '', companyName: '', phone: '', email: '', address: '', gstNumber: '', partyKind: 'FABRIC',
}

export default function PurchaseParties() {
  const navigate = useNavigate()
  const [items, setItems] = useState<PurchaseParty[]>([])
  const [loading, setLoading] = useState(true)
  const [kindFilter, setKindFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PurchaseParty | null>(null)
  const [form, setForm] = useState<CreatePurchasePartyRequest>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true)
    purchasePartiesApi.list().then(setItems).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = items.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      b.partyName.toLowerCase().includes(q) ||
      (b.companyName ?? '').toLowerCase().includes(q) ||
      (b.gstNumber ?? '').toLowerCase().includes(q)
    const matchKind = !kindFilter || b.partyKind === kindFilter
    return matchSearch && matchKind
  })

  const openCreate = () => {
    setEditing(null)
    setForm(empty)
    setError('')
    setShowForm(true)
  }

  const openEdit = (b: PurchaseParty) => {
    setEditing(b)
    setForm({
      partyName: b.partyName,
      companyName: b.companyName,
      phone: b.phone,
      email: b.email,
      address: b.address,
      gstNumber: b.gstNumber,
      partyKind: b.partyKind ?? 'FABRIC',
    })
    setError('')
    setShowForm(true)
  }

  const save = async () => {
    if (!form.partyName.trim()) { setError('Party name is required'); return }
    if (!form.partyKind) { setError('Party kind is required'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        gstNumber: form.gstNumber?.trim() || undefined,
      }
      if (editing) await purchasePartiesApi.update(editing.id, payload)
      else await purchasePartiesApi.create(payload)
      setShowForm(false); load()
    } catch (e: any) {
      if (isForbiddenError(e)) showError('Access Denied', PERMISSION_DENIED_MSG)
      else setError(e.message)
    } finally { setSaving(false) }
  }

  const deactivate = (id: string) => {
    showConfirm(
      'Deactivate Purchase Party',
      'This purchase party will be hidden from new entries. Existing records are unaffected.',
      async () => {
        try { await purchasePartiesApi.deactivate(id); load() }
        catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Deactivate Failed', e.message) }
      }
    )
  }

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Purchase Parties</div>
          <div className="page-subtitle">{items.length} active parties</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Add Purchase Party</button>
      </div>

      {showForm && (
        <Modal title={editing ? 'Edit Purchase Party' : 'Add Purchase Party'} onClose={() => setShowForm(false)}>
          <FormError message={error} />
          <div className="form-group">
            <label>Party Name *</label>
            <input value={form.partyName} onChange={e => setForm(p => ({ ...p, partyName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Party Kind *</label>
            <select value={form.partyKind} onChange={e => setForm(p => ({ ...p, partyKind: e.target.value as 'FABRIC' | 'ACCESSORY' }))}>
              <option value="FABRIC">Fabric</option>
              <option value="ACCESSORY">Accessory</option>
            </select>
          </div>
          <div className="form-group">
            <label>GST Number</label>
            <input
              value={form.gstNumber ?? ''}
              onChange={e => setForm(p => ({ ...p, gstNumber: e.target.value }))}
              placeholder="e.g. 33AAAAA0000A1Z5"
              maxLength={20}
            />
          </div>
          <div className="form-group">
            <label>Person Name</label>
            <input value={form.companyName ?? ''} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone ?? ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={form.email ?? ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea rows={2} value={form.address ?? ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
          </div>
          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <FilterPills options={['FABRIC', 'ACCESSORY']} value={kindFilter} onChange={setKindFilter} />

      <div className="card">
        <SearchBar value={search} onChange={setSearch} placeholder="Search purchase parties…" />
        {loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>Party Name</th>
                <th>Kind</th>
                <th>Person Name</th>
                <th>Status</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5}><div className="empty-state">No purchase parties found</div></td></tr>
              ) : filtered.map(b => (
                <tr
                  key={b.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/purchase-parties/${b.id}`)}
                >
                  <td style={{ fontWeight: 500 }}>{b.partyName}</td>
                  <td>{b.partyKind === 'ACCESSORY' ? 'Accessory' : 'Fabric'}</td>
                  <td>{b.companyName ?? '—'}</td>
                  <td><span className={`badge ${statusBadge(b.status)}`}>{b.status}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(b)}><Pencil size={14} /></button>
                      <button className="btn-icon" title="Deactivate" onClick={() => deactivate(b.id)}><Trash2 size={14} /></button>
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
