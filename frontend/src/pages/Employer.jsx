import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PanelLayout from '../components/PanelLayout.jsx'
import JobForm, { toForm } from '../components/JobForm.jsx'
import { Badge, Stat } from '../components/ui.jsx'
import { api, qs, timeAgo, payText, JOB_TYPES } from '../api'

export const Layout = () => (
  <PanelLayout title="Employer" items={[
    ['/employer', 'Dashboard', true], ['/employer/post', 'Post a job'], ['/employer/jobs', 'My jobs'],
    ['/employer/candidates', 'Candidates'], ['/employer/company', 'Company profile']]} />
)

export function Dashboard() {
  const [d, setD] = useState(null); const [err, setErr] = useState('')
  useEffect(() => { api('/employer/dashboard').then(setD).catch((e) => setErr(e.message)) }, [])
  if (err) return <div className="alert">{err}</div>
  if (!d) return <div className="card skel" />
  const { jobs, applications: a } = d
  return (
    <>
      <div className="sec-head"><h1 className="page-title">{d.company.name}</h1><Link className="btn btn-primary" to="/employer/post">＋ Post a job</Link></div>
      {jobs.pending > 0 && <div className="alert warn">{jobs.pending} job(s) are waiting for admin approval.</div>}
      <h3 className="sub-h">Jobs</h3>
      <div className="stats">
        <Stat label="Live" value={jobs.published} /><Stat label="Pending approval" value={jobs.pending} />
        <Stat label="Paused" value={jobs.paused} /><Stat label="Closed" value={jobs.closed} />
      </div>
      <h3 className="sub-h">Applicants</h3>
      <div className="stats">
        <Stat label="Total" value={a.total} /><Stat label="New" value={a.new} />
        <Stat label="Interviewing" value={a.interviewing} /><Stat label="Hired" value={a.hired} />
      </div>
    </>
  )
}

export function PostJob() {
  const [done, setDone] = useState(null)
  const submit = async (p) => setDone(await api('/employer/jobs', { method: 'POST', body: p }))
  if (done) return (
    <div className="card pad-card">
      <h2>{done.status === 'pending' ? 'Job submitted' : 'Job published'}</h2>
      <p className="muted" style={{ margin: '8px 0 18px' }}>{done.status === 'pending' ? 'It will go live after admin approval.' : 'Your job is now live.'}</p>
      <div className="acts"><Link className="btn btn-primary" to="/employer/jobs">My jobs</Link>
        <button className="btn btn-outline" onClick={() => setDone(null)}>Post another</button></div>
    </div>
  )
  return <><h1 className="page-title">Post a job</h1><JobForm onSubmit={submit} /></>
}

export function EditJob() {
  const { id } = useParams(); const nav = useNavigate()
  const [job, setJob] = useState(null); const [err, setErr] = useState('')
  useEffect(() => { api('/employer/jobs/' + id).then(setJob).catch((e) => setErr(e.message)) }, [id])
  if (err) return <div className="alert">{err}</div>
  if (!job) return <div className="card skel" />
  return (
    <>
      <h1 className="page-title">Edit job</h1>
      <div className="alert warn">Editing a live job sends it back for admin approval when approval is required.</div>
      <JobForm initial={toForm(job)} submitLabel="Save changes"
        onSubmit={async (p) => { await api('/employer/jobs/' + id, { method: 'PUT', body: p }); nav('/employer/jobs') }} />
    </>
  )
}

export function MyJobs() {
  const [jobs, setJobs] = useState(null); const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [note, setNote] = useState('')
  const load = () => api('/employer/jobs?' + qs({ q, status })).then(setJobs).catch((e) => setNote(e.message))
  useEffect(() => { load() }, [status])
  const act = async (id, action) => {
    try { await api(`/employer/jobs/${id}/status`, { method: 'POST', body: { action } }); setNote(''); load() } catch (e) { setNote(e.message) }
  }
  const del = async (j) => {
    if (!window.confirm(`Delete "${j.title}"? Its applications will also be deleted.`)) return
    try { await api('/employer/jobs/' + j.id, { method: 'DELETE' }); load() } catch (e) { setNote(e.message) }
  }
  return (
    <>
      <div className="sec-head"><h1 className="page-title">My jobs</h1><Link className="btn btn-primary" to="/employer/post">＋ Post a job</Link></div>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load() }}>
        <input placeholder="Search title or location" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['published', 'pending', 'paused', 'closed', 'rejected'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-outline sm">Search</button>
      </form>
      {note && <div className="alert">{note}</div>}
      {jobs === null ? <div className="card skel" /> : jobs.length === 0 ? <div className="card empty">No jobs found.</div> :
        jobs.map((j) => (
          <div className="card row" key={j.id}>
            <div className="grow">
              <strong>{j.title}</strong>
              <div className="muted">{j.location || '—'} · {JOB_TYPES[j.job_type] || j.job_type} · {timeAgo(j.created_at)}</div>
              {payText(j) && <div className="muted">{payText(j)}</div>}
              <Link className="link small" to={`/employer/candidates?job=${j.id}`}>{j.applications_count} applicant(s)</Link>
            </div>
            <Badge s={j.status} />
            <div className="acts wrap-acts">
              {j.status !== 'closed' && <Link className="btn btn-outline sm" to={`/employer/jobs/${j.id}/edit`}>Edit</Link>}
              {j.status === 'published' && <button className="btn btn-outline sm" onClick={() => act(j.id, 'pause')}>Pause</button>}
              {j.status === 'paused' && <button className="btn btn-outline sm" onClick={() => act(j.id, 'resume')}>Resume</button>}
              {j.status === 'closed' ? <button className="btn btn-outline sm" onClick={() => act(j.id, 'reopen')}>Reopen</button>
                : <button className="btn btn-outline sm" onClick={() => act(j.id, 'close')}>Close</button>}
              <button className="btn btn-ghost sm danger" onClick={() => del(j)}>Delete</button>
            </div>
          </div>))}
    </>
  )
}

