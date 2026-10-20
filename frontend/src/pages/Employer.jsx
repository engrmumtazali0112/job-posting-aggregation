import { useEffect, useState } from 'react'
import { api, timeAgo } from '../api'

export default function Employer() {
  const empty = { title: '', location: '', description: '', apply_url: '' }
  const [f, setF] = useState(empty); const [jobs, setJobs] = useState([])
  const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false)
  const load = () => api('/employer/jobs').then(setJobs).catch(() => {})
  useEffect(() => { load() }, [])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setMsg(null); setBusy(true)
    try {
      const j = await api('/employer/jobs', { method: 'POST', body: { ...f, apply_url: f.apply_url || null } })
      setMsg({ ok: true, t: j.status === 'pending' ? 'Job submitted. It will go live after admin approval.' : 'Job published!' })
      setF(empty); load()
    } catch (x) { setMsg({ ok: false, t: x.message }) } finally { setBusy(false) }
  }
  return (
    <div className="wrap pad two">
      <div className="card pad-card">
        <h2>Post a job</h2>
        <form className="form" onSubmit={submit}>
          <label>Job title<input required minLength={3} value={f.title} onChange={set('title')} placeholder="e.g. Senior React Developer" /></label>
          <label>Location<input value={f.location} onChange={set('location')} placeholder="City or Remote" /></label>
          <label>Apply link or email URL (optional)<input value={f.apply_url} onChange={set('apply_url')} placeholder="https://" /></label>
          <label>Description (min 20 characters)<textarea required minLength={20} rows={8} value={f.description} onChange={set('description')} /></label>
          {msg && <div className={msg.ok ? 'alert ok' : 'alert'}>{msg.t}</div>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit job'}</button>
        </form>
      </div>
      <div>
        <h2>My jobs</h2>
        {jobs.length === 0 ? <div className="card empty">You have not posted any jobs yet.</div> :
          jobs.map((j) => (
            <div className="card row" key={j.id}>
              <div><strong>{j.title}</strong><div className="muted">{j.location || '—'} · {timeAgo(j.created_at)}</div></div>
              <span className={'status s-' + j.status}>{j.status}</span>
            </div>))}
      </div>
    </div>
  )
}
