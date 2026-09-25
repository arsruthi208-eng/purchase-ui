import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Pencil } from '../icons'
import {
  schoolOrdersApi, type SchoolOrderSummary, type CreateSchoolOrderRequest,
  type SchoolOrderKind, ORDER_KIND_LABEL, STAGE_LABELS,
} from '../api/schoolOrders'
import { schoolsApi, type School } from '../api/schools'
import { stylesApi, type Style } from '../api/styles'
import { useApiList } from '../hooks/useApiData'
import { Modal, FormError, FormActions, statusBadge, today, LoadError, FilterBar, SortableTh } from '../components/ui'
import { useAlertDialog } from '../hooks/useAlertDialog'
import { isForbiddenError, PERMISSION_DENIED_MSG } from '../utils/permissions'

const GENDERS = ['BOYS', 'GIRLS', 'UNISEX'] as const
const KINDS: SchoolOrderKind[] = ['SCHOOL_STD', 'SCHOOL_SIZE', 'CORPORATE']
const CORP_YEARS = ['1 YEAR', '2 YEAR', '3 YEAR', '4 YEAR']

type Line = CreateSchoolOrderRequest['items'][0]

const emptyLine = (kind: SchoolOrderKind): Line => {
  if (kind === 'SCHOOL_SIZE') return { styleId: '', gender: 'BOYS', standard: '', size: '', quantity: 0, sectionTitle: '' }
  if (kind === 'CORPORATE') return { styleId: '', gender: 'BOYS', standard: '1 YEAR', quantity: 0, studentCount: undefined, setCount: undefined, sectionTitle: '' }
  return { styleId: '', gender: 'BOYS', standard: '', quantity: 0, totalStudentCount: undefined, studentCount: undefined }
}

const emptyForm = (kind: SchoolOrderKind = 'SCHOOL_STD'): CreateSchoolOrderRequest => ({
  schoolId: '', academicYear: '', orderDate: today(), notes: '', orderKind: kind, subject: '', orderListLabel: '', items: [emptyLine(kind)],
})

