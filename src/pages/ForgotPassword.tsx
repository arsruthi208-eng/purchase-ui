import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import logo from '../assets/apple-uniformm-logo.png'

type Step = 'email' | 'otp' | 'newPassword' | 'done'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(600) // 10 min
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (step === 'otp') {
      setSecondsLeft(600)
      timerRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { clearInterval(timerRef.current!); return 0 }
          return s - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [step])

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim())
      setStep('otp')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (secondsLeft === 0) { setError('OTP has expired. Please request a new one.'); return }
    setLoading(true)
    try {
      const token = await authApi.verifyOtp(email.trim(), otp.trim())
      setResetToken(token)
      setStep('newPassword')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return }
    if (!/[A-Z]/.test(newPassword)) { setError('Password must contain at least one uppercase letter'); return }
    if (!/\d/.test(newPassword)) { setError('Password must contain at least one digit'); return }
    setLoading(true)
    try {
      await authApi.resetPassword(resetToken, newPassword)
      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 16, padding: '40px 36px', width: 400,
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
    border: '1px solid #d1d5db', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
  }
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: '100%', padding: '11px', borderRadius: 8, fontSize: 15, fontWeight: 600,
    background: disabled ? '#93c5fd' : '#1d4ed8', color: '#fff', border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.15s'
  })
  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
    }}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={logo} alt="Apple Uniformm" style={{ height: 56, objectFit: 'contain' }} />
          <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Reset Password</div>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['email', 'otp', 'newPassword'] as Step[]).map((s, i) => (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: ['email', 'otp', 'newPassword', 'done'].indexOf(step) >= i ? '#1d4ed8' : '#e5e7eb'
            }} />
          ))}
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '10px 12px', marginBottom: 16, fontSize: 13, color: '#dc2626'
          }}>
            {error}
          </div>
        )}

        {/* STEP 1: Email */}
        {step === 'email' && (
          <form onSubmit={sendOtp}>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              Enter the email address registered to your account and we'll send you an OTP.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email Address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" style={inputStyle} autoFocus />
            </div>
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {/* STEP 2: OTP */}
        {step === 'otp' && (
          <form onSubmit={verifyOtp}>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
              We've sent a 6-digit OTP to <strong>{email}</strong>.
            </p>
            <p style={{ fontSize: 12, color: secondsLeft > 0 ? '#059669' : '#dc2626', marginBottom: 16, fontWeight: 600 }}>
              {secondsLeft > 0 ? `Expires in ${fmtTime(secondsLeft)}` : 'OTP has expired'}
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Enter OTP</label>
              <input
                type="text" required maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code" style={{ ...inputStyle, fontSize: 22, letterSpacing: 8, textAlign: 'center' }}
                autoFocus
              />
            </div>
            <button type="submit" disabled={loading || secondsLeft === 0} style={btnStyle(loading || secondsLeft === 0)}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" style={{ ...btnStyle(false), background: 'transparent', color: '#3b82f6', marginTop: 8 }}
              onClick={() => { setStep('email'); setOtp(''); setError(null) }}>
              ← Back / Resend OTP
            </button>
          </form>
        )}

        {/* STEP 3: New Password */}
        {step === 'newPassword' && (
          <form onSubmit={resetPassword}>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              Set your new password. Must be at least 8 characters with one uppercase letter and one digit.
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>New Password</label>
              <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, 1 uppercase, 1 digit" style={inputStyle} autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Confirm Password</label>
              <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password" style={inputStyle} />
            </div>
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        {/* STEP 4: Done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 600, color: '#059669', marginBottom: 8 }}>Password reset successfully!</p>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              You can now log in with your new password.
            </p>
            <button onClick={() => navigate('/login')} style={btnStyle(false)}>
              Go to Login
            </button>
          </div>
        )}

        {step !== 'done' && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Link to="/login" style={{ fontSize: 13, color: '#6b7280' }}>← Back to Login</Link>
          </div>
        )}
      </div>
    </div>
  )
}
