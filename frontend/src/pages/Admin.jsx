import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PanelLayout from '../components/PanelLayout.jsx'
import JobForm, { toForm } from '../components/JobForm.jsx'
import { Badge, Pager, Stat } from '../components/ui.jsx'
import { api, apiList, qs, timeAgo } from '../api'

const L = 25
export const Layout = () => (
  <PanelLayout title="Admin" items={[
    ['/admin', 'Dashboard', true], ['/admin/jobs', 'Jobs'], ['/admin/users', 'Users'],
    ['/admin/companies', 'Companies'], ['/admin/settings', 'Sources & settings']]} />
)

export function Dashboard() {
  const [s, setS] = useState(null); const [err, setErr] = useState('')
  useEffect(() => { api('/admin/stats').then(setS).catch((e) => setErr(e.message)) }, [])
  if (err) return <div className="alert">{err}</div>
  if (!s) return <div className="card skel" />
  return (
    <>
      <h1 className="page-title">Admin dashboard</h1>
      {s.jobs.pending > 0 && <div className="alert warn">{s.jobs.pending} job(s) waiting for approval. <Link className="link" to="/admin/jobs">Review now →</Link></div>}
      <h3 className="sub-h">Users</h3>
      <div className="stats">
        <Stat label="Total users" value={s.users.total} /><Stat label="Employers" value={s.users.employers} />
        <Stat label="Job seekers" value={s.users.job_seekers} /><Stat label="New (7 days)" value={s.users.new_last_7_days} />
      </div>
      <h3 className="sub-h">Jobs</h3>
      <div className="stats">
        <Stat label="Total" value={s.jobs.total} /><Stat label="Live" value={s.jobs.published} />
        <Stat label="Pending" value={s.jobs.pending} /><Stat label="Rejected" value={s.jobs.rejected} />
        <Stat label="Aggregated" value={s.jobs.by_source?.aggregated ?? 0} /><Stat label="Employer" value={s.jobs.by_source?.employer ?? 0} />
      </div>
      <h3 className="sub-h">Other</h3>
      <div className="stats">
        <Stat label="Applications" value={s.applications.total} /><Stat label="Companies" value={s.companies.total} />
        <Stat label="Verified companies" value={s.companies.verified} /><Stat label="Approval required" value={s.require_approval ? 'Yes' : 'No'} />
      </div>
    </>
  )
}

export function Jobs() {
  const [status, setStatus] = useState('pending'); const [source, setSource] = useState(''); const [q, setQ] = useState(''); const [off, setOff] = useState(0)
  const [data, setData] = useState({ items: [], total: 0 }); const [sel, setSel] = useState([]); const [note, setNote] = useState('')
  const load = () => apiList('/admin/jobs?' + qs({ status, source, q, limit: L, offset: off })).then((d) => { setData(d); setSel([]) }).catch((e) => setNote(e.message))
  useEffect(() => { load() }, [status, source, off])
  const act = async (id, a) => { try { await api(`/admin/jobs/${id}/${a}`, { method: 'POST' }); load() } catch (e) { setNote(e.message) } }
  const del = async (j) => {
    if (!window.confirm(`Delete "${j.title}" permanently?`)) return
    try { await api('/admin/jobs/' + j.id, { method: 'DELETE' }); load() } catch (e) { setNote(e.message) }
  }
  const bulk = async (action) => {
    if (action === 'delete' && !window.confirm(`Delete ${sel.length} job(s) permanently?`)) return
    try { await api('/admin/jobs/bulk', { method: 'POST', body: { ids: sel, action } }); load() } catch (e) { setNote(e.message) }
  }
  const toggle = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])
  const allOn = data.items.length > 0 && sel.length === data.items.length
  return (
    <>
      <h1 className="page-title">Jobs</h1>
      <div className="tabs">
        {['pending', 'published', 'paused', 'closed', 'rejected', 'all'].map((t) => <button key={t} className={status === t ? 'on' : ''} onClick={() => { setStatus(t); setOff(0) }}>{t}</button>)}
      </div>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setOff(0); load() }}>
        <input placeholder="Search title, company or location" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={source} onChange={(e) => { setSource(e.target.value); setOff(0) }}>
          <option value="">All sources</option><option value="employer">Employer</option><option value="aggregated">Aggregated</option>
        </select>
        <button className="btn btn-outline sm">Search</button>
      </form>
      {note && <div className="alert">{note}</div>}
      <div className="bulkbar">
        <label className="chk"><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? [] : data.items.map((j) => j.id))} /> Select all</label>
        {sel.length > 0 && <>
          <span className="muted">{sel.length} selected</span>
          <button className="btn btn-primary sm" onClick={() => bulk('approve')}>Approve</button>
          <button className="btn btn-outline sm" onClick={() => bulk('reject')}>Reject</button>
          <button className="btn btn-ghost sm danger" onClick={() => bulk('delete')}>Delete</button></>}
      </div>
      {data.items.length === 0 ? <div className="card empty">No {status === 'all' ? '' : status} jobs.</div> :
        data.items.map((j) => (
          <div className="card row" key={j.id}>
            <input type="checkbox" checked={sel.includes(j.id)} onChange={() => toggle(j.id)} />
            <div className="grow">
              <strong>{j.title}</strong>
              <div className="muted">{j.company_name} {j.location ? '· ' + j.location : ''} · {timeAgo(j.created_at)} · <span className={'tag ' + (j.source_type === 'employer' ? 'tag-emp' : 'tag-agg')}>{j.source_type}</span></div>
            </div>
            <Badge s={j.status} />
            <div className="acts wrap-acts">
              {j.status !== 'published' && <button className="btn btn-primary sm" onClick={() => act(j.id, 'approve')}>Approve</button>}
              {j.status !== 'rejected' && <button className="btn btn-outline sm" onClick={() => act(j.id, 'reject')}>Reject</button>}
              <Link className="btn btn-outline sm" to={`/admin/jobs/${j.id}/edit`}>Edit</Link>
              <button className="btn btn-ghost sm danger" onClick={() => del(j)}>Delete</button>
            </div>
          </div>))}
      <Pager total={data.total} offset={off} limit={L} onChange={setOff} />
    </>
  )
}