export default function SchoolOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<SchoolOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [schoolIdFilter, setSchoolIdFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateSchoolOrderRequest>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { dialog, showError, showConfirm } = useAlertDialog()

  const { data: schools } = useApiList<School>(() => schoolsApi.list())
  const { data: styles }  = useApiList<Style>(() => stylesApi.list())

  const kind = form.orderKind
  const load = () => {
    setLoading(true)
    setLoadError('')
    schoolOrdersApi.list()
      .then(setOrders)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setShowForm(true)
  }

  const openEdit = (o: SchoolOrderSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    schoolOrdersApi.getById(o.id).then(d => {
      setEditingId(d.id)
      setForm({
        schoolId: d.schoolId,
        academicYear: d.academicYear ?? '',
        orderDate: d.orderDate,
        notes: d.notes ?? '',
        orderKind: d.orderKind || 'SCHOOL_STD',
        subject: d.subject ?? '',
        orderListLabel: d.orderListLabel ?? '',
        items: d.items.map(i => ({
          styleId: i.styleId,
          gender: i.gender,
          standard: i.standard,
          quantity: i.quantity,
          size: i.size ?? '',
          totalStudentCount: i.totalStudentCount,
          studentCount: i.studentCount,
          setCount: i.setCount,
          sectionTitle: i.sectionTitle ?? '',
        })),
      })
      setError('')
      setShowForm(true)
    }).catch(err => isForbiddenError(err) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Load Failed', err.message))
  }

  const setKind = (next: SchoolOrderKind) => {
    setForm(p => ({ ...p, orderKind: next, items: [emptyLine(next)] }))
  }

  const updateLine = (idx: number, patch: Partial<Line>) =>
    setForm(p => ({ ...p, items: p.items.map((l, i) => i === idx ? { ...l, ...patch } : l) }))

  const removeLine = (idx: number) =>
    setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))

  const save = async () => {
    if (!form.schoolId) { setError('School is required'); return }
    if (!form.orderDate) { setError('Order date is required'); return }
    if (form.items.length === 0) { setError('Add at least one line item'); return }
    if (form.items.some(l => !l.styleId)) { setError('Each line needs a style'); return }
    if (kind === 'SCHOOL_SIZE' && form.items.some(l => !l.size || !l.quantity)) {
      setError('Each size line needs size and qty'); return
    }
    if (kind === 'SCHOOL_STD' && form.items.some(l => !l.quantity)) {
      setError('Each line needs qty'); return
    }
    if (kind === 'CORPORATE' && form.items.some(l => l.studentCount == null && l.setCount == null)) {
      setError('Each corporate line needs students and/or sets'); return
    }
    setSaving(true); setError('')
    try {
      const payload: CreateSchoolOrderRequest = {
        ...form,
        academicYear: form.academicYear || undefined,
        notes: form.notes || undefined,
        subject: form.subject || undefined,
        orderListLabel: form.orderListLabel || undefined,
        items: form.items.map(l => ({
          ...l,
          size: l.size || undefined,
          sectionTitle: l.sectionTitle || undefined,
          quantity: kind === 'CORPORATE'
            ? (l.setCount || l.studentCount || l.quantity || 0)
            : l.quantity,
        })),
      }
      if (editingId) await schoolOrdersApi.update(editingId, payload)
      else await schoolOrdersApi.create(payload)
      setShowForm(false)
      load()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const confirmOrder = (order: SchoolOrderSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    showConfirm(
      'Confirm Sales Order',
      `You are confirming order ${order.orderNumber} for ${order.schoolName}.`,
      async () => { try { await schoolOrdersApi.confirm(order.id); load() } catch (err: any) { isForbiddenError(err) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Confirm Failed', err.message) } },
      'Confirm Order',
      <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>
        <div><strong>School:</strong> {order.schoolName}</div>
        <div><strong>Total Quantity:</strong> {order.totalQuantity} pcs across {order.itemCount} line{order.itemCount !== 1 ? 's' : ''}</div>
      </div>
    )
  }

  const deleteOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    showConfirm(
      'Delete Draft Order',
      'This will permanently delete the draft school order. This cannot be undone.',
      async () => { try { await schoolOrdersApi.delete(id); load() } catch (err: any) { isForbiddenError(err) ? showError('Access Denied', PERMISSION_DENIED_MSG) : showError('Delete Failed', err.message) } },
      'Delete'
    )
  }

  const cols = kind === 'SCHOOL_SIZE'
    ? '1.8fr 0.9fr 0.9fr 0.7fr 0.7fr 1.1fr auto'
    : kind === 'CORPORATE'
      ? '1.8fr 0.9fr 0.9fr 0.8fr 0.8fr 1.1fr auto'
      : '1.8fr 0.9fr 0.9fr 0.85fr 0.85fr 0.7fr auto'

  const headers = kind === 'SCHOOL_SIZE'
    ? ['Style *', 'Gender', 'STD', 'Size *', 'Qty *', 'Group', '']
    : kind === 'CORPORATE'
      ? ['Style *', 'Gender', 'Year *', 'Students', 'Sets', 'Group', '']
      : ['Style *', 'Gender', 'STD *', 'Total students *', 'No. of students *', 'Qty *', '']

  const [sortDesc, setSortDesc] = useState(true)
  const filtered = orders.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false
    if (kindFilter && r.orderKind !== kindFilter) return false
    if (schoolIdFilter && r.schoolId !== schoolIdFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(r.orderNumber.toLowerCase().includes(q) || r.schoolName.toLowerCase().includes(q) || (r.academicYear ?? '').includes(q))) return false
    }
    return true
  })
  const sorted = [...filtered].sort((a, b) =>
    sortDesc ? b.orderDate.localeCompare(a.orderDate) : a.orderDate.localeCompare(b.orderDate)
  )

  return (
    <div className="page">
      {dialog}
      <div className="page-header">
        <div>
          <div className="page-title">Sales Orders</div>
          <div className="page-subtitle">{orders.length} order{orders.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />New Order</button>
      </div>

      {showForm && (
        <Modal title={editingId ? 'Edit Sales Order (Draft)' : 'New Sales Order'} onClose={() => setShowForm(false)} width={1040}>
          <FormError message={error} />

          <div className="form-group">
            <label>Order type *</label>
            <select value={kind} onChange={e => setKind(e.target.value as SchoolOrderKind)} disabled={!!editingId}>
              {KINDS.map(k => <option key={k} value={k}>{ORDER_KIND_LABEL[k]}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>School *</label>
              <select value={form.schoolId} onChange={e => setForm(p => ({ ...p, schoolId: e.target.value }))}>
                <option value="">Select school…</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.schoolName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Academic Year</label>
              <input placeholder="e.g. 2026-27" value={form.academicYear ?? ''} onChange={e => setForm(p => ({ ...p, academicYear: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Order Date *</label>
              <input type="date" value={form.orderDate} onChange={e => setForm(p => ({ ...p, orderDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Order list (optional)</label>
              <input placeholder="LIST-1" value={form.orderListLabel ?? ''} onChange={e => setForm(p => ({ ...p, orderListLabel: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Subject</label>
              <input placeholder="Order Confirmation Std I to V BOYS" value={form.subject ?? ''} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <input value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginTop: 8, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Order Lines</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Total: {form.items.reduce((s, l) => s + (l.quantity || l.setCount || l.studentCount || 0), 0).toLocaleString()} pcs
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 6, marginBottom: 4, padding: '0 2px' }}>
            {headers.map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
            ))}
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
            {form.items.map((line, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: cols, gap: 6, marginBottom: 6 }}>
                <select value={line.styleId} onChange={e => updateLine(idx, { styleId: e.target.value })}>
                  <option value="">Style…</option>
                  {styles.map(s => <option key={s.id} value={s.id}>{s.styleName}</option>)}
                </select>
                <select value={line.gender} onChange={e => updateLine(idx, { gender: e.target.value })}>
                  {GENDERS.map(g => <option key={g} value={g}>{kind === 'CORPORATE' ? (g === 'BOYS' ? "MEN'S" : g === 'GIRLS' ? 'LADIES' : g) : g}</option>)}
                </select>
                {kind === 'CORPORATE' ? (
                  <select value={line.standard} onChange={e => updateLine(idx, { standard: e.target.value })}>
                    {CORP_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                ) : (
                  <input placeholder="Std" value={line.standard} onChange={e => updateLine(idx, { standard: e.target.value })} />
                )}
                {kind === 'SCHOOL_SIZE' && (
                  <>
                    <input placeholder="Size" value={line.size ?? ''} onChange={e => updateLine(idx, { size: e.target.value })} />
                    <input type="number" min={1} placeholder="Qty" value={line.quantity || ''} onChange={e => updateLine(idx, { quantity: Number(e.target.value) })} />
                    <input placeholder="Group" value={line.sectionTitle ?? ''} onChange={e => updateLine(idx, { sectionTitle: e.target.value })} />
                  </>
                )}
                {kind === 'SCHOOL_STD' && (
                  <>
                    <input type="number" min={0} placeholder="Total" value={line.totalStudentCount ?? ''} onChange={e => updateLine(idx, { totalStudentCount: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    <input type="number" min={0} placeholder="Students" value={line.studentCount ?? ''} onChange={e => updateLine(idx, { studentCount: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    <input type="number" min={1} placeholder="Qty" value={line.quantity || ''} onChange={e => updateLine(idx, { quantity: Number(e.target.value) })} />
                  </>
                )}
                {kind === 'CORPORATE' && (
                  <>
                    <input type="number" min={0} placeholder="Students" value={line.studentCount ?? ''} onChange={e => updateLine(idx, { studentCount: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    <input type="number" min={0} placeholder="Sets" value={line.setCount ?? ''} onChange={e => updateLine(idx, { setCount: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    <input placeholder="Group" value={line.sectionTitle ?? ''} onChange={e => updateLine(idx, { sectionTitle: e.target.value })} />
                  </>
                )}
                <button className="btn-icon" title="Remove line" disabled={form.items.length === 1} onClick={() => removeLine(idx)} style={{ color: '#dc2626' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: 4 }} onClick={() => setForm(p => ({ ...p, items: [...p.items, emptyLine(kind)] }))}>
            + Add line
          </button>

          <FormActions onCancel={() => setShowForm(false)} onSave={save} saving={saving} />
        </Modal>
      )}

      <div className="card">
        <FilterBar
          filters={[
            { label: 'School', options: schools.map(s => ({ value: s.id, label: s.schoolName })), value: schoolIdFilter, onChange: setSchoolIdFilter, allLabel: 'All schools' },
            { label: 'Type', options: KINDS.map(k => ({ value: k, label: ORDER_KIND_LABEL[k] })), value: kindFilter, onChange: setKindFilter, allLabel: 'All types' },
            { label: 'Status', options: [{ value: 'DRAFT', label: 'Draft' }, { value: 'CONFIRMED', label: 'Confirmed' }], value: statusFilter, onChange: setStatusFilter, allLabel: 'All statuses' },
          ]}
          search={{ placeholder: 'Order number, school, year…', value: search, onChange: setSearch }}
          count={filtered.length} countLabel="orders"
        />
        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : loading ? <div className="loading">Loading…</div> : (
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>School</th>
                <th>Type</th>
                <SortableTh label="Date" desc={sortDesc} onToggle={() => setSortDesc(p => !p)} />
                <th style={{ textAlign: 'right' }}>Lines</th>
                <th style={{ textAlign: 'right' }}>Total Qty</th>
                <th>Status</th>
                <th>Production</th>
                <th style={{ width: 150 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9}><div className="empty-state">No school orders yet</div></td></tr>
              ) : sorted.map(o => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/school-orders/${o.id}`)}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)', fontFamily: 'monospace', fontSize: 13 }}>{o.orderNumber}</td>
                  <td style={{ fontWeight: 500 }}>{o.schoolName}</td>
                  <td>{ORDER_KIND_LABEL[(o.orderKind as SchoolOrderKind) || 'SCHOOL_STD']}</td>
                  <td>{o.orderDate}</td>
                  <td style={{ textAlign: 'right' }}>{o.itemCount}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{o.totalQuantity.toLocaleString()}</td>
                  <td><span className={`badge ${statusBadge(o.status)}`}>{o.status}</span></td>
                  <td>
                    {o.status === 'CONFIRMED' && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 12,
                        background: o.productionStage === 'DISPATCHED' ? '#dcfce7' : o.productionStage === 'PENDING' ? '#f1f5f9' : '#fef9c3',
                        color: o.productionStage === 'DISPATCHED' ? '#166534' : o.productionStage === 'PENDING' ? '#64748b' : '#854d0e',
                      }}>
                        {STAGE_LABELS[o.productionStage] ?? o.productionStage}
                      </span>
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {o.status === 'DRAFT' && (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={e => confirmOrder(o, e)}>Confirm</button>
                          <button className="btn-icon" title="Edit" onClick={e => openEdit(o, e)}><Pencil size={14} /></button>
                          <button className="btn-icon" title="Delete draft" onClick={e => deleteOrder(o.id, e)} style={{ color: '#dc2626' }}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
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
