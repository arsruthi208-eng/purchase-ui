import React, { useRef } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { authApi, compressImage } from '../api/auth'
import {
  LayoutDashboard, School, Users, Palette,
  Layers, Package, ShoppingCart, ClipboardList, Scissors,
  SendHorizonal, Factory, Archive, PackageCheck, MapPin, SchoolOrderIcon, Printer, UserRound
} from '../icons'
import logo from '../assets/apple-uniformm-logo.png'
import tabLogo from '../assets/apple-uniformm-logo-light.png'
import { useAuth } from '../context/AuthContext'

type NavItem =
  | { section: string }
  | { to: string; icon: React.ForwardRefExoticComponent<any>; label: string; color: string; roles?: string[] }

const ALL_NAV: NavItem[] = [
  { section: 'Overview' },
  { to: '/',                  icon: LayoutDashboard,  label: 'Dashboard',       color: '#6366f1' },

  { section: 'Purchase' },
  { to: '/school-orders', icon: SchoolOrderIcon, label: 'Sales Orders', color: '#7c3aed' },
  { to: '/purchase-orders',           icon: ShoppingCart,  label: 'Fabric POs',                 color: '#1d4ed8',
    roles: ['ADMIN','PURCHASER','STOCK_INCHARGE'] },
  { to: '/accessory-purchase-orders', icon: Package,       label: 'Accessory POs',              color: '#0e7490',
    roles: ['ADMIN','PURCHASER','STOCK_INCHARGE'] },
  { to: '/grn',                       icon: ClipboardList, label: 'GRN',                        color: '#0284c7',
    roles: ['ADMIN','PURCHASER','STOCK_INCHARGE'] },

  { section: 'Production' },
  { to: '/cutting',     icon: Scissors,      label: 'Cutting DC',    color: '#b45309',
    roles: ['ADMIN','PURCHASER','PACKING_INCHARGE'] },
  { to: '/unit-dc',     icon: SendHorizonal, label: 'Unit DC',       color: '#c2410c',
    roles: ['ADMIN','PURCHASER','PACKING_INCHARGE'] },
  { to: '/accessory-dc', icon: Package,      label: 'Accessory DC',  color: '#0e7490',
    roles: ['ADMIN','PURCHASER','STOCK_INCHARGE','PACKING_INCHARGE'] },
  { to: '/stitching-dc', icon: Factory,      label: 'KajaButton DC', color: '#7e22ce',
    roles: ['ADMIN','PURCHASER','PACKING_INCHARGE'] },
  { to: '/ironing-dc',  icon: Printer,       label: 'Ironing DC',    color: '#0e7490',
    roles: ['ADMIN','PURCHASER','PACKING_INCHARGE'] },
  { to: '/checking-dc', icon: ClipboardList, label: 'Checking DC',   color: '#0f766e',
    roles: ['ADMIN','PURCHASER','PACKING_INCHARGE'] },
  { to: '/stage-grn',   icon: ClipboardList, label: 'Stage GRN',     color: '#0891b2',
    roles: ['ADMIN','PURCHASER','PACKING_INCHARGE'] },

  { section: 'Dispatch' },
  { to: '/packing',  icon: PackageCheck, label: 'Packing',  color: '#15803d',
    roles: ['ADMIN','PURCHASER','PACKING_INCHARGE'] },
  { to: '/dispatch', icon: MapPin,       label: 'Dispatch', color: '#b91c1c',
    roles: ['ADMIN','PURCHASER','PACKING_INCHARGE'] },

  { section: 'Stock' },
  { to: '/stock', icon: Archive, label: 'Stock Entries', color: '#16a34a',
    roles: ['ADMIN','PURCHASER','STOCK_INCHARGE','PACKING_INCHARGE'] },

  { section: 'Masters' },
  { to: '/schools',          icon: School,  label: 'Schools',           color: '#0d9488' },
  { to: '/purchase-parties', icon: Users,   label: 'Purchase Parties',  color: '#7c3aed',
    roles: ['ADMIN','PURCHASER','STOCK_INCHARGE'] },
  { to: '/colours',          icon: Palette, label: 'Colours',           color: '#db2777',
    roles: ['ADMIN','PURCHASER','STOCK_INCHARGE','PACKING_INCHARGE'] },

  { section: 'Products' },
  { to: '/styles',          icon: Layers,   label: 'Styles',          color: '#f97316' },
  { to: '/fabrics',         icon: Layers,   label: 'Fabrics',         color: '#10b981',
    roles: ['ADMIN','PURCHASER','STOCK_INCHARGE'] },
  { to: '/accessories',     icon: Package,  label: 'Accessories',     color: '#0891b2',
    roles: ['ADMIN','PURCHASER','STOCK_INCHARGE'] },
  { to: '/stitching-units', icon: Factory,  label: 'Stitching Units', color: '#64748b' },

  { section: 'System' },
  { to: '/users',    icon: UserRound, label: 'User Management', color: '#6366f1', roles: ['ADMIN'] },
]

const ROLE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN:           { label: 'Admin',         color: '#fff',    bg: '#dc2626' },
  PURCHASER:       { label: 'Purchaser',     color: '#fff',    bg: '#1d4ed8' },
  STOCK_INCHARGE:  { label: 'Stock',         color: '#fff',    bg: '#059669' },
  PACKING_INCHARGE:{ label: 'Packing',       color: '#fff',    bg: '#7c3aed' },
}

