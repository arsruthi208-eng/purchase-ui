import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from '../icons'
import { packingApi, type PackingEntry, type CreatePackingRequest } from '../api/packing'
import { schoolsApi, type School } from '../api/schools'
import { schoolOrdersApi, type SchoolOrderSummary, type SchoolOrderDetail } from '../api/schoolOrders'
import { stylesApi, type Style } from '../api/styles'
import { accessoriesApi, type Accessory } from '../api/accessories'
import { Modal, FormError, FormActions, statusBadge, today, LoadError, FilterBar, SortableTh } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

type Line = CreatePackingRequest['items'][0]

const emptyLine = (): Line => ({
  styleId: '', accessoryId: '', gender: 'BOYS', standard: '', quantity: 0,
})

export default function Packing() {
  const navigate = useNavigate()
  const [items, setItems] = useState<PackingEntry[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [schoolOrders, setSchoolOrders] = useState<SchoolOrderSummary[]>([])
  const [styles, setStyles] = useState<Style[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreatePackingRequest>({
    schoolId: '', packingDate: today(), items: [emptyLine()],
  })
  const [lockedSchoolId, setLockedSchoolId] = useState('')

  const confirmedOrders = schoolOrders.filter(o => o.status === 'CONFIRMED')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const load = () => {
    setLoading(true)
    setLoadError('')
    packingApi.list()
      .then(setItems)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    schoolsApi.list().then(setSchools)
    schoolOrdersApi.list().then(setSchoolOrders)
    stylesApi.list().then(setStyles)
    accessoriesApi.list().then(setAccessories)
  }, [])

  const openCreate = () => {
    setForm({ schoolId: schools[0]?.id ?? '', packingDate: today(), items: [emptyLine()] })
    setLockedSchoolId('')
    setError('')
    setShowForm(true)
  }

  const onSchoolOrderChange = async (soId: string) => {
    if (!soId) {
      setLockedSchoolId('')
      setForm(p => ({ ...p, schoolOrderId: undefined, items: [emptyLine()] }))
      return
    }
    try {
      const detail: SchoolOrderDetail = await schoolOrdersApi.getById(soId)
      const autoLines: Line[] = detail.items.map(item => ({
        styleId: item.styleId,
        accessoryId: '',
        gender: item.gender,
        standard: item.standard,
        quantity: item.quantity,
      }))
      setLockedSchoolId(detail.schoolId)
      setForm(p => ({
        ...p,
        schoolOrderId: soId,
        schoolId: detail.schoolId,
        items: autoLines.length > 0 ? autoLines : [emptyLine()],
      }))
    } catch (e: any) {
      setError(e.message ?? 'Failed to load school order')
    }
  }

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setForm(p => ({
      ...p,
      items: p.items.map((line, i) => (i === idx ? { ...line, ...patch } : line)),
    }))
  }

  const save = async () => {
    if (!form.schoolId || !form.packingDate) { setError('School and date are required'); return }
    if (form.items.some(l => !l.styleId || !l.accessoryId || !l.gender || !l.standard || !l.quantity)) {
      setError('Each line needs style, accessory, gender, standard, and quantity'); return
    }
    setSaving(true); setError('')
    try {
      await packingApi.create(form)
      setShowForm(false); load()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const confirmEntry = (id: string) => {
    showConfirm(
      'Confirm Packing',
      'Mark this packing entry as confirmed.',
      async () => { try { await packingApi.confirm(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', e.message) } }
    )
  }

  const deleteEntry = (p: PackingEntry, e: React.MouseEvent) => {
    e.stopPropagation()
    showConfirm(
      'Delete Packing Entry',
      `Permanently delete ${p.packingNumber}? This cannot be undone.`,
      async () => {
        try { await packingApi.delete(p.id); load() }
        catch (err: any) { isForbiddenError(err) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Delete Failed', err.response?.data?.message ?? err.message) }
      }
    )
  }

  const [sortDesc, setSortDesc] = useState(true)
  const filtered = items.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false
    if (schoolFilter && r.schoolName !== schoolFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(r.packingNumber.toLowerCase().includes(q) || r.schoolName.toLowerCase().includes(q))) return false
    }
    return true
  })
  const sorted = [...filtered].sort((a, b) =>
    sortDesc ? b.packingDate.localeCompare(a.packingDate) : a.packingDate.localeCompare(b.packingDate)
  )

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Packing</div>
          <div className="page-subtitle">{items.length} packing entries</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />New Packing</button>
      </div>

      {showForm && (
        <Modal title="New Packing Entry" onClose={() => setShowForm(false)} width={680}>
          <FormError message={error} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>School Order <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <select value={form.schoolOrderId ?? ''} onChange={e => onSchoolOrderChange(e.target.value)}>
                <option value="">None</option>
                {confirmedOrders.map(o => <option key={o.id} value={o.id}>{o.orderNumber} — {o.schoolName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>School *</label>
              {lockedSchoolId ? (
                <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 500 }}>
                  {schools.find(s => s.id === lockedSchoolId)?.schoolName ?? lockedSchoolId}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>from school order</span>
                </div>
              ) : (
                <select value={form.schoolId} onChange={e => setForm(p => ({ ...p, schoolId: e.target.value }))}>
                  <option value="">Select school</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.schoolName}</option>)}
                </select>
              )}
            </div>
            <div className="form-group">
              <label>Packing Date *</label>
              <input type="date" value={form.packingDate} onChange={e => setForm(p => ({ ...p, packingDate: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Items</span>
            {form.schoolOrderId && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto-filled from school order — select accessory per line</span>
            )}
          </div>
          {form.items.map((line, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select value={line.styleId} onChange={e => updateLine(idx, { styleId: e.target.value })}>
                <option value="">Style</option>
                {styles.map(s => <option key={s.id} value={s.id}>{s.styleCode} — {s.styleName}</option>)}
              </select>
              <select value={line.accessoryId} onChange={e => updateLine(idx, { accessoryId: e.target.value })}>
                <option value="">Accessory</option>
                {accessories.map(a => <option key={a.id} value={a.id}>{a.accessoryCode} — {a.accessoryName}</option>)}
              </select>
              <select value={line.gender} onChange={e => updateLine(idx, { gender: e.target.value })}>
                <option value="BOYS">BOYS</option>
                <option value="GIRLS">GIRLS</option>
                <option value="UNISEX">UNISEX</option>
              </select>
              <input placeholder="Standard" value={line.standard} onChange={e => updateLine(idx, { standard: e.target.value })} />
              <input type="number" placeholder="Qty" value={line.quantity || ''} onChange={e => updateLine(idx, { quantity: Number(e.target.value) })} />
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setForm(p => ({ ...p, items: [...p.items, emptyLine()] }))}>
            Add line
          </button>

          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <div className="card">
        <FilterBar
          filters={[
            { label: 'School', options: Array.from(new Set(items.map(i => i.schoolName))).sort().map(n => ({ value: n, label: n })), value: schoolFilter, onChange: setSchoolFilter, allLabel: 'All schools' },
            { label: 'Status', options: [{ value: 'DRAFT', label: 'Draft' }, { value: 'CONFIRMED', label: 'Confirmed' }], value: statusFilter, onChange: setStatusFilter, allLabel: 'All statuses' },
          ]}
          search={{ placeholder: 'Packing #, school…', value: search, onChange: setSearch }}
          count={filtered.length} countLabel="entries"
        />
        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>Packing #</th>
                <th>School</th>
                <SortableTh label="Date" desc={sortDesc} onToggle={() => setSortDesc(p => !p)} />
                <th>Items</th>
                <th>Status</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state">No packing entries yet</div></td></tr>
              ) : sorted.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/packing/${p.id}`)}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{p.packingNumber}</td>
                  <td>{p.schoolName}</td>
                  <td>{p.packingDate}</td>
                  <td>{p.items?.length ?? 0}</td>
                  <td><span className={`badge ${statusBadge(p.status)}`}>{p.status}</span></td>
                  <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    {p.status === 'DRAFT' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => confirmEntry(p.id)}>Confirm</button>
                    )}
                    {p.status === 'DRAFT' ? (
                      <button className="btn-icon" title="Delete draft" style={{ color: '#dc2626', marginLeft: 6 }} onClick={e => deleteEntry(p, e)}>
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <Trash2 size={14} style={{ color: '#d1d5db', marginLeft: 6, verticalAlign: 'middle' }} aria-label="Cannot delete — already confirmed" />
                    )}
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