export function EditJob() {
  const { id } = useParams(); const nav = useNavigate()
  const [job, setJob] = useState(null); const [err, setErr] = useState('')
  useEffect(() => { api('/admin/jobs/' + id).then(setJob).catch((e) => setErr(e.message)) }, [id])
  if (err) return <div className="alert">{err}</div>
  if (!job) return <div className="card skel" />
  return (
    <>
      <h1 className="page-title">Edit job #{job.id}</h1>
      <p className="muted" style={{ marginBottom: 14 }}>{job.company_name} · status: {job.status}</p>
      <JobForm initial={toForm(job)} submitLabel="Save changes"
        onSubmit={async (p) => { await api('/admin/jobs/' + id, { method: 'PUT', body: p }); nav('/admin/jobs') }} />
    </>
  )
}

export function Users() {
  const [role, setRole] = useState(''); const [q, setQ] = useState(''); const [off, setOff] = useState(0)
  const [data, setData] = useState({ items: [], total: 0 }); const [note, setNote] = useState('')
  const load = () => apiList('/admin/users?' + qs({ role, q, limit: L, offset: off })).then(setData).catch((e) => setNote(e.message))
  useEffect(() => { load() }, [role, off])
  const patch = async (id, body) => { try { await api('/admin/users/' + id, { method: 'PATCH', body }); setNote(''); load() } catch (e) { setNote(e.message) } }
  return (
    <>
      <h1 className="page-title">Users</h1>
      <div className="tabs">
        {[['', 'all'], ['employer', 'employers'], ['job_seeker', 'job seekers'], ['admin', 'admins']].map(([v, l]) => <button key={l} className={role === v ? 'on' : ''} onClick={() => { setRole(v); setOff(0) }}>{l}</button>)}
      </div>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setOff(0); load() }}>
        <input placeholder="Search email, name or company" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-outline sm">Search</button>
      </form>
      {note && <div className="alert">{note}</div>}
      {data.items.length === 0 ? <div className="card empty">No users found.</div> :
        data.items.map((u) => (
          <div className="card row" key={u.id}>
            <div className="grow">
              <strong>{u.full_name || u.email}</strong>
              <div className="muted">{u.full_name ? u.email + ' · ' : ''}{u.role.replace('_', ' ')}{u.company_name ? ' · ' + u.company_name : ''} · joined {timeAgo(u.created_at)}</div>
            </div>
            {!u.is_active && <span className="status s-rejected">deactivated</span>}
            {u.is_verified && <span className="status s-published">verified</span>}
            <div className="acts wrap-acts">
              <button className="btn btn-outline sm" onClick={() => patch(u.id, { is_verified: !u.is_verified })}>{u.is_verified ? 'Unverify' : 'Verify'}</button>
              <button className="btn btn-outline sm" onClick={() => patch(u.id, { is_active: !u.is_active })}>{u.is_active ? 'Deactivate' : 'Activate'}</button>
            </div>
          </div>))}
      <Pager total={data.total} offset={off} limit={L} onChange={setOff} />
    </>
  )
}

