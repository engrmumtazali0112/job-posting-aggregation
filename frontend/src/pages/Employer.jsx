import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PanelLayout from '../components/PanelLayout.jsx'
import JobForm, { toForm } from '../components/JobForm.jsx'
import { Badge, Pager, Stat } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { useAuth } from '../auth.jsx'
import { api, qs, timeAgo } from '../api'

export const Layout = () => (
  <PanelLayout title="Employer" items={[
    ['/employer/dashboard', 'Dashboard', true], ['/employer/dashboard/post', 'Post a job'], ['/employer/dashboard/jobs', 'My jobs'],
    ['/employer/dashboard/candidates', 'Candidates'], ['/messages', 'Messages'], ['/employer/dashboard/company', 'Company profile']]} />
)

/* ---------------- public landing page ---------------- */
const FAQ = [
  ['How much does it cost to post a job?', 'Posting is free during the launch period. There are no hidden fees.'],
  ['How long until my job goes live?', 'New employer jobs are reviewed by our team first. Approved jobs are published right away and shared on our social channels.'],
  ['Can I edit or close a job after posting?', 'Yes. From My jobs you can edit, pause, close or reopen any job. Edits to live jobs are re-checked before they show again.'],
  ['How do I receive applications?', 'Applicants apply on JobBoard. You see their cover letter and resume link in Candidates, can update their status and message them directly.'],
  ['What is a verified company?', 'Admins can verify your company website. A verified badge helps job seekers trust your listings.'],
]

export function LandingPage() {
  const { user } = useAuth()
  const cta = user?.role === 'employer' ? '/employer/dashboard/post' : '/register?role=employer'
  return (
    <div className="wrap">
      <section className="e-hero">
        <div>
          <h1>Hire the right people, <em style={{ fontStyle: 'normal', color: 'var(--p)' }}>faster</em></h1>
          <p>Post your job, reach job seekers across Pakistan, and manage every candidate in one place.</p>
          <div className="acts"><Link to={cta} className="btn btn-primary">Post a job</Link>
            {user?.role === 'employer' && <Link to="/employer/dashboard" className="btn btn-outline">Go to dashboard</Link>}</div>
        </div>
        <div className="img-ph">Hero image placeholder<br />(team or office photo)</div>
      </section>

      <section className="e-stats">
        {[['Free', 'to post your first jobs'], ['Reviewed', 'every employer job is checked'], ['Shared', 'new jobs go to our social channels']].map(([a, b]) => (
          <div className="card" key={a}><b>{a}</b><span className="muted">{b}</span></div>))}
      </section>

      <h2 style={{ fontSize: 32, textAlign: 'center' }}>How it works</h2>
      <section className="e-steps">
        {[['Create your account', 'Sign up with your company name and website in under a minute.'],
          ['Post your job', 'Add the title, pay, type and description with our simple step-by-step form.'],
          ['Hire', 'Review candidates, update their status and message them directly.']].map(([t, d], i) => (
          <div className="card e-step" key={t}><div className="n">{i + 1}</div><h3>{t}</h3><p className="muted">{d}</p></div>))}
      </section>

      <section className="e-feat"><div className="img-ph">Image placeholder<br />(candidate dashboard)</div>
        <div><h2 style={{ fontSize: 28, marginBottom: 10 }}>Manage every candidate</h2><p className="muted">Track applicants from new to hired. Candidates are notified automatically when you view their application or change their status.</p></div></section>
      <section className="e-feat rev"><div className="img-ph">Image placeholder<br />(company reviews)</div>
        <div><h2 style={{ fontSize: 28, marginBottom: 10 }}>Build your employer brand</h2><p className="muted">Your company page shows your open jobs and reviews from real job seekers, helping you attract the right people.</p></div></section>

      <h2 style={{ fontSize: 30, textAlign: 'center' }}>Frequently asked questions</h2>
      <section className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>

      <section className="e-cta"><h2>Ready to find your next hire?</h2><Link to={cta} className="btn">Post a job</Link></section>
    </div>
  )
}