export default function Layout() {
  const { user, logout, updatePicture } = useAuth()
  const role = user?.role ?? ''

  const visibleNav = ALL_NAV.filter(item => {
    if ('section' in item) return true
    if (!item.roles) return true
    return item.roles.includes(role)
  })

  // Remove orphan section headers (section with no visible items after it)
  const filteredNav: NavItem[] = []
  for (let i = 0; i < visibleNav.length; i++) {
    const item = visibleNav[i]
    if ('section' in item) {
      const next = visibleNav.slice(i + 1).find(n => !('section' in n) || n.section !== item.section)
      if (next && !('section' in next)) filteredNav.push(item)
    } else {
      filteredNav.push(item)
    }
  }

  const badge = ROLE_BADGES[role]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 'var(--sidebar-w)', background: '#1e293b', color: 'var(--white)',
        display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto'
      }}>
        <div style={{
          padding: '16px 14px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <img src={tabLogo} alt="Apple Uniformm"
            style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 12, background: '#fff', objectFit: 'contain', padding: 6 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '0.01em', lineHeight: 1.2 }}>Apple Uniformm</div>
            <div style={{ fontSize: 14, color: '#FFFFFF', marginTop: 4 }}>Purchase Manager</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px 0' }}>
          {filteredNav.map((item, i) => {
            if ('section' in item) {
              return (
                <div key={i} style={{
                  padding: '16px 18px 5px', fontSize: 14, fontWeight: 900,
                  textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(255,255,255,0.60)'
                }}>
                  {item.section}
                </div>
              )
            }
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 12px', margin: '1px 8px',
                  borderRadius: 7, fontSize: 16, fontWeight: 600,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.82)',
                  background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
                  textDecoration: 'none', transition: 'all 0.12s',
                })}
              >
                {({ isActive }) => (
                  <>
                    <span style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isActive ? item.color : `${item.color}28`,
                      transition: 'background 0.12s',
                    }}>
                      <Icon size={16} weight="fill" color={isActive ? '#fff' : item.color} />
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          height: 'var(--header-h)', background: 'var(--white)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 24px',
          boxShadow: 'var(--shadow)', flexShrink: 0, gap: 18
        }}>
          <img src={logo} alt="Apple Uniformm"
            style={{ height: 84, width: 'auto', maxWidth: 420, objectFit: 'contain', display: 'block' }} />
          <div style={{ width: 1, height: 48, background: 'var(--border)' }} />
          <span style={{ fontSize: 16, color: 'var(--text-main)', fontWeight: 600 }}>
            Purchase Order Management System
          </span>

          {/* ── User chip — top-right of header ── */}
          <UserChip user={user} badge={badge} onLogout={logout} onPictureChange={updatePicture} />
        </header>

        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--off-white)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// ── UserChip — real photo avatar + dropdown ───────────────────────────────────

interface UserChipProps {
  user: { fullName: string; profilePicture?: string | null } | null
  badge: { label: string; color: string; bg: string } | null
  onLogout: () => void
  onPictureChange: (pic: string | null) => void
}

function UserChip({ user, badge, onLogout, onPictureChange }: UserChipProps) {
  const [open, setOpen] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    const h = () => setOpen(false)
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [open])

  const initials = user?.fullName
    ?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      await authApi.updateOwnPicture(compressed)
      onPictureChange(compressed)
    } catch {
      alert('Failed to upload photo. Please try a smaller image.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const Avatar = ({ size = 36 }: { size?: number }) => (
    user?.profilePicture ? (
      <img
        src={user.profilePicture}
        alt={user.fullName}
        style={{
          width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
          border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.18)'
        }}
      />
    ) : (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: badge
          ? `linear-gradient(135deg, ${badge.bg} 0%, ${badge.bg}bb 100%)`
          : 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 800, color: '#fff', letterSpacing: '0.02em',
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)', border: '2px solid #fff'
      }}>
        {initials}
      </div>
    )
  )

  return (
    <div style={{ marginLeft: 'auto', position: 'relative' }}>
      {/* Hidden file input */}
      <input
        ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Chip button */}
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '5px 10px 5px 5px', borderRadius: 40,
          background: open ? '#f1f5f9' : '#fff',
          border: '1.5px solid #e2e8f0',
          cursor: 'pointer', transition: 'all 0.15s',
          boxShadow: open ? '0 0 0 3px #e0e7ff' : 'none',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = '#f8fafc' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = '#fff' }}
      >
        <Avatar size={36} />

        <div style={{ textAlign: 'left', lineHeight: 1.25 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
            {user?.fullName ?? 'User'}
          </div>
          {badge && (
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
              {badge.label}
            </div>
          )}
        </div>

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: '#fff', borderRadius: 14,
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
            minWidth: 220, overflow: 'hidden', zIndex: 999,
          }}
        >
          {/* Profile photo area */}
          <div style={{
            padding: '18px 16px 14px', borderBottom: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            {/* Clickable avatar to change photo */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar size={52} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                title="Change photo"
                style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#1d4ed8', border: '2px solid #fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0
                }}
              >
                {uploading ? (
                  <span style={{ fontSize: 8, color: '#fff' }}>…</span>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                )}
              </button>
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{user?.fullName}</div>
              {badge && (
                <span style={{
                  display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 800,
                  padding: '2px 8px', borderRadius: 5,
                  background: badge.bg, color: badge.color,
                  textTransform: 'uppercase', letterSpacing: '0.06em'
                }}>
                  {badge.label}
                </span>
              )}
              <div
                onClick={() => fileRef.current?.click()}
                style={{ fontSize: 11, color: '#3b82f6', marginTop: 5, cursor: 'pointer' }}
              >
                {uploading ? 'Uploading…' : user?.profilePicture ? 'Change photo' : 'Upload photo'}
              </div>
            </div>
          </div>

          {/* Sign Out */}
          <button
            onClick={onLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '12px 16px', fontSize: 13, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#64748b', textAlign: 'left', transition: 'background 0.12s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748b' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
