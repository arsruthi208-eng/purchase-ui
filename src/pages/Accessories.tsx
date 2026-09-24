import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from '../icons'
import { accessoriesApi, accessoryTypesApi, type Accessory, type AccessoryType, type CreateAccessoryRequest } from '../api/accessories'
import { purchasePartiesApi, type PurchaseParty } from '../api/purchaseParties'
import { Modal, FormError, FormActions, SearchBar, statusBadge } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

const UOMS = ['PCS', 'METER', 'KG', 'CONE'] as const

const empty: CreateAccessoryRequest = {
  accessoryName: '', typeId: '', unitOfMeasure: 'PCS', partyId: '',
}

export default function Accessories() {
  const [items, setItems] = useState<Accessory[]>([])
  const [types, setTypes] = useState<AccessoryType[]>([])
  const [parties, setParties] = useState<PurchaseParty[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [partyFilter, setPartyFilter] = useState('')
  const [uomFilter, setUomFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Accessory | null>(null)
  const [form, setForm] = useState<CreateAccessoryRequest>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true)
    Promise.all([accessoriesApi.list(), accessoryTypesApi.list(), purchasePartiesApi.list('ACCESSORY')])
      .then(([a, t, p]) => { setItems(a); setTypes(t); setParties(p) })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const categories = Array.from(new Set(items.map(a => a.categoryName).filter(Boolean))).sort()

  const filtered = items.filter(a => {
    const matchSearch = !search ||
      a.accessoryName.toLowerCase().includes(search.toLowerCase()) ||
      a.accessoryCode.toLowerCase().includes(search.toLowerCase()) ||
      a.typeName.toLowerCase().includes(search.toLowerCase()) ||
      (a.partyNames ?? []).some(p => p.toLowerCase().includes(search.toLowerCase()))
    const matchCat = !categoryFilter || a.categoryName === categoryFilter
    const matchType = !typeFilter || a.typeId === typeFilter
    const matchParty = !partyFilter || (a.partyIds ?? []).includes(partyFilter)
    const matchUom = !uomFilter || a.unitOfMeasure === uomFilter
    return matchSearch && matchCat && matchType && matchParty && matchUom
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...empty, typeId: types[0]?.id ?? '' })
    setError('')
    setShowForm(true)
  }

  const openEdit = (a: Accessory) => {
    setEditing(a)
    setForm({
      accessoryName: a.accessoryName,
      typeId: a.typeId,
      unitOfMeasure: a.unitOfMeasure,
      partyId: a.partyIds?.[0] ?? '',
    })
    setError('')
    setShowForm(true)
  }

  const save = async () => {
    if (!form.accessoryName.trim() || !form.typeId || !form.unitOfMeasure) {
      setError('Name, type, and unit of measure are required'); return
    }
    setSaving(true); setError('')
    try {
      const payload = {
        accessoryName: form.accessoryName,
        typeId: form.typeId,
        unitOfMeasure: form.unitOfMeasure,
        partyId: form.partyId || undefined,
      }
      if (editing) await accessoriesApi.update(editing.id, payload)
      else await accessoriesApi.create({ ...form, partyId: form.partyId || undefined })
      setShowForm(false); load()
    } catch (e: any) {
      if (isForbiddenError(e)) showError('Access Denied', PERMISSION_DENIED_MSG)
      else setError(e.message)
    } finally { setSaving(false) }
  }

  const deactivate = (id: string) => {
    showConfirm(
      'Deactivate Accessory',
      'This accessory will be hidden from new entries. Existing records are unaffected.',
      async () => { try { await accessoriesApi.deactivate(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Deactivate Failed', e.message) } }
    )
  }

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Accessories</div>
          <div className="page-subtitle">{items.length} active accessories</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Add Accessory</button>
      </div>

      {showForm && (
        <Modal title={editing ? 'Edit Accessory' : 'Add Accessory'} onClose={() => setShowForm(false)}>
          <FormError message={error} />
          <div className="form-group">
            <label>Accessory Name *</label>
            <input value={form.accessoryName} onChange={e => setForm(p => ({ ...p, accessoryName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Type *</label>
            <select value={form.typeId} onChange={e => setForm(p => ({ ...p, typeId: e.target.value }))}>
              <option value="">Select type</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>
                  {t.categoryName ? `${t.categoryName} / ${t.typeName}` : t.typeName}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Unit of Measure *</label>
            <select value={form.unitOfMeasure} onChange={e => setForm(p => ({ ...p, unitOfMeasure: e.target.value }))}>
              {UOMS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Purchase Party</label>
            <select value={form.partyId ?? ''} onChange={e => setForm(p => ({ ...p, partyId: e.target.value }))}>
              <option value="">Select party</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.partyName}</option>)}
            </select>
          </div>
          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, padding: '12px 16px 0' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Category</label>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Type</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.typeName}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Purchase party</label>
            <select value={partyFilter} onChange={e => setPartyFilter(e.target.value)}>
              <option value="">All parties</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.partyName}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>UOM</label>
            <select value={uomFilter} onChange={e => setUomFilter(e.target.value)}>
              <option value="">All UOM</option>
              {UOMS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search accessories…" />
        {loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Category</th>
                <th>Purchase Party</th>
                <th>UOM</th>
                <th>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state">No accessories found</div></td></tr>
              ) : filtered.map(a => (
                <tr key={a.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{a.accessoryCode}</td>
                  <td style={{ fontWeight: 500 }}>{a.accessoryName}</td>
                  <td>{a.typeName}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{a.categoryName}</td>
                  <td style={{ fontSize: 12, maxWidth: 180 }}>{(a.partyNames && a.partyNames.length) ? a.partyNames.join(', ') : '—'}</td>
                  <td>{a.unitOfMeasure}</td>
                  <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(a)}><Pencil size={14} /></button>
                      <button className="btn-icon" title="Deactivate" onClick={() => deactivate(a.id)}><Trash2 size={14} /></button>
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
