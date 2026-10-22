import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'

const home = (me) => (me.role === 'admin' ? '/admin' : me.role === 'employer' ? '/employer/dashboard' : '/')

const Eye = ({ off }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
)

function Shell({ title, sub, children, foot, art }) {
  return (
    <div className="ax-page">
      <div className="ax-card">
        <div className="ax-side">
          <Link to="/" className="ax-back" aria-label="Back to home">‹ Home</Link>
          <h1>{title}</h1><p className="ax-sub">{sub}</p>
          {children}
          <p className="ax-foot">{foot}</p>
        </div>
        <aside className="ax-art" aria-hidden="true">
          <div className="ax-brand">JobBoard</div>
          <h2>{art.h}</h2>
          <p>{art.p}</p>
          <ul>{art.points.map((x) => <li key={x}>{x}</li>)}</ul>
        </aside>
      </div>
    </div>
  )
}

function PasswordField({ label, value, onChange, autoComplete, minLength }) {
  const [show, setShow] = useState(false)
  return (
    <label className="ax-field">{label}
      <span className="ax-input">
        <input type={show ? 'text' : 'password'} required minLength={minLength} maxLength={72} value={value}
          onChange={onChange} autoComplete={autoComplete} />
        <button type="button" className="ax-eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}><Eye off={show} /></button>
      </span>
    </label>
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
      window.google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', width: 300, text: 'continue_with' })
    }
    if (window.google?.accounts?.id) { init(); return }
    let s = document.querySelector('script[data-gsi]')
    if (!s) { s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.dataset.gsi = '1'; document.head.appendChild(s) }
    s.addEventListener('load', init)
    return () => s.removeEventListener('load', init)
  }, [cid])
  if (!cid) return null
  return <><div className="ax-or"><span>OR</span></div><div className="ax-google" ref={box} /></>
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
    <Shell title="Welcome back" sub="Log in to your account" foot={<>New here? <Link to="/register">Create an account</Link></>}
      art={{ h: 'Pick up where you left off', p: 'Your saved jobs, applications and messages are waiting.', points: ['Track every application', 'Message employers directly', 'Get alerts for new jobs'] }}>
      <form onSubmit={submit} className="ax-form">
        <label className="ax-field">Email
          <span className="ax-input"><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" /></span>
        </label>
        <PasswordField label="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
        {err && <div className="alert" role="alert">{err}</div>}
        <button className="btn btn-primary full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <GoogleButton onError={setErr} />
    </Shell>
  )
}

const Person = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>
const Case = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></svg>

function RoleChoice() {
  const nav = useNavigate(); const [role, setRole] = useState('job_seeker')
  const opts = [['job_seeker', <Person />, "I'm a candidate, looking for work", 'Explore opportunities that match your skills'],
    ['employer', <Case />, "I'm an employer, hiring for a project", 'Find talented professionals for your team']]
  return (
    <div className="ax-page"><div className="ax-choose">
      <Link to="/" className="ax-back">‹ Back to home</Link>
      <h1>Join as an employer or candidate</h1>
      <div className="ax-opts" role="radiogroup" aria-label="Account type">
        {opts.map(([k, icon, t, sub]) => (
          <button key={k} type="button" role="radio" aria-checked={role === k} className={'ax-opt' + (role === k ? ' on' : '')} onClick={() => setRole(k)}>
            {icon}<b>{t}</b><span>{sub}</span><i className="ax-radio" />
          </button>))}
      </div>
      <button className="btn btn-primary" onClick={() => nav('/register?role=' + role)}>{role === 'employer' ? 'Continue as an employer' : 'Continue as a candidate'}</button>
      <p className="ax-foot">Already have an account? <Link to="/login">Log in</Link></p>
    </div></div>
  )
}

export function Register() {
  const [sp] = useSearchParams(); const r = sp.get('role')
  return r === 'employer' || r === 'job_seeker' ? <RegisterForm role={r} /> : <RoleChoice />
}

function RegisterForm({ role }) {
  const { login } = useAuth(); const nav = useNavigate()
  const [f, setF] = useState({ first: '', last: '', email: '', password: '', confirm: '', company_name: '', website: '' })
  const [agree, setAgree] = useState(false)
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (f.password !== f.confirm) { setErr('Passwords do not match'); return }
    if (!agree) { setErr('Please accept the Terms of Service and Privacy Policy'); return }
    setBusy(true)
    try {
      const full_name = [f.first, f.last].map((s) => s.trim()).filter(Boolean).join(' ') || null
      const body = { email: f.email, password: f.password, role, full_name }
      if (role === 'employer') { body.company_name = f.company_name; body.website = f.website || null }
      await api('/auth/register', { method: 'POST', body })
      const me = await login(f.email, f.password)
      if (me) nav(home(me))
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Shell title="Create account" sub="Create your account to get started" foot={<>Already have an account? <Link to="/login">Log in</Link></>}
      art={role === 'employer'
        ? { h: 'Hire faster across Pakistan', p: 'Post a job in minutes and manage every candidate in one place.', points: ['Post jobs in 5 steps', 'Review and message candidates', 'Build your company profile'] }
        : { h: 'Your next job starts here', p: 'Create a profile once and apply to jobs from top sources and verified employers.', points: ['Jobs refreshed every 30 minutes', 'Save jobs and track applications', 'Read company reviews'] }}>
      <p className="ax-hint" style={{ textAlign: 'center', margin: '0 0 14px' }}>Signing up as {role === 'employer' ? 'an employer' : 'a candidate'}. <Link to="/register">Change</Link></p>
      <form onSubmit={submit} className="ax-form">
        <div className="ax-row">
          <label className="ax-field">First name<span className="ax-input"><input required autoComplete="given-name" value={f.first} onChange={set('first')} placeholder="First name" /></span></label>
          <label className="ax-field">Last name<span className="ax-input"><input autoComplete="family-name" value={f.last} onChange={set('last')} placeholder="Last name" /></span></label>
        </div>
        <label className="ax-field">Email<span className="ax-input"><input type="email" required autoComplete="email" value={f.email} onChange={set('email')} placeholder="Enter your email" /></span></label>
        {role === 'employer' && <>
          <label className="ax-field">Company name<span className="ax-input"><input required value={f.company_name} onChange={set('company_name')} /></span></label>
          <label className="ax-field">Company website (optional)<span className="ax-input"><input value={f.website} onChange={set('website')} placeholder="https://" /></span></label>
        </>}
        <div className="ax-row">
          <PasswordField label="Password" value={f.password} onChange={set('password')} autoComplete="new-password" minLength={8} />
          <PasswordField label="Confirm password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" minLength={8} />
        </div>
        <p className="ax-hint">At least 8 characters.</p>
        <label className="ax-check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I understand and agree to the Terms of Service and Privacy Policy.</span>
        </label>
        {err && <div className="alert" role="alert">{err}</div>}
        <button className="btn btn-primary full" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
      </form>
      {role === 'job_seeker' && <GoogleButton onError={setErr} />}
    </Shell>
  )
}