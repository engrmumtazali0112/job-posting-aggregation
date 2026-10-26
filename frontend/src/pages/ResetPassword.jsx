import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Shell, PasswordField } from './Auth.jsx'

const ART = { h: 'Choose a new password', p: 'Pick something you do not use anywhere else.',
  points: ['At least 8 characters', 'A letter and a number', 'Then log in as usual'] }
const rules = (p) => [['At least 8 characters', p.length >= 8], ['A letter', /[A-Za-z]/.test(p)], ['A number', /\d/.test(p)]]

function check(pw, confirm) {
  const e = {}
  if (!pw) e.password = 'Enter a new password'
  else if (rules(pw).some(([, ok]) => !ok)) e.password = 'Password needs 8+ characters, a letter and a number'
  else if (new TextEncoder().encode(pw).length > 72) e.password = 'Password is too long'
  if (!confirm) e.confirm = 'Re-enter your new password'
  else if (pw !== confirm) e.confirm = 'Passwords do not match'
  return e
}

export default function ResetPassword() {
  const { token } = useParams(); const nav = useNavigate()
  const [pw, setPw] = useState(''); const [confirm, setConfirm] = useState('')
  const [seen, setSeen] = useState({}); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [dead, setDead] = useState(false)
  const errors = check(pw, confirm)
  const shown = (k) => (seen[k] ? errors[k] : '')

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (Object.keys(errors).length) { setSeen({ password: 1, confirm: 1 }); return }
    setBusy(true)
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password: pw } })
      nav('/login', { replace: true, state: { reset: true } })
    } catch (x) {
      setErr(x.message)
      setDead(x.status === 400)                       // invalid or expired link: offer a new one
    } finally { setBusy(false) }
  }

  return (
    <Shell title="Set a new password" sub="Enter and confirm your new password" foot={<>Back to <Link to="/login">log in</Link></>} art={ART}>
      <form onSubmit={submit} className="ax-form" noValidate>
        <PasswordField label="New password" value={pw} onChange={(e) => setPw(e.target.value)} onBlur={() => setSeen((s) => ({ ...s, password: 1 }))}
          autoComplete="new-password" error={shown('password')} />
        <PasswordField label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onBlur={() => setSeen((s) => ({ ...s, confirm: 1 }))}
          autoComplete="new-password" error={shown('confirm')} />
        <ul className="ax-rules" aria-label="Password requirements">{rules(pw).map(([t, ok]) => <li key={t} className={ok ? 'ok' : ''}>{t}</li>)}</ul>
        {err && <div className="alert" role="alert">{err}</div>}
        {dead && <Link className="btn btn-outline sm" to="/forgot-password">Request a new reset link</Link>}
        <button className="btn btn-primary full" disabled={busy}>{busy ? 'Saving…' : 'Reset password'}</button>
      </form>
    </Shell>
  )
}
