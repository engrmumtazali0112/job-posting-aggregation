import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'

const home = (me) => (me.role === 'admin' ? '/admin' : me.role === 'employer' ? '/employer/dashboard' : '/')

function Shell({ title, sub, children, foot }) {
  return (
    <div className="auth-bg"><div className="card auth">
      <div className="logo center-logo"><span className="logo-mark">J</span>JobBoard</div>
      <h1>{title}</h1><p className="sub2">{sub}</p>{children}<p className="foot2">{foot}</p>
    </div></div>
  )
}

// Google Identity Services button. Hidden if VITE_GOOGLE_CLIENT_ID is not set.
function GoogleButton({ onError }) {
  const { loginWithToken } = useAuth(); const nav = useNavigate()
  const box = useRef(null); const cid = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const cb = useRef()
  cb.current = async (resp) => {
    try {
      const r = await api('/auth/google', { method: 'POST', body: { credential: resp.credential } })
      const me = await loginWithToken(r.access_token)
      if (me) nav(home(me))
    } catch (x) { onError(x.message) }
  }
  useEffect(() => {
    if (!cid) return
    const init = () => {
      window.google.accounts.id.initialize({ client_id: cid, callback: (r) => cb.current(r) })
      window.google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', width: 340, text: 'continue_with' })
    }
    if (window.google?.accounts?.id) { init(); return }
    let s = document.querySelector('script[data-gsi]')
    if (!s) { s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.dataset.gsi = '1'; document.head.appendChild(s) }
    s.addEventListener('load', init)
    return () => s.removeEventListener('load', init)
  }, [cid])
  if (!cid) return null
  return <><div className="gbtn" ref={box} /><div className="or">or</div></>
}

export function Login() {
  const { login } = useAuth(); const nav = useNavigate()
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { const me = await login(email, pw); if (me) nav(home(me)) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Shell title="Welcome back" sub="Log in to your account" foot={<>New here? <Link to="/register">Create an account</Link></>}>
      <GoogleButton onError={setErr} />
      <form onSubmit={submit} className="form">
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {err && <div className="alert">{err}</div>}
        <button className="btn btn-primary full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </Shell>
  )
}

export function Register() {
  const { login } = useAuth(); const nav = useNavigate(); const [sp] = useSearchParams()
  const [role, setRole] = useState(sp.get('role') === 'employer' ? 'employer' : 'job_seeker')
  const [f, setF] = useState({ email: '', password: '', full_name: '', company_name: '', website: '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const body = { email: f.email, password: f.password, role, full_name: f.full_name || null }
      if (role === 'employer') { body.company_name = f.company_name; body.website = f.website || null }
      await api('/auth/register', { method: 'POST', body })
      const me = await login(f.email, f.password)
      if (me) nav(home(me))
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Shell title="Create your account" sub="Join as a job seeker or an employer" foot={<>Already registered? <Link to="/login">Log in</Link></>}>
      <div className="seg">
        <button type="button" className={role === 'job_seeker' ? 'on' : ''} onClick={() => setRole('job_seeker')}>Job seeker</button>
        <button type="button" className={role === 'employer' ? 'on' : ''} onClick={() => setRole('employer')}>Employer</button>
      </div>
      {role === 'job_seeker' && <GoogleButton onError={setErr} />}
      <form onSubmit={submit} className="form">
        <label>Full name<input value={f.full_name} onChange={set('full_name')} /></label>
        <label>Email<input type="email" required value={f.email} onChange={set('email')} /></label>
        <label>Password (min 8 characters)<input type="password" required minLength={8} maxLength={72} value={f.password} onChange={set('password')} /></label>
        {role === 'employer' && <>
          <label>Company name<input required value={f.company_name} onChange={set('company_name')} /></label>
          <label>Company website (optional)<input value={f.website} onChange={set('website')} placeholder="https://" /></label>
        </>}
        {err && <div className="alert">{err}</div>}
        <button className="btn btn-primary full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
    </Shell>
  )
}
