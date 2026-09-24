import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from '../icons'
import { fabricsApi, type Fabric } from '../api/fabrics'
import { schoolsApi, type School } from '../api/schools'
import { purchasePartiesApi, type PurchaseParty } from '../api/purchaseParties'
import { Modal, FormError, FormActions, statusBadge, LoadError, FilterBar } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

type FabricForm = Omit<Fabric, 'id' | 'status' | 'fabricCode' | 'schoolNames' | 'partyNames'> & {
  schoolIds: string[]
  partyIds: string[]
}

const empty: FabricForm = {
  fabricName: '',
  fabricType: '',
  unitOfMeasure: 'METER',
  composition: 0,
  weightGsm: undefined,
  widthInches: undefined,
  minStockMeters: undefined,
  schoolIds: [],
  partyIds: [],
}

const NEW_TYPE_SENTINEL = '__NEW__'

export default function Fabrics() {
  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [parties, setParties] = useState<PurchaseParty[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [partyFilter, setPartyFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Fabric | null>(null)
  const [form, setForm] = useState<FabricForm>(empty)
  const [saving, setSaving] = useState(false)
  const { dialog, showError, showConfirm } = useAlertDialog()
  const [error, setError] = useState('')
  const [customType, setCustomType] = useState('')

  const load = () => {
    setLoading(true)
    setLoadError('')
    Promise.all([
      fabricsApi.list(),
      fabricsApi.types(),
      schoolsApi.list(),
      purchasePartiesApi.list('FABRIC'),
    ]).then(([f, t, s, p]) => {
      setFabrics(f)
      setTypes(t)
      setSchools(s)
      setParties(p)
    }).catch((e: Error) => {
      setLoadError(e.message)
    }).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = fabrics.filter(f => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      f.fabricName.toLowerCase().includes(q) ||
      f.fabricCode.toLowerCase().includes(q) ||
      (f.schoolNames ?? []).some(s => s.toLowerCase().includes(q)) ||
      (f.partyNames ?? []).some(s => s.toLowerCase().includes(q))
    const matchType = !typeFilter || f.fabricType === typeFilter
    const matchSchool = !schoolFilter || (f.schoolIds ?? []).includes(schoolFilter)
    const matchParty = !partyFilter || (f.partyIds ?? []).includes(partyFilter)
    const matchStatus = !statusFilter || f.status === statusFilter
    return matchSearch && matchType && matchSchool && matchParty && matchStatus
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...empty, fabricType: typeFilter || types[0] || '' })
    setCustomType('')
    setError('')
    setShowForm(true)
  }

  const openEdit = (f: Fabric) => {
    setEditing(f)
    const knownType = types.includes(f.fabricType)
    setForm({
      fabricName: f.fabricName,
      fabricType: knownType ? f.fabricType : NEW_TYPE_SENTINEL,
      unitOfMeasure: f.unitOfMeasure,
      composition: f.composition ?? 0,
      weightGsm: f.weightGsm,
      widthInches: f.widthInches,
      minStockMeters: f.minStockMeters,
      schoolIds: f.schoolIds ?? [],
      partyIds: f.partyIds ?? [],
    })
    setCustomType(knownType ? '' : f.fabricType)
    setError('')
    setShowForm(true)
  }

  const resolvedType = form.fabricType === NEW_TYPE_SENTINEL ? customType.trim().toUpperCase() : form.fabricType

  const save = async () => {
    if (!form.fabricName.trim()) {
      setError('Name is required'); return
    }
    if (!resolvedType) { setError('Fabric type is required'); return }
    if (!form.composition || form.composition <= 0) {
      setError('Composition rate is required — enter a positive number (e.g. 1.2)'); return
    }
    setSaving(true); setError('')
    try {
      const payload = {
        fabricName: form.fabricName,
        fabricType: resolvedType,
        unitOfMeasure: form.unitOfMeasure,
        composition: form.composition,
        weightGsm: form.weightGsm,
        widthInches: form.widthInches,
        minStockMeters: form.minStockMeters,
        schoolIds: form.schoolIds,
        partyIds: form.partyIds,
      }
      if (editing) {
        await fabricsApi.update(editing.id, payload)
      } else {
        await fabricsApi.create(payload)
      }
      setShowForm(false); load()
    } catch (e: any) {
      if (isForbiddenError(e)) showError('Access Denied', PERMISSION_DENIED_MSG)
      else setError(e.message)
    } finally { setSaving(false) }
  }

  const deactivate = (id: string) => {
    showConfirm(
      'Deactivate Fabric',
      'This fabric will be hidden from new entries. Existing records are unaffected.',
      async () => { try { await fabricsApi.deactivate(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Deactivate Failed', e.message) } }
    )
  }

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Fabrics</div>
          <div className="page-subtitle">{fabrics.length} active fabrics</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Add Fabric</button>
      </div>

      {showForm && (
        <Modal title={editing ? 'Edit Fabric' : 'Add Fabric'} onClose={() => setShowForm(false)}>
          <FormError message={error} />
          <div className="form-group">
            <label>Fabric Name *</label>
            <input value={form.fabricName} onChange={e => setForm(p => ({ ...p, fabricName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Type *</label>
            <select
              value={form.fabricType}
              onChange={e => {
                setForm(p => ({ ...p, fabricType: e.target.value }))
                if (e.target.value !== NEW_TYPE_SENTINEL) setCustomType('')
              }}
            >
              <option value="">Select type</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
              <option value={NEW_TYPE_SENTINEL}>＋ Add new type…</option>
            </select>
            {form.fabricType === NEW_TYPE_SENTINEL && (
              <input
                style={{ marginTop: 6 }}
                placeholder="Type new fabric type (e.g. SHIRTING)"
                value={customType}
                onChange={e => setCustomType(e.target.value)}
                autoFocus
              />
            )}
          </div>
          <div className="form-group">
            <label>Unit of Measure *</label>
            <select value={form.unitOfMeasure} onChange={e => setForm(p => ({ ...p, unitOfMeasure: e.target.value }))}>
              <option value="METER">METER</option>
              <option value="KG">KG</option>
            </select>
          </div>
          <div className="form-group">
            <label>School</label>
            <select
              value=""
              onChange={e => {
                const id = e.target.value
                if (!id || form.schoolIds.includes(id)) return
                setForm(p => ({ ...p, schoolIds: [...p.schoolIds, id] }))
              }}
            >
              <option value="">Select school</option>
              {schools.filter(s => !form.schoolIds.includes(s.id)).map(s => (
                <option key={s.id} value={s.id}>{s.schoolName}</option>
              ))}
            </select>
            {form.schoolIds.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {form.schoolIds.map(id => {
                  const name = schools.find(s => s.id === id)?.schoolName ?? id
                  return (
                    <button
                      key={id}
                      type="button"
                      className="badge badge-info"
                      style={{ border: 'none', cursor: 'pointer' }}
                      onClick={() => setForm(p => ({ ...p, schoolIds: p.schoolIds.filter(x => x !== id) }))}
                    >
                      {name} ×
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Purchase Party</label>
            <select
              value={form.partyIds[0] ?? ''}
              onChange={e => setForm(p => ({ ...p, partyIds: e.target.value ? [e.target.value] : [] }))}
            >
              <option value="">Select party</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.partyName}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Composition (m/unit) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 1.2"
              value={form.composition || ''}
              onChange={e => setForm(p => ({ ...p, composition: e.target.value === '' ? 0 : Number(e.target.value) }))}
            />
          </div>
          <div className="form-group">
            <label>Weight (GSM)</label>
            <input
              type="number"
              value={form.weightGsm ?? ''}
              onChange={e => setForm(p => ({
                ...p,
                weightGsm: e.target.value === '' ? undefined : Number(e.target.value),
              }))}
            />
          </div>
          <div className="form-group">
            <label>Width (inches)</label>
            <input
              type="number"
              step="0.5"
              value={form.widthInches ?? ''}
              onChange={e => setForm(p => ({
                ...p,
                widthInches: e.target.value === '' ? undefined : Number(e.target.value),
              }))}
            />
          </div>
          <div className="form-group">
            <label>Min Stock (meters) <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>— low-stock warning threshold</span></label>
            <input
              type="number"
              step="0.5"
              min="0"
              placeholder="e.g. 50"
              value={form.minStockMeters ?? ''}
              onChange={e => setForm(p => ({
                ...p,
                minStockMeters: e.target.value === '' ? undefined : Number(e.target.value),
              }))}
            />
          </div>
          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <div className="card">
        <FilterBar
          filters={[
            { label: 'Type', options: types.map(t => ({ value: t, label: t })), value: typeFilter, onChange: setTypeFilter, allLabel: 'All types' },
            { label: 'School', options: schools.map(s => ({ value: s.id, label: s.schoolName })), value: schoolFilter, onChange: setSchoolFilter, allLabel: 'All schools' },
            { label: 'Party', options: parties.map(p => ({ value: p.id, label: p.partyName })), value: partyFilter, onChange: setPartyFilter, allLabel: 'All parties' },
            { label: 'Status', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }], value: statusFilter, onChange: setStatusFilter, allLabel: 'All statuses' },
          ]}
          search={{ placeholder: 'Fabric name, code, party…', value: search, onChange: setSearch }}
          count={filtered.length} countLabel="fabrics"
        />
        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Schools</th>
                <th>Purchase Party</th>
                <th>Unit</th>
                <th>Width (in)</th>
                <th>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9}><div className="empty-state">No fabrics found. Add your first fabric.</div></td></tr>
              ) : filtered.map(f => (
                <tr key={f.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{f.fabricCode}</td>
                  <td style={{ fontWeight: 500 }}>{f.fabricName}</td>
                  <td><span className="badge badge-info">{f.fabricType}</span></td>
                  <td style={{ fontSize: 12, maxWidth: 220 }}>{(f.schoolNames && f.schoolNames.length) ? f.schoolNames.join(', ') : '—'}</td>
                  <td style={{ fontSize: 12, maxWidth: 180 }}>{(f.partyNames && f.partyNames.length) ? f.partyNames.join(', ') : '—'}</td>
                  <td>{f.unitOfMeasure}</td>
                  <td>{f.widthInches != null ? `${f.widthInches}"` : '—'}</td>
                  <td><span className={`badge ${statusBadge(f.status)}`}>{f.status}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(f)}><Pencil size={14} /></button>
                      <button className="btn-icon" title="Deactivate" onClick={() => deactivate(f.id)}><Trash2 size={14} /></button>
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
