import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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

// A labelled text input with an inline error message under it.
function TextField({ label, error, ...props }) {
  return (
    <label className="ax-field">{label}
      <span className={'ax-input' + (error ? ' bad' : '')}><input {...props} aria-invalid={!!error} /></span>
      {error && <small className="ax-err" role="alert">{error}</small>}
    </label>
  )
}

function PasswordField({ label, value, onChange, onBlur, autoComplete, error }) {
  const [show, setShow] = useState(false)
  return (
    <label className="ax-field">{label}
      <span className={'ax-input' + (error ? ' bad' : '')}>
        <input type={show ? 'text' : 'password'} required maxLength={72} value={value} onChange={onChange} onBlur={onBlur}
          autoComplete={autoComplete} aria-invalid={!!error} />
        <button type="button" className="ax-eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}><Eye off={show} /></button>
      </span>
      {error && <small className="ax-err" role="alert">{error}</small>}
    </label>
  )
}

// Asks the server for a new verification link (the answer is always the same, so it never reveals which emails have accounts).
function ResendVerification({ email }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
  const go = async () => {
    setBusy(true); setMsg(''); setErr('')
    try { await api('/auth/resend-verification', { method: 'POST', body: { email: email.trim() } }); setMsg('If this account still needs verifying, a new link is on its way. Check your inbox and spam folder.') }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="ax-resend">
      <button type="button" className="btn btn-outline sm" disabled={busy || !email.trim()} onClick={go}>{busy ? 'Sending…' : 'Resend verification email'}</button>
      {msg && <div className="alert ok" role="status">{msg}</div>}
      {err && <div className="alert" role="alert">{err}</div>}
    </div>
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
  const [unverified, setUnverified] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setUnverified(false); setBusy(true)
    try { const me = await login(email.trim(), pw); if (me) nav(home(me)) }
    catch (x) { setErr(x.message); setUnverified(x.code === 'email_not_verified') } finally { setBusy(false) }
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
        {unverified && <ResendVerification email={email} />}
        <button className="btn btn-primary full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <GoogleButton onError={setErr} />
    </Shell>
  )
}

