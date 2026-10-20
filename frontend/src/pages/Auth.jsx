import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'

function Shell({ title, sub, children, foot }) {
  return (
    <div className="auth-bg"><div className="card auth">
      <div className="logo center-logo"><span className="logo-mark">J</span>JobBoard</div>
      <h1>{title}</h1><p className="sub2">{sub}</p>{children}<p className="foot2">{foot}</p>
    </div></div>
  )
}

export function Login() {
  const { login } = useAuth(); const nav = useNavigate()
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { const me = await login(email, pw); nav(me.role === 'admin' ? '/admin' : me.role === 'employer' ? '/employer' : '/jobs') }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Shell title="Welcome back" sub="Log in to your account" foot={<>New here? <Link to="/register">Create an account</Link></>}>
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
  const [f, setF] = useState({ email: '', password: '', company_name: '', website: '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const body = { email: f.email, password: f.password, role }
      if (role === 'employer') { body.company_name = f.company_name; body.website = f.website || null }
      await api('/auth/register', { method: 'POST', body })
      const me = await login(f.email, f.password)
      nav(me.role === 'employer' ? '/employer' : '/jobs')
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Shell title="Create your account" sub="Join as a job seeker or an employer" foot={<>Already registered? <Link to="/login">Log in</Link></>}>
      <div className="seg">
        <button type="button" className={role === 'job_seeker' ? 'on' : ''} onClick={() => setRole('job_seeker')}>Job seeker</button>
        <button type="button" className={role === 'employer' ? 'on' : ''} onClick={() => setRole('employer')}>Employer</button>
      </div>
      <form onSubmit={submit} className="form">
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
