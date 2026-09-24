import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { compressImage } from '../api/auth'
import { FilterBar } from '../components/ui'

interface AppUser {
  id: string
  username: string
  email: string
  fullName: string
  role: string
  active: boolean
  locked: boolean
  failedAttempts: number
  createdAt: string
  profilePicture?: string | null
}

interface CreateUserRequest {
  username: string
  email: string
  fullName: string
  role: string
}

const ROLES = ['ADMIN', 'PURCHASER', 'STOCK_INCHARGE', 'PACKING_INCHARGE']
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', PURCHASER: 'Purchaser',
  STOCK_INCHARGE: 'Stock Incharge', PACKING_INCHARGE: 'Packing Incharge'
}
const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#dc2626', PURCHASER: '#1d4ed8', STOCK_INCHARGE: '#059669', PACKING_INCHARGE: '#7c3aed'
}

export default function Users() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [newPasswordResult, setNewPasswordResult] = useState<{ username: string; password: string } | null>(null)
  const [form, setForm] = useState<CreateUserRequest>({ username: '', email: '', fullName: '', role: 'PURCHASER' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handlePhotoUpload = async (u: AppUser, file: File) => {
    setUploadingId(u.id)
    try {
      const compressed = await compressImage(file)
      await api.put(`/api/v1/users/${u.id}/picture`, { profilePicture: compressed })
      loadUsers()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to upload photo')
    } finally {
      setUploadingId(null)
    }
  }

  const loadUsers = () => {
    setLoading(true)
    api.get<AppUser[]>('/api/v1/users')
      .then(r => setUsers(r.data as unknown as AppUser[]))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, [])

  const openCreate = () => {
    setEditUser(null)
    setForm({ username: '', email: '', fullName: '', role: 'PURCHASER' })
    setError(null)
    setShowModal(true)
  }

  const openEdit = (u: AppUser) => {
    setEditUser(u)
    setForm({ username: u.username, email: u.email, fullName: u.fullName, role: u.role })
    setError(null)
    setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      if (editUser) {
        await api.put(`/api/v1/users/${editUser.id}`, { email: form.email, fullName: form.fullName, role: form.role })
      } else {
        const res = await api.post<{ user: AppUser; tempPassword: string }>('/api/v1/users', form)
        const result = (res.data as unknown) as { user: AppUser; tempPassword: string }
        setNewPasswordResult({ username: result.user.username, password: result.tempPassword })
      }
      setShowModal(false)
      loadUsers()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u: AppUser) => {
    try {
      await api.put(`/api/v1/users/${u.id}`, { active: !u.active })
      loadUsers()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed')
    }
  }

  const unlock = async (u: AppUser) => {
    try {
      await api.put(`/api/v1/users/${u.id}/unlock`)
      loadUsers()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed')
    }
  }

  const resetPassword = async (u: AppUser) => {
    if (!confirm(`Reset password for ${u.fullName}? A new temp password will be generated.`)) return
    setResettingId(u.id)
    try {
      const res = await api.put<{ tempPassword: string }>(`/api/v1/users/${u.id}/reset-password`)
      const result = (res.data as unknown) as { tempPassword: string }
      setNewPasswordResult({ username: u.username, password: result.tempPassword })
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setResettingId(null)
    }
  }

  const th: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)'
  }
  const td: React.CSSProperties = { padding: '12px 14px', fontSize: 14, verticalAlign: 'middle' }

  const filtered = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false
    if (statusFilter === 'ACTIVE' && !u.active) return false
    if (statusFilter === 'INACTIVE' && u.active) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))) return false
    }
    return true
  })

  return (
    <div style={{ padding: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>User Management</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Manage access to AU Purchase</p>
        </div>
        <button onClick={openCreate} style={{
          padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
          background: '#1d4ed8', color: '#fff', border: 'none', cursor: 'pointer'
        }}>
          + New User
        </button>
      </div>

      {/* Temp password banner */}
      {newPasswordResult && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '14px 18px',
          marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontWeight: 700, color: '#15803d', fontSize: 14 }}>
              Temporary password for <strong>{newPasswordResult.username}</strong>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 2, color: '#166534', marginTop: 4 }}>
              {newPasswordResult.password}
            </div>
            <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
              Save this now — it won't be shown again. Share securely with the user.
            </div>
          </div>
          <button onClick={() => setNewPasswordResult(null)}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#15803d' }}>×</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading...</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <FilterBar
            filters={[
              { label: 'Role', options: ROLES.map(r => ({ value: r, label: ROLE_LABELS[r] ?? r })), value: roleFilter, onChange: setRoleFilter, allLabel: 'All roles' },
              { label: 'Status', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }], value: statusFilter, onChange: setStatusFilter, allLabel: 'All statuses' },
            ]}
            search={{ placeholder: 'Name, username, email…', value: search, onChange: setSearch }}
            count={filtered.length} countLabel="users"
          />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={th}>Full Name</th>
                <th style={th}>Username</th>
                <th style={th}>Email</th>
                <th style={th}>Role</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: 'center', color: '#64748b', padding: 32 }}>
                    No users match the selected filters
                  </td>
                </tr>
              ) : filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td}>
                    {/* Hidden file input per user */}
                    <input
                      type="file" accept="image/*" style={{ display: 'none' }}
                      ref={el => { fileRefs.current[u.id] = el }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(u, f); e.target.value = '' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Avatar — click to upload */}
                      <div
                        onClick={() => fileRefs.current[u.id]?.click()}
                        title="Click to change photo"
                        style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                      >
                        {u.profilePicture ? (
                          <img src={u.profilePicture} alt={u.fullName}
                            style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
                        ) : (
                          <div style={{
                            width: 38, height: 38, borderRadius: '50%',
                            background: `linear-gradient(135deg, ${ROLE_COLORS[u.role] ?? '#64748b'} 0%, ${ROLE_COLORS[u.role] ?? '#64748b'}99 100%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 800, color: '#fff', border: '2px solid #e2e8f0'
                          }}>
                            {u.fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                        )}
                        {/* Camera overlay on hover */}
                        <div style={{
                          position: 'absolute', inset: 0, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: uploadingId === u.id ? 1 : 0, transition: 'opacity 0.15s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={e => { if (uploadingId !== u.id) e.currentTarget.style.opacity = '0' }}
                        >
                          {uploadingId === u.id
                            ? <span style={{ fontSize: 10, color: '#fff' }}>…</span>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          }
                        </div>
                      </div>
                      <div style={{ fontWeight: 600 }}>{u.fullName}</div>
                    </div>
                  </td>
                  <td style={{ ...td, fontFamily: 'monospace', color: '#374151' }}>{u.username}</td>
                  <td style={{ ...td, color: '#374151' }}>{u.email}</td>
                  <td style={td}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                      background: `${ROLE_COLORS[u.role]}20`, color: ROLE_COLORS[u.role],
                      textTransform: 'uppercase'
                    }}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td style={td}>
                    {u.locked && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: '#fef2f2', color: '#dc2626', marginRight: 6 }}>
                        🔒 Locked ({u.failedAttempts})
                      </span>
                    )}
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                      background: u.active ? '#f0fdf4' : '#f8fafc', color: u.active ? '#16a34a' : '#94a3b8'
                    }}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => openEdit(u)} style={actionBtn('#e0f2fe', '#0369a1')}>Edit</button>
                      {u.locked && (
                        <button onClick={() => unlock(u)} style={actionBtn('#f0fdf4', '#15803d')}>Unlock</button>
                      )}
                      <button onClick={() => toggleActive(u)} style={actionBtn('#f8fafc', '#64748b')}>
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => resetPassword(u)}
                        disabled={resettingId === u.id}
                        style={{ ...actionBtn('#fef9c3', '#92400e'), opacity: resettingId === u.id ? 0.7 : 1, cursor: resettingId === u.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        {resettingId === u.id ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                            Resetting…
                          </>
                        ) : 'Reset Pwd'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
              {editUser ? 'Edit User' : 'New User'}
            </h2>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#dc2626' }}>
                {error}
              </div>
            )}

            <Field label="Full Name">
              <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} style={inp} />
            </Field>
            {!editUser && (
              <Field label="Username">
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} style={inp} />
              </Field>
            )}
            <Field label="Email">
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} />
            </Field>
            <Field label="Role">
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inp}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </Field>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 14, background: '#f1f5f9', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: saving ? '#93c5fd' : '#1d4ed8', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editUser ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
  border: '1px solid #d1d5db', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

function actionBtn(bg: string, color: string): React.CSSProperties {
  return {
    padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    background: bg, color, border: 'none', cursor: 'pointer'
  }
}