// Opened from the link in the verification email: /verify-email/:token
export function VerifyEmail() {
  const { token } = useParams()
  const [st, setSt] = useState({ s: 'loading', msg: '' })
  useEffect(() => {
    let off = false
    api('/auth/verify/' + encodeURIComponent(token))
      .then(() => { if (!off) setSt({ s: 'ok', msg: '' }) })
      .catch((e) => { if (!off) setSt({ s: 'err', msg: e.message }) })
    return () => { off = true }
  }, [token])
  return (
    <Shell title="Email verification" sub="" foot={<>Back to <Link to="/login">log in</Link></>}
      art={{ h: 'Almost there', p: 'Verifying your email keeps your account and your applications safe.', points: ['One click to confirm', 'Your account stays private', 'Then log in and get started'] }}>
      <div className="ax-done">
        {st.s === 'loading' && <p role="status">Verifying your email…</p>}
        {st.s === 'ok' && <>
          <div className="alert ok" role="status">Your email is verified. You can log in now.</div>
          <Link className="btn btn-primary" to="/login">Go to log in</Link></>}
        {st.s === 'err' && <>
          <div className="alert" role="alert">{st.msg}</div>
          <p>Enter your email on the login page and use “Resend verification email” to get a new link.</p>
          <Link className="btn btn-outline" to="/login">Go to log in</Link></>}
      </div>
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

/* ---------- sign-up validation (the server checks the same rules) ---------- */
const NAME_RE = /^\p{L}[\p{L} .'’-]*$/u
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const pwRules = (p) => [['At least 8 characters', p.length >= 8], ['A letter', /[A-Za-z]/.test(p)], ['A number', /\d/.test(p)]]
const validSite = (w) => { try { return new URL(/^https?:\/\//i.test(w) ? w : 'https://' + w).hostname.includes('.') } catch { return false } }

function checkRegister(f, role) {
  const e = {}
  const first = f.first.trim(); const last = f.last.trim()
  if (!first) e.first = 'Enter your first name'
  else if (first.length < 2 || !NAME_RE.test(first)) e.first = 'Use letters only (at least 2)'
  if (last && !NAME_RE.test(last)) e.last = 'Use letters only'
  if (!f.email.trim()) e.email = 'Enter your email'
  else if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email, like name@example.com'
  if (role === 'employer') {
    if (f.company_name.trim().length < 2) e.company_name = 'Enter your company name'
    if (f.website.trim() && !validSite(f.website.trim())) e.website = 'Enter a valid website, like https://example.com'
  }
  if (!f.password) e.password = 'Create a password'
  else if (pwRules(f.password).some(([, ok]) => !ok)) e.password = 'Password needs 8+ characters, a letter and a number'
  else if (new TextEncoder().encode(f.password).length > 72) e.password = 'Password is too long'
  if (!f.confirm) e.confirm = 'Re-enter your password'
  else if (f.password !== f.confirm) e.confirm = 'Passwords do not match'
  return e
}

function CheckEmail({ email, devUrl }) {
  return (
    <div className="ax-done">
      <h2>Check your email</h2>
      <p>We sent a verification link to <b>{email}</b>. Open it to activate your account, then log in.</p>
      {devUrl && <p className="ax-hint">Local testing only: <a className="link" href={devUrl}>open the verification link</a></p>}
      <ResendVerification email={email} />
      <Link className="btn btn-primary" to="/login">Go to log in</Link>
    </div>
  )
}

function RegisterForm({ role }) {
  const { login } = useAuth(); const nav = useNavigate()
  const [f, setF] = useState({ first: '', last: '', email: '', password: '', confirm: '', company_name: '', website: '' })
  const [agree, setAgree] = useState(false)
  const [seen, setSeen] = useState({})                    // fields the user has left (errors show only for those) or all after submit
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const blur = (k) => () => setSeen((s) => ({ ...s, [k]: true }))
  const errors = checkRegister(f, role)
  const shown = (k) => (seen[k] ? errors[k] : '')
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (Object.keys(errors).length) { setSeen({ first: 1, last: 1, email: 1, company_name: 1, website: 1, password: 1, confirm: 1 }); setErr('Please fix the highlighted fields.'); return }
    if (!agree) { setErr('Please accept the Terms of Service and Privacy Policy'); return }
    setBusy(true)
    try {
      const full_name = [f.first, f.last].map((s) => s.trim()).filter(Boolean).join(' ') || null
      const email = f.email.trim().toLowerCase()
      const body = { email, password: f.password, role, full_name }
      if (role === 'employer') { body.company_name = f.company_name.trim(); body.website = f.website.trim() || null }
      const r = await api('/auth/register', { method: 'POST', body })
      if (r.verification_required) { setSent({ email, devUrl: r.dev_verify_url }); return }      // verify first, then log in
      const me = await login(email, f.password)
      if (me) nav(home(me))
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const art = role === 'employer'
    ? { h: 'Hire faster across Pakistan', p: 'Post a job in minutes and manage every candidate in one place.', points: ['Post jobs in 5 steps', 'Review and message candidates', 'Build your company profile'] }
    : { h: 'Your next job starts here', p: 'Create a profile once and apply to jobs from top sources and verified employers.', points: ['Jobs refreshed every 30 minutes', 'Save jobs and track applications', 'Read company reviews'] }
  if (sent) return <Shell title="Almost done" sub="Confirm your email to finish" foot={<>Already verified? <Link to="/login">Log in</Link></>} art={art}><CheckEmail {...sent} /></Shell>
  return (
    <Shell title="Create account" sub="Create your account to get started" foot={<>Already have an account? <Link to="/login">Log in</Link></>} art={art}>
      <p className="ax-hint" style={{ textAlign: 'center', margin: '0 0 14px' }}>Signing up as {role === 'employer' ? 'an employer' : 'a candidate'}. <Link to="/register">Change</Link></p>
      <form onSubmit={submit} className="ax-form" noValidate>
        <div className="ax-row">
          <TextField label="First name" autoComplete="given-name" maxLength={60} value={f.first} onChange={set('first')} onBlur={blur('first')} placeholder="First name" error={shown('first')} />
          <TextField label="Last name" autoComplete="family-name" maxLength={60} value={f.last} onChange={set('last')} onBlur={blur('last')} placeholder="Last name" error={shown('last')} />
        </div>
        <TextField label="Email" type="email" autoComplete="email" maxLength={254} value={f.email} onChange={set('email')} onBlur={blur('email')} placeholder="Enter your email" error={shown('email')} />
        {role === 'employer' && <>
          <TextField label="Company name" maxLength={200} value={f.company_name} onChange={set('company_name')} onBlur={blur('company_name')} error={shown('company_name')} />
          <TextField label="Company website (optional)" maxLength={255} value={f.website} onChange={set('website')} onBlur={blur('website')} placeholder="https://" error={shown('website')} />
        </>}
        <div className="ax-row">
          <PasswordField label="Password" value={f.password} onChange={set('password')} onBlur={blur('password')} autoComplete="new-password" error={shown('password')} />
          <PasswordField label="Confirm password" value={f.confirm} onChange={set('confirm')} onBlur={blur('confirm')} autoComplete="new-password" error={shown('confirm')} />
        </div>
        <ul className="ax-rules" aria-label="Password requirements">{pwRules(f.password).map(([t, ok]) => <li key={t} className={ok ? 'ok' : ''}>{t}</li>)}</ul>
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
