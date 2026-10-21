import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PanelLayout from '../components/PanelLayout.jsx'
import JobCard from '../components/JobCard.jsx'
import { Badge } from '../components/ui.jsx'
import { api, timeAgo } from '../api'

export const Layout = () => (
  <PanelLayout title="My account" items={[['/my/applications', 'My applications'], ['/my/saved', 'Saved jobs'], ['/my/profile', 'Profile']]} />
)

export function Applications() {
  const [apps, setApps] = useState(null); const [note, setNote] = useState('')
  const load = () => api('/seeker/applications').then(setApps).catch((e) => setNote(e.message))
  useEffect(() => { load() }, [])
  const withdraw = async (a) => {
    if (!window.confirm('Withdraw this application?')) return
    try { await api('/seeker/applications/' + a.id, { method: 'DELETE' }); load() } catch (e) { setNote(e.message) }
  }
  return (
    <>
      <h1 className="page-title">My applications</h1>
      {note && <div className="alert">{note}</div>}
      {apps === null ? <div className="card skel" /> : apps.length === 0 ?
        <div className="card empty">You have not applied to any jobs yet. <Link className="link" to="/jobs">Browse jobs →</Link></div> :
        apps.map((a) => (
          <div className="card row" key={a.id}>
            <div className="grow">
              <Link to={`/jobs/${a.job_id}`}><strong>{a.job_title}</strong></Link>
              <div className="muted">{a.company_name} · applied {timeAgo(a.created_at)}{a.job_status !== 'published' ? ' · job is ' + a.job_status : ''}</div>
            </div>
            <Badge s={a.status} />
            <button className="btn btn-ghost sm danger" onClick={() => withdraw(a)}>Withdraw</button>
          </div>))}
    </>
  )
}

export function Saved() {
  const [jobs, setJobs] = useState(null)
  const load = () => api('/seeker/saved').then(setJobs).catch(() => setJobs([]))
  useEffect(() => { load() }, [])
  const remove = async (id) => { await api('/seeker/saved/' + id, { method: 'DELETE' }); load() }
  return (
    <>
      <h1 className="page-title">Saved jobs</h1>
      {jobs === null ? <div className="card skel" /> : jobs.length === 0 ?
        <div className="card empty">No saved jobs yet. Open a job and press Save.</div> :
        <div className="grid grid2">{jobs.map((j) => (
          <div key={j.id}><JobCard job={j} /><button className="btn btn-ghost sm danger" onClick={() => remove(j.id)}>Remove</button></div>))}</div>}
    </>
  )
}

export function Profile() {
  const [p, setP] = useState(null); const [msg, setMsg] = useState(null)
  useEffect(() => { api('/seeker/profile').then(setP).catch((e) => setMsg({ ok: false, t: e.message })) }, [])
  if (!p) return msg ? <div className="alert">{msg.t}</div> : <div className="card skel" />
  const save = async (e) => {
    e.preventDefault(); setMsg(null)
    try { await api('/seeker/profile', { method: 'PUT', body: { full_name: p.full_name || null } }); setMsg({ ok: true, t: 'Profile saved.' }) }
    catch (x) { setMsg({ ok: false, t: x.message }) }
  }
  return (
    <>
      <h1 className="page-title">Profile</h1>
      <form className="card pad-card form" onSubmit={save}>
        <label>Email<input value={p.email} disabled /></label>
        <label>Full name<input value={p.full_name || ''} onChange={(e) => setP({ ...p, full_name: e.target.value })} placeholder="Shown to employers when you apply" /></label>
        {msg && <div className={msg.ok ? 'alert ok' : 'alert'}>{msg.t}</div>}
        <button className="btn btn-primary">Save</button>
      </form>
    </>
  )
}
