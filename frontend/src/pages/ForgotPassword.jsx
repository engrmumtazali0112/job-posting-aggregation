import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Shell } from './Auth.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const ART = { h: 'Forgot your password?', p: 'It happens. Tell us your email and we will send you a link to choose a new one.',
  points: ['The link works for 1 hour', 'It can only be used once', 'Your account stays private'] }

export default function ForgotPassword() {
  const [email, setEmail] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    const v = email.trim()
    if (!EMAIL_RE.test(v)) { setErr('Enter a valid email, like name@example.com'); return }
    setBusy(true)
    try { await api('/auth/forgot-password', { method: 'POST', body: { email: v } }); setSent(true) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <Shell title="Reset your password" sub={sent ? '' : 'Enter your email and we will send you a reset link'}
      foot={<>Remembered it? <Link to="/login">Log in</Link></>} art={ART}>
      {sent ? (
        <div className="ax-done">
          <div className="alert ok" role="status">If an account exists for <b>{email.trim()}</b>, a reset link has been sent.</div>
          <p>Check your inbox and spam folder. The link works for 1 hour.</p>
          <button type="button" className="btn btn-outline sm" onClick={() => setSent(false)}>Use a different email</button>
          <Link className="btn btn-primary" to="/login">Back to log in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="ax-form" noValidate>
          <label className="ax-field">Email
            <span className={'ax-input' + (err ? ' bad' : '')}>
              <input type="email" required autoComplete="email" autoFocus maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email" aria-invalid={!!err} />
            </span>
          </label>
          {err && <div className="alert" role="alert">{err}</div>}
          <button className="btn btn-primary full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </Shell>
  )
}
