import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/auth'
import logo from '../assets/apple-uniformm-logo.png'

type LoginState = 'idle' | 'loading' | 'error' | 'locked' | 'disabled'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginState, setLoginState] = useState<LoginState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<string | null>(null)

  const isLocked    = loginState === 'locked'
  const isDisabled  = loginState === 'disabled'
  const isLoading   = loginState === 'loading'
  const hasError    = loginState === 'error' || isLocked || isDisabled

  // Clear error only when the user deliberately edits the fields (fresh attempt)
  const handleUsernameChange = (v: string) => {
    setUsername(v)
    if (loginState === 'error') {
      setLoginState('idle')
      setErrorMsg(null)
    }
  }

  const handlePasswordChange = (v: string) => {
    setPassword(v)
    if (loginState === 'error') {
      setLoginState('idle')
      setErrorMsg(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Don't re-submit if locked or disabled — show the message
    if (isLocked || isDisabled || isLoading) return

    setLoginState('loading')
    setErrorMsg(null)

    try {
      const res = await authApi.login(username.trim(), password)
      login(res.token, res.role, res.fullName, res.profilePicture)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed'

      // Detect account locked vs wrong credentials vs disabled
      if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('lock')) {
        setLoginState('locked')
      } else if (msg.toLowerCase().includes('deactivated') || msg.toLowerCase().includes('disabled')) {
        setLoginState('disabled')
      } else {
        setLoginState('error')
      }
      setErrorMsg(msg)
    }
  }

  const handleTryAgain = () => {
    setPassword('')
    setLoginState('idle')
    setErrorMsg(null)
    setErrorType(null)
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
    border: `1px solid ${hasError && loginState !== 'locked' && loginState !== 'disabled' ? '#fca5a5' : '#d1d5db'}`,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    background: isLocked || isDisabled ? '#f9fafb' : '#fff',
    color: isLocked || isDisabled ? '#9ca3af' : '#111827',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 36px', width: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src={logo} alt="Apple Uniformm" style={{ height: 64, objectFit: 'contain' }} />
          <div style={{ marginTop: 12, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
            AU Purchase
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Purchase Management System
          </div>
        </div>

        {/* ── LOCKED state — prominent full-card warning ── */}
        {isLocked && (
          <div style={{
            background: '#fff7ed', border: '2px solid #fb923c', borderRadius: 12,
            padding: '20px 18px', marginBottom: 20, textAlign: 'center'
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#9a3412', marginBottom: 6 }}>
              Account Locked
            </div>
            <div style={{ fontSize: 13, color: '#c2410c', lineHeight: 1.5 }}>
              {errorMsg}
            </div>
            <div style={{ fontSize: 12, color: '#ea580c', marginTop: 10 }}>
              Contact your administrator to unlock your account.
            </div>
          </div>
        )}

        {/* ── DISABLED state ── */}
        {isDisabled && (
          <div style={{
            background: '#fef2f2', border: '2px solid #f87171', borderRadius: 12,
            padding: '20px 18px', marginBottom: 20, textAlign: 'center'
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🚫</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#991b1b', marginBottom: 6 }}>
              Account Deactivated
            </div>
            <div style={{ fontSize: 13, color: '#b91c1c', lineHeight: 1.5 }}>
              {errorMsg}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              autoFocus={!isLocked && !isDisabled}
              value={username}
              onChange={e => handleUsernameChange(e.target.value)}
              placeholder="Enter your username"
              required
              disabled={isLocked || isDisabled || isLoading}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => handlePasswordChange(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isLocked || isDisabled || isLoading}
              style={inputStyle}
            />
          </div>

          <div style={{ textAlign: 'right', marginBottom: 18 }}>
            <Link to="/forgot-password" style={{ fontSize: 13, color: '#3b82f6', textDecoration: 'none' }}>
              Forgot Password?
            </Link>
          </div>

          {/* ── Error box — shown for wrong credentials ── */}
          {loginState === 'error' && errorMsg && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
              padding: '12px 14px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 600, marginBottom: 2 }}>
                ⚠ Login Failed
              </div>
              <div style={{ fontSize: 13, color: '#b91c1c', lineHeight: 1.5 }}>
                {errorMsg}
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          {!isLocked && !isDisabled && (
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', padding: '11px', borderRadius: 8, fontSize: 15, fontWeight: 600,
                background: isLoading ? '#93c5fd' : '#1d4ed8',
                color: '#fff', border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s'
              }}
            >
              {isLoading ? 'Signing in…' : loginState === 'error' ? 'Try Again' : 'Sign In'}
            </button>
          )}

          {/* When locked/disabled — show a "clear and start over" link */}
          {(isLocked || isDisabled) && (
            <button
              type="button"
              onClick={handleTryAgain}
              style={{
                width: '100%', padding: '11px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
                cursor: 'pointer', marginTop: 4
              }}
            >
              ← Try Different Account
            </button>
          )}
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
          Apple Uniformm © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