export function Companies() {
  const [q, setQ] = useState(''); const [off, setOff] = useState(0)
  const [data, setData] = useState({ items: [], total: 0 }); const [note, setNote] = useState('')
  const load = () => apiList('/admin/companies?' + qs({ q, limit: L, offset: off })).then(setData).catch((e) => setNote(e.message))
  useEffect(() => { load() }, [off])
  const verify = async (c) => { try { await api('/admin/companies/' + c.id, { method: 'PATCH', body: { domain_verified: !c.domain_verified } }); load() } catch (e) { setNote(e.message) } }
  return (
    <>
      <h1 className="page-title">Companies</h1>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setOff(0); load() }}>
        <input placeholder="Search company or owner email" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-outline sm">Search</button>
      </form>
      {note && <div className="alert">{note}</div>}
      {data.items.length === 0 ? <div className="card empty">No companies yet.</div> :
        data.items.map((c) => (
          <div className="card row" key={c.id}>
            <div className="grow">
              <strong>{c.name}</strong>
              <div className="muted">{c.owner_email}{c.website ? ' · ' + c.website : ''} · {c.jobs_count} job(s)</div>
            </div>
            <span className={'status ' + (c.domain_verified ? 's-published' : 's-pending')}>{c.domain_verified ? 'verified' : 'unverified'}</span>
            <button className="btn btn-outline sm" onClick={() => verify(c)}>{c.domain_verified ? 'Unverify' : 'Verify'}</button>
          </div>))}
      <Pager total={data.total} offset={off} limit={L} onChange={setOff} />
    </>
  )
}

export function Settings() {
  const [approval, setApproval] = useState(null); const [sources, setSources] = useState([]); const [note, setNote] = useState('')
  const load = () => {
    api('/admin/settings').then((s) => setApproval(s.require_approval)).catch((e) => setNote(e.message))
    api('/admin/sources').then(setSources).catch((e) => setNote(e.message))
  }
  useEffect(() => { load() }, [])
  const setAp = async (v) => { try { await api('/admin/settings', { method: 'PUT', body: { require_approval: v } }); setApproval(v) } catch (e) { setNote(e.message) } }
  const toggleSrc = async (s) => { try { await api('/admin/sources/' + s.id, { method: 'PATCH', body: { active: !s.active } }); load() } catch (e) { setNote(e.message) } }
  const ingest = async () => {
    setNote('Fetching…')
    try { setNote('Done: ' + JSON.stringify(await api('/admin/ingest/run', { method: 'POST' }))); load() } catch (e) { setNote(e.message) }
  }
  return (
    <>
      <h1 className="page-title">Sources & settings</h1>
      {note && <div className={note.startsWith('Done') || note === 'Fetching…' ? 'alert ok' : 'alert'}>{note}</div>}
      <div className="card row">
        <div className="grow"><strong>Require admin approval for employer jobs</strong>
          <div className="muted">When off, employer jobs go live immediately.</div></div>
        {approval !== null && <button className={'btn sm ' + (approval ? 'btn-primary' : 'btn-outline')} onClick={() => setAp(!approval)}>{approval ? 'On' : 'Off'}</button>}
      </div>
      <div className="sec-head" style={{ marginTop: 28 }}><h3>Job sources</h3><button className="btn btn-outline sm" onClick={ingest}>Run aggregation now</button></div>
      {sources.map((s) => (
        <div className="card row" key={s.id}>
          <div className="grow"><strong>{s.name}</strong><div className="muted">{s.type} · {s.jobs_count} job(s)</div></div>
          <button className={'btn sm ' + (s.active ? 'btn-primary' : 'btn-outline')} onClick={() => toggleSrc(s)}>{s.active ? 'Active' : 'Off'}</button>
        </div>))}
    </>
  )
}
