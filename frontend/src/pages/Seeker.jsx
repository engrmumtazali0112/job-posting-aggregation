import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PanelLayout from '../components/PanelLayout.jsx'
import JobCard from '../components/JobCard.jsx'
import { Badge } from '../components/ui.jsx'
import { Avatar } from '../components/JobCard.jsx'
import { api, timeAgo } from '../api'

export const Layout = () => (
  <PanelLayout title="My account" items={[['/my/applications', 'My jobs'], ['/my/saved', 'Saved jobs'], ['/my/profile', 'Profile']]} />
)

export function Applications() {
  const [apps, setApps] = useState(null); const [note, setNote] = useState('')
  const [activeTab, setActiveTab] = useState('Applied')

  const load = () => api('/seeker/applications').then(setApps).catch((e) => setNote(e.message))
  useEffect(() => { load() }, [])
  
  const withdraw = async (a) => {
    if (!window.confirm('Withdraw this application?')) return
    try { await api('/seeker/applications/' + a.id, { method: 'DELETE' }); load() } catch (e) { setNote(e.message) }
  }

  return (
    <div>
      <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>My jobs</h1>
      
      <div className="tab-bar">
        <div className="tab-item">Saved</div>
        <div className="tab-item active">Applied</div>
        <div className="tab-item">Interviews</div>
        <div className="tab-item">Archived</div>
      </div>

      {note && <div className="alert">{note}</div>}
      
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ color: 'var(--mut)', marginBottom: '15px' }}>Last 14 days</h4>
        
        {apps === null ? <div className="card skel" /> : apps.length === 0 ?
          <div className="card empty">You have not applied to any jobs yet. <Link className="link" to="/jobs">Browse jobs ?</Link></div> :
          apps.map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--line)', padding: '20px 0', alignItems: 'flex-start' }}>
              <Avatar name={a.company_name} />
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>{a.job_title}</h3>
                <p style={{ margin: 0, color: 'var(--mut)' }}>{a.company_name}</p>
                <p style={{ margin: '5px 0', color: 'var(--mut)', fontSize: '13px' }}>Applied on {timeAgo(a.created_at)}</p>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <span className={'status s-' + a.status} style={{ display: 'inline-block', marginBottom: '10px' }}>{a.status}</span>
                <br/>
                <button className="btn btn-outline sm" onClick={() => withdraw(a)}>Update status</button>
              </div>
            </div>
          ))}
      </div>
    </div>
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