const TABS = ['all', 'new', 'reviewing', 'contacting', 'interviewing', 'rejected', 'hired']
export function Candidates() {
  const [sp] = useSearchParams(); const job = sp.get('job') || ''
  const [tab, setTab] = useState('all'); const [q, setQ] = useState(''); const [data, setData] = useState(null)
  const [open, setOpen] = useState(null); const [note, setNote] = useState('')
  const load = () => api('/employer/candidates?' + qs({ job_id: job, status: tab === 'all' ? '' : tab, q })).then(setData).catch((e) => setNote(e.message))
  useEffect(() => { load() }, [tab, job])
  const setStatus = async (id, status) => {
    try { await api('/employer/candidates/' + id, { method: 'PATCH', body: { status } }); load() } catch (e) { setNote(e.message) }
  }
  return (
    <>
      <h1 className="page-title">Candidates{job && <span className="muted"> · job #{job} <Link className="link small" to="/employer/candidates">(show all)</Link></span>}</h1>
      <div className="tabs">
        {TABS.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t} · {data?.counts?.[t] ?? 0}</button>)}
      </div>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load() }}>
        <input placeholder="Search name, email or job" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-outline sm">Search</button>
      </form>
      {note && <div className="alert">{note}</div>}
      {!data ? <div className="card skel" /> : data.items.length === 0 ? <div className="card empty">Candidates will appear here.</div> :
        data.items.map((c) => (
          <div className="card cand" key={c.id}>
            <div className="row nob">
              <div className="grow">
                <strong>{c.applicant_name || c.applicant_email}</strong>
                <div className="muted">{c.applicant_name ? c.applicant_email + ' · ' : ''}applied for {c.job_title} · {timeAgo(c.created_at)}</div>
              </div>
              <select className="mini" value={c.status} onChange={(e) => setStatus(c.id, e.target.value)}>
                {TABS.slice(1).map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="btn btn-ghost sm" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide' : 'Details'}</button>
            </div>
            {open === c.id && (
              <div className="cand-more">
                <div className="lbl">Cover letter</div><div className="desc">{c.cover_letter || 'None provided.'}</div>
                {c.resume_url && <p><a className="link" href={c.resume_url} target="_blank" rel="noopener noreferrer">Open resume ↗</a></p>}
                <p><a className="link" href={'mailto:' + c.applicant_email}>Email candidate</a></p>
              </div>)}
          </div>))}
    </>
  )
}

export function CompanyProfile() {
  const [f, setF] = useState(null); const [msg, setMsg] = useState(null)
  useEffect(() => { api('/employer/company').then((c) => setF({ name: c.name || '', website: c.website || '', description: c.description || '', logo_url: c.logo_url || '', verified: c.domain_verified })).catch((e) => setMsg({ ok: false, t: e.message })) }, [])
  if (!f) return msg ? <div className="alert">{msg.t}</div> : <div className="card skel" />
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault(); setMsg(null)
    try {
      const c = await api('/employer/company', { method: 'PUT', body: { name: f.name, website: f.website || null, description: f.description || null, logo_url: f.logo_url || null } })
      setF({ ...f, verified: c.domain_verified }); setMsg({ ok: true, t: 'Company profile saved.' })
    } catch (x) { setMsg({ ok: false, t: x.message }) }
  }
  return (
    <>
      <h1 className="page-title">Company profile</h1>
      <form className="card pad-card form" onSubmit={save}>
        <div>{f.verified ? <span className="status s-published">Verified</span> : <span className="status s-pending">Not verified</span>}</div>
        <label>Company name<input required minLength={2} value={f.name} onChange={set('name')} /></label>
        <label>Website<input value={f.website} onChange={set('website')} placeholder="https://" /></label>
        <label>Logo URL<input value={f.logo_url} onChange={set('logo_url')} placeholder="https://" /></label>
        <label>About the company<textarea rows={6} value={f.description} onChange={set('description')} /></label>
        {msg && <div className={msg.ok ? 'alert ok' : 'alert'}>{msg.t}</div>}
        <button className="btn btn-primary">Save</button>
      </form>
    </>
  )
}