/* ---------------- dashboard ---------------- */
const SL = ({ to, children }) => <Link to={to} className="stat-link">{children}</Link>
const D = '/employer/dashboard'
export function Dashboard() {
  const [d, setD] = useState(null); const [err, setErr] = useState('')
  useEffect(() => { api('/employer/dashboard').then(setD).catch((e) => setErr(e.message)) }, [])
  if (err) return <div className="alert">{err}</div>
  if (!d) return <div className="card skel" />
  return (
    <>
      <h1 className="page-title">{d.company.name}</h1>
      {!d.company.domain_verified && <div className="alert warn">Your company is not verified yet. Add your website in <Link className="link" to="/employer/dashboard/company">Company profile</Link>; an admin will verify it.</div>}
      {d.jobs.pending > 0 && <div className="alert warn">{d.jobs.pending} job(s) are waiting for admin approval.</div>}
      <h3 className="sub-h">Jobs</h3>
      <div className="stats">
        <SL to={D + '/jobs?status=published'}><Stat label="Live" value={d.jobs.published} /></SL>
        <SL to={D + '/jobs?status=pending'}><Stat label="Pending" value={d.jobs.pending} /></SL>
        <SL to={D + '/jobs?status=paused'}><Stat label="Paused" value={d.jobs.paused} /></SL>
        <SL to={D + '/jobs?status=closed'}><Stat label="Closed" value={d.jobs.closed} /></SL>
      </div>
      <h3 className="sub-h">Candidates</h3>
      <div className="stats">
        <SL to={D + '/candidates'}><Stat label="Total" value={d.applications.total} /></SL>
        <SL to={D + '/candidates?status=new'}><Stat label="New" value={d.applications.new} /></SL>
        <SL to={D + '/candidates?status=shortlisted'}><Stat label="Shortlisted" value={d.applications.shortlisted} /></SL>
        <SL to={D + '/candidates?status=interviewing'}><Stat label="Interviewing" value={d.applications.interviewing} /></SL>
        <SL to={D + '/candidates?status=hired'}><Stat label="Hired" value={d.applications.hired} /></SL>
      </div>
      <div className="acts" style={{ marginTop: 24 }}><Link className="btn btn-primary" to="/employer/dashboard/post">Post a job</Link><Link className="btn btn-outline" to="/employer/dashboard/candidates">View candidates</Link></div>
    </>
  )
}

export function PostJob() {
  const nav = useNavigate()
  return (
    <>
      <h1 className="page-title">Post a job</h1>
      <JobForm submitLabel="Submit job" onSubmit={async (body) => { await api('/employer/jobs', { method: 'POST', body }); nav('/employer/dashboard/jobs') }} />
    </>
  )
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
      <JobForm initial={toForm(job)} submitLabel="Save changes" onSubmit={async (body) => { await api('/employer/jobs/' + id, { method: 'PUT', body }); nav('/employer/dashboard/jobs') }} />
    </>
  )
}

/* ---------------- my jobs ---------------- */
const JOB_TABS = ['', 'published', 'pending', 'paused', 'closed', 'rejected']
export function MyJobs() {
  const [sp] = useSearchParams()
  const [status, setStatus] = useState(sp.get('status') || ''); const [q, setQ] = useState(''); const [jobs, setJobs] = useState(null); const [note, setNote] = useState('')
  const load = () => api('/employer/jobs?' + qs({ status, q })).then(setJobs).catch((e) => setNote(e.message))
  useEffect(() => { load() }, [status]) // eslint-disable-line
  const act = async (j, action) => { try { await api(`/employer/jobs/${j.id}/status`, { method: 'POST', body: { action } }); load() } catch (e) { setNote(e.message) } }
  const del = async (j) => { if (!window.confirm(`Delete "${j.title}" and its applications?`)) return; try { await api('/employer/jobs/' + j.id, { method: 'DELETE' }); load() } catch (e) { setNote(e.message) } }
  return (
    <>
      <div className="sec-head"><h1 className="page-title" style={{ margin: 0 }}>My jobs</h1><Link className="btn btn-primary sm" to="/employer/dashboard/post">Post a job</Link></div>
      <div className="tabs">{JOB_TABS.map((s) => <button key={s || 'all'} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s || 'all'}</button>)}</div>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load() }}><input placeholder="Search by title or location" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn btn-outline sm">Search</button></form>
      {note && <div className="alert">{note}</div>}
      {jobs === null ? <div className="card skel" /> : jobs.length === 0 ? <div className="card empty">No jobs here yet.</div> : jobs.map((j) => (
        <div className="card row" key={j.id}>
          <div className="grow"><strong>{j.title}</strong><span className="muted">{j.location} · posted {timeAgo(j.created_at)} · {j.applications_count} applicant{j.applications_count === 1 ? '' : 's'}</span></div>
          <Badge s={j.status} />
          <div className="acts wrap-acts">
            {j.applications_count > 0 && <Link className="btn btn-outline sm" to={`/employer/dashboard/candidates?job=${j.id}`}>Candidates</Link>}
            {j.status !== 'closed' && <Link className="btn btn-outline sm" to={`/employer/dashboard/jobs/${j.id}/edit`}>Edit</Link>}
            {j.status === 'published' && <button className="btn btn-ghost sm" onClick={() => act(j, 'pause')}>Pause</button>}
            {j.status === 'paused' && <button className="btn btn-ghost sm" onClick={() => act(j, 'resume')}>Resume</button>}
            {['published', 'paused', 'pending', 'rejected'].includes(j.status) && <button className="btn btn-ghost sm" onClick={() => act(j, 'close')}>Close</button>}
            {j.status === 'closed' && <button className="btn btn-ghost sm" onClick={() => act(j, 'reopen')}>Reopen</button>}
            <button className="btn btn-ghost sm danger" onClick={() => del(j)}>Delete</button>
          </div>
        </div>))}
    </>
  )
}

