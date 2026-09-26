import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from '../icons'
import { dispatchApi, type DispatchEntry, type CreateDispatchRequest } from '../api/dispatch'
import { schoolsApi, type School } from '../api/schools'
import { schoolOrdersApi, type SchoolOrderSummary } from '../api/schoolOrders'
import { stylesApi, type Style } from '../api/styles'
import { Modal, FormError, FormActions, statusBadge, today, LoadError, FilterBar, SortableTh } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

type Line = CreateDispatchRequest['items'][0]

const emptyLine = (): Line => ({ styleId: '', gender: 'BOYS', standard: '', quantity: 0 })

export default function Dispatch() {
  const navigate = useNavigate()
  const [items, setItems] = useState<DispatchEntry[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [schoolOrders, setSchoolOrders] = useState<SchoolOrderSummary[]>([])
  const [styles, setStyles] = useState<Style[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [search, setSearch] = useState('')

  const confirmedOrders = schoolOrders.filter(o => o.status === 'CONFIRMED')
  const { dialog, showError, showConfirm } = useAlertDialog()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateDispatchRequest>({
    schoolId: '',
    dispatchDate: today(),
    vehicleNumber: '',
    driverName: '',
    deliveryAddress: '',
    items: [emptyLine()],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setLoadError('')
    dispatchApi.list()
      .then(setItems)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    schoolsApi.list().then(setSchools)
    schoolOrdersApi.list().then(setSchoolOrders)
    stylesApi.list().then(setStyles)
  }, [])

  const openCreate = () => {
    setForm({
      schoolId: schools[0]?.id ?? '',
      dispatchDate: today(),
      vehicleNumber: '',
      driverName: '',
      deliveryAddress: '',
      items: [emptyLine()],
    })
    setError('')
    setShowForm(true)
  }

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setForm(p => ({
      ...p,
      items: p.items.map((line, i) => (i === idx ? { ...line, ...patch } : line)),
    }))
  }

  const save = async () => {
    if (!form.schoolId || !form.dispatchDate) { setError('School and date are required'); return }
    if (form.items.some(l => !l.styleId || !l.gender || !l.standard || !l.quantity)) {
      setError('Each line needs style, gender, standard, and quantity'); return
    }
    setSaving(true); setError('')
    try {
      await dispatchApi.create(form)
      setShowForm(false); load()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const deleteDispatch = (d: DispatchEntry, e: React.MouseEvent) => {
    e.stopPropagation()
    showConfirm(
      'Delete Dispatch Note',
      `Permanently delete ${d.dispatchNumber}? This cannot be undone.`,
      async () => {
        try { await dispatchApi.delete(d.id); load() }
        catch (err: any) { isForbiddenError(err) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Delete Failed', err.response?.data?.message ?? err.message) }
      }
    )
  }

  const doDispatch = (id: string) => {
    showConfirm(
      'Mark as Dispatched',
      'This will finalize the dispatch and cannot be undone.',
      async () => { try { await dispatchApi.dispatch(id); load() } catch (e: any) { isForbiddenError(e) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Dispatch Failed', e.message) } }
    )
  }

  const [sortDesc, setSortDesc] = useState(true)
  const filtered = items.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false
    if (schoolFilter && r.schoolName !== schoolFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(r.dispatchNumber.toLowerCase().includes(q) || r.schoolName.toLowerCase().includes(q) || (r.vehicleNumber ?? '').toLowerCase().includes(q))) return false
    }
    return true
  })
  const sorted = [...filtered].sort((a, b) =>
    sortDesc ? b.dispatchDate.localeCompare(a.dispatchDate) : a.dispatchDate.localeCompare(b.dispatchDate)
  )

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Dispatch</div>
          <div className="page-subtitle">{items.length} dispatch entries</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />New Dispatch</button>
      </div>

      {showForm && (
        <Modal title="New Dispatch" onClose={() => setShowForm(false)} width={680}>
          <FormError message={error} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>School *</label>
              <select value={form.schoolId} onChange={e => setForm(p => ({ ...p, schoolId: e.target.value }))}>
                <option value="">Select school</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.schoolName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>School Order <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <select value={form.schoolOrderId ?? ''} onChange={e => setForm(p => ({ ...p, schoolOrderId: e.target.value || undefined }))}>
                <option value="">None</option>
                {confirmedOrders.map(o => <option key={o.id} value={o.id}>{o.orderNumber} — {o.schoolName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Dispatch Date *</label>
              <input type="date" value={form.dispatchDate} onChange={e => setForm(p => ({ ...p, dispatchDate: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Vehicle Number</label>
              <input value={form.vehicleNumber ?? ''} onChange={e => setForm(p => ({ ...p, vehicleNumber: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Driver Name</label>
              <input value={form.driverName ?? ''} onChange={e => setForm(p => ({ ...p, driverName: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Delivery Address</label>
            <textarea rows={2} value={form.deliveryAddress ?? ''} onChange={e => setForm(p => ({ ...p, deliveryAddress: e.target.value }))} />
          </div>

          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Items</div>
          {form.items.map((line, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select value={line.styleId} onChange={e => updateLine(idx, { styleId: e.target.value })}>
                <option value="">Style</option>
                {styles.map(s => <option key={s.id} value={s.id}>{s.styleCode} — {s.styleName}</option>)}
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
            { label: 'Status', options: [{ value: 'DRAFT', label: 'Draft' }, { value: 'DISPATCHED', label: 'Dispatched' }, { value: 'CONFIRMED', label: 'Confirmed' }], value: statusFilter, onChange: setStatusFilter, allLabel: 'All statuses' },
          ]}
          search={{ placeholder: 'Dispatch #, school, vehicle…', value: search, onChange: setSearch }}
          count={filtered.length} countLabel="entries"
        />
        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>Dispatch #</th>
                <th>School</th>
                <SortableTh label="Date" desc={sortDesc} onToggle={() => setSortDesc(p => !p)} />
                <th>Vehicle</th>
                <th>Status</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state">No dispatch entries yet</div></td></tr>
              ) : sorted.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/dispatch/${d.id}`)}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{d.dispatchNumber}</td>
                  <td>{d.schoolName}</td>
                  <td>{d.dispatchDate}</td>
                  <td>{d.vehicleNumber ?? '—'}</td>
                  <td><span className={`badge ${statusBadge(d.status)}`}>{d.status}</span></td>
                  <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    {d.status !== 'DISPATCHED' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => doDispatch(d.id)}>Dispatch</button>
                    )}
                    {d.status === 'DRAFT' ? (
                      <button className="btn-icon" title="Delete draft" style={{ color: '#dc2626', marginLeft: 6 }} onClick={e => deleteDispatch(d, e)}>
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <Trash2 size={14} style={{ color: '#d1d5db', marginLeft: 6, verticalAlign: 'middle' }} aria-label="Cannot delete — already dispatched" />
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