/* ---------------- candidates ---------------- */
const CSTAT = ['new', 'reviewing', 'shortlisted', 'contacting', 'interviewing', 'rejected', 'hired']
// the next hiring step offered on each card
const NEXT = { new: ['shortlisted', 'Shortlist'], reviewing: ['shortlisted', 'Shortlist'], shortlisted: ['interviewing', 'Invite to interview'],
  contacting: ['interviewing', 'Invite to interview'], interviewing: ['hired', 'Mark hired'] }

function MatchBadge({ c }) {
  if (!c.match_scored) return <span className="match m-none" title="This applicant has not listed any skills yet">No skills listed</span>
  return <span className={'match m-' + c.match_level} title="Share of this job's skills found on the applicant's profile">{c.match_level === 'top' ? '★ ' : ''}{c.match}% match</span>
}
const Chips = ({ ok = [], miss = [], max = 5 }) => (ok.length || miss.length) ? (
  <span className="chips">
    {ok.slice(0, max).map((t) => <i key={'o' + t} className="chip ok">{t}</i>)}
    {miss.slice(0, 3).map((t) => <i key={'m' + t} className="chip miss" title="Required by the job, not on the profile">{t}</i>)}
  </span>) : null

export function Candidates() {
  const nav = useNavigate(); const [sp] = useSearchParams()
  const [jobId, setJobId] = useState(sp.get('job') || ''); const [status, setStatus] = useState(sp.get('status') || '')
  const [minMatch, setMinMatch] = useState(sp.get('min') || ''); const [sort, setSort] = useState('match'); const [q, setQ] = useState('')
  const [data, setData] = useState(null); const [jobs, setJobs] = useState([]); const [open, setOpen] = useState(null)
  const [note, setNote] = useState(''); const [info, setInfo] = useState(''); const [sel, setSel] = useState([])
  const skippedTab = status === 'skipped'
  const load = () => api('/employer/candidates?' + qs({ job_id: jobId, status: skippedTab ? '' : status, skipped: skippedTab ? 'true' : '', min_match: minMatch, sort, q }))
    .then((d) => { setData(d); setSel([]) }).catch((e) => setNote(e.message))
  useEffect(() => { api('/employer/jobs').then(setJobs).catch(() => {}) }, [])
  useEffect(() => { load() }, [jobId, status, minMatch, sort]) // eslint-disable-line

  const patch = async (c, body) => {
    setNote(''); setInfo('')
    try { await api('/employer/candidates/' + c.id, { method: 'PATCH', body }); load() } catch (e) { setNote(e.message) }
  }
  const nameOf = (c) => c.applicant_name || c.applicant_email
  const reject = (c) => { if (window.confirm(`Reject ${nameOf(c)}? They will be notified.`)) patch(c, { status: 'rejected' }) }
  const bulk = async (action, ids = sel) => {
    if (!ids.length) return
    const text = { shortlist: `Shortlist ${ids.length} candidate(s)? They will be notified.`, reject: `Reject ${ids.length} candidate(s)? They will be notified.`,
      skip: `Skip ${ids.length} application(s)? They are hidden from this list and nobody is notified.`, restore: `Restore ${ids.length} application(s)?` }[action]
    if (!window.confirm(text)) return
    setNote(''); setInfo('')
    try { const r = await api('/employer/candidates/bulk', { method: 'POST', body: { ids, action } }); setInfo(`${r.affected} application(s) updated.`); load() }
    catch (e) { setNote(e.message) }
  }
  const toggle = (c) => {
    const o = open === c.id ? null : c.id
    setOpen(o)
    if (o && c.status === 'new' && !c.skipped) patch(c, { status: 'reviewing' })      // opening a new application marks it viewed and notifies the candidate
  }
  const toggleSel = (id) => setSel((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]))
  const items = data?.items || []
  const allOn = items.length > 0 && sel.length === items.length
  const topIds = items.filter((c) => c.match_level === 'top' && ['new', 'reviewing'].includes(c.status)).map((c) => c.id)

  return (
    <>
      <h1 className="page-title">Candidates</h1>
      <p className="muted" style={{ marginBottom: 12 }}>Applicants are ranked by how many of the job's skills they have. Shortlist the best, reject or skip the rest.</p>
      <div className="tabs">
        <button className={status === '' ? 'on' : ''} onClick={() => setStatus('')}>all {data ? `(${data.counts.all})` : ''}</button>
        {CSTAT.map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s} {data ? `(${data.counts[s]})` : ''}</button>)}
        <button className={skippedTab ? 'on' : ''} onClick={() => setStatus('skipped')}>skipped {data ? `(${data.counts.skipped})` : ''}</button>
      </div>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load() }}>
        <input placeholder="Search name, email or job" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={jobId} onChange={(e) => setJobId(e.target.value)}><option value="">All jobs</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select>
        <select value={minMatch} onChange={(e) => setMinMatch(e.target.value)} title="Hide weak matches"><option value="">Any match</option><option value="45">45% and up</option><option value="70">70% and up</option></select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="match">Best match first</option><option value="newest">Newest first</option></select>
        <button className="btn btn-outline sm">Search</button>
      </form>
      {note && <div className="alert">{note}</div>}
      {info && <div className="alert ok">{info}</div>}
      {!skippedTab && topIds.length > 0 && (
        <div className="alert ok top-banner">
          <span>★ <strong>{topIds.length}</strong> top match{topIds.length === 1 ? '' : 'es'} waiting for review.</span>
          <button className="btn btn-primary sm" onClick={() => bulk('shortlist', topIds)}>Shortlist top matches</button>
        </div>)}
      {items.length > 0 && (
        <div className="bulkbar">
          <label className="chk"><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? [] : items.map((c) => c.id))} /> Select all</label>
          {sel.length > 0 && <>
            <span className="muted">{sel.length} selected</span>
            {skippedTab ? <button className="btn btn-primary sm" onClick={() => bulk('restore')}>Restore</button> : <>
              <button className="btn btn-primary sm" onClick={() => bulk('shortlist')}>Shortlist</button>
              <button className="btn btn-outline sm" onClick={() => bulk('skip')}>Skip</button>
              <button className="btn btn-ghost sm danger" onClick={() => bulk('reject')}>Reject</button></>}
          </>}
        </div>)}
      {data === null ? <div className="card skel" /> : items.length === 0
        ? <div className="card empty">{skippedTab ? 'No skipped applications.' : 'No candidates here.'}</div>
        : items.map((c) => {
          const next = NEXT[c.status]
          return (
            <div className={'card cand' + (c.match_level === 'top' && !c.skipped ? ' cand-top' : '')} key={c.id}>
              <div className="row nob">
                <input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggleSel(c.id)} aria-label={'Select ' + nameOf(c)} />
                <div className="grow" onClick={() => toggle(c)} style={{ cursor: 'pointer' }}>
                  <strong>{nameOf(c)}</strong>
                  <span className="muted">{c.job_title}{c.applicant_title ? ' · ' + c.applicant_title : ''}{c.applicant_location ? ' · ' + c.applicant_location : ''} · {timeAgo(c.created_at)}</span>
                  <Chips ok={c.matched_skills} miss={c.missing_skills} />
                </div>
                <MatchBadge c={c} />
                <span className={'status s-' + c.status}>{c.status}</span>
                <span onClick={() => toggle(c)} style={{ cursor: 'pointer' }}><Icon name="chevron" size={18} /></span>
              </div>
              <div className="cand-quick">
                {c.skipped ? <button className="btn btn-primary sm" onClick={() => patch(c, { skipped: false })}>Restore</button> : <>
                  {next && <button className="btn btn-primary sm" onClick={() => patch(c, { status: next[0] })}>{next[1]}</button>}
                  <button className="btn btn-outline sm" onClick={() => nav('/messages?app=' + c.id)}>Message</button>
                  {!['rejected', 'hired'].includes(c.status) && <button className="btn btn-ghost sm danger" onClick={() => reject(c)}>Reject</button>}
                  <button className="btn btn-ghost sm" title="Hide without telling the applicant" onClick={() => patch(c, { skipped: true })}>Skip</button></>}
              </div>
              {open === c.id && (
                <div className="cand-more">
                  <div className="muted">{c.applicant_email}</div>
                  {c.match_scored && <div><strong>Skill match</strong>
                    <div className="chips big">{c.matched_skills.map((t) => <i key={'o' + t} className="chip ok">✓ {t}</i>)}{c.missing_skills.map((t) => <i key={'m' + t} className="chip miss">{t} (missing)</i>)}</div></div>}
                  {c.applicant_skills.length > 0 && <div><strong>Skills on profile</strong><div className="chips big">{c.applicant_skills.map((t) => <i key={t} className="chip">{t}</i>)}</div></div>}
                  <div><strong>Cover letter</strong><div className="pre">{c.cover_letter || '—'}</div></div>
                  <div><strong>Resume</strong><div>{c.resume_url ? <a className="link" href={c.resume_url} target="_blank" rel="noopener noreferrer">{c.resume_url.includes('/api/files/') ? 'Open uploaded resume ↗' : c.resume_url}</a> : '—'}</div></div>
                  <div className="cand-actions">
                    <label className="muted">Move to</label>
                    <select className="mini" value={c.status} onChange={(e) => patch(c, { status: e.target.value })}>{CSTAT.map((s) => <option key={s}>{s}</option>)}</select>
                  </div>
                </div>)}
            </div>)
        })}
    </>
  )
}

/* ---------------- company profile ---------------- */
export function CompanyProfile() {
  const { refresh } = useAuth()
  const [c, setC] = useState(null); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false)
  useEffect(() => { api('/employer/company').then(setC).catch((e) => setMsg({ ok: false, t: e.message })) }, [])
  if (!c) return msg ? <div className="alert">{msg.t}</div> : <div className="card skel" />
  const set = (k) => (e) => setC({ ...c, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null)
    try { const r = await api('/employer/company', { method: 'PUT', body: { name: c.name, website: c.website || null, description: c.description || null, logo_url: c.logo_url || null } }); setC(r); refresh(); setMsg({ ok: true, t: 'Company profile saved.' }) }
    catch (x) { setMsg({ ok: false, t: x.message }) } finally { setBusy(false) }
  }
  return (
    <>
      <h1 className="page-title">Company profile</h1>
      <form className="card pad-card form" onSubmit={save}>
        <label>Company name<input required minLength={2} value={c.name} onChange={set('name')} /></label>
        <label>Website<input value={c.website || ''} onChange={set('website')} placeholder="https://" /></label>
        <label>Logo URL<input value={c.logo_url || ''} onChange={set('logo_url')} placeholder="https://" /></label>
        <label>About the company<textarea rows={6} maxLength={5000} value={c.description || ''} onChange={set('description')} /></label>
        <div className="muted">Verification: {c.domain_verified ? 'Verified ✓' : 'Not verified. Changing your website resets verification.'}</div>
        {msg && <div className={msg.ok ? 'alert ok' : 'alert'}>{msg.t}</div>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
    </>
  )
}