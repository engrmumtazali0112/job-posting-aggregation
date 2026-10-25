import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api, API, getToken, JOB_TYPES, STATUS_LABEL, shortDate, timeAgo } from '../api'
import { useAuth } from '../auth.jsx'
import Icon from '../components/Icon.jsx'
import JobCard from '../components/JobCard.jsx'
import { useOutside } from '../components/ui.jsx'

const LINKS = [['/my', 'dash', 'Dashboard', true], ['/my/applications', 'briefcase', 'My applications'],
  ['/my/saved', 'bookmark', 'Saved jobs'], ['/my/profile', 'user', 'Profile'], ['/messages', 'chat', 'Messages'], ['/notifications', 'bell', 'Notifications']]
const CRUMB = { '/my': 'Dashboard', '/my/applications': 'My applications', '/my/saved': 'Saved jobs', '/my/profile': 'Profile', '/messages': 'Messages', '/notifications': 'Notifications' }
const GROUP = { new: 'applied', reviewing: 'review', shortlisted: 'review', contacting: 'review', interviewing: 'interview', hired: 'accepted', rejected: 'rejected' }
const GROUP_LABEL = { applied: 'Applied', review: 'Under review', interview: 'Interview', accepted: 'Accepted', rejected: 'Not selected' }

/* ---------------- layout ---------------- */
export function Layout() {
  const { logout } = useAuth(); const nav = useNavigate(); const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [pathname])
  return (
    <div className="sk">
      <aside className={'sk-side' + (open ? ' open' : '')}>
        <div className="sk-title">Job seeker panel</div>
        {LINKS.map(([to, ic, label, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => 'sk-link' + (isActive ? ' on' : '')}><Icon name={ic} fill size={18} />{label}</NavLink>
        ))}
        <button className="sk-out" onClick={() => { logout(); nav('/') }}>Log out</button>
      </aside>
      {open && <div className="sk-backdrop" onClick={() => setOpen(false)} />}
      <section className="sk-main">
        <div className="sk-bar">
          <button className="sk-burger" onClick={() => setOpen(!open)} aria-expanded={open}>☰ Menu</button>
          <span className="muted">Dashboard</span>{pathname !== '/my' && <><span className="muted">›</span><strong>{CRUMB[pathname] || ''}</strong></>}
        </div>
        <Outlet />
      </section>
    </div>
  )
}

/* ---------------- ATS score + resume download ---------------- */
async function downloadResume() {
  let res
  try { res = await fetch(API + '/seeker/resume/generate', { headers: { Authorization: 'Bearer ' + getToken() } }) }
  catch { throw new Error('Cannot reach the server. Please try again.') }
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(typeof d.detail === 'string' ? d.detail : 'Could not create your resume. Please try again.') }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'Resume.docx'
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function DownloadResume({ cls = 'btn btn-light sm', label = 'Download Resume' }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const go = async () => { setBusy(true); setErr(''); try { await downloadResume() } catch (x) { setErr(x.message) } finally { setBusy(false) } }
  return <><button type="button" className={cls} disabled={busy} onClick={go} title="ATS-friendly Word document built from your profile">{busy ? 'Preparing…' : label}</button>{err && <div className="alert" style={{ marginTop: 8 }}>{err}</div>}</>
}

function AtsCard({ refreshKey = 0 }) {
  const [a, setA] = useState(null); const [err, setErr] = useState('')
  useEffect(() => { api('/seeker/resume/ats-score').then(setA).catch((e) => setErr(e.message)) }, [refreshKey])
  if (err) return <div className="alert">{err}</div>
  if (!a) return <div className="card skel" />
  return (
    <div className="card pad-card sk-block" id="sec-ats">
      <div className="sk-split"><div><h3>ATS resume score</h3><p className="muted">How easily recruiters' tracking software can read and rank your profile. {a.grade}.</p></div><div className="sk-pct">{a.score}%</div></div>
      <div className="sk-barfill" role="progressbar" aria-valuenow={a.score} aria-valuemin="0" aria-valuemax="100"><i style={{ width: a.score + '%' }} /></div>
      {a.tips.length > 0 && <>
        <h4>How to improve</h4>
        <ul className="sk-steps">{a.tips.map((t) => <li key={t.key}><Link to={'/my/profile?focus=' + t.focus}>{t.text}</Link></li>)}</ul></>}
      <div className="acts"><DownloadResume cls="btn btn-primary sm" label="Download ATS resume (.docx)" /></div>
    </div>
  )
}

const Pill = ({ s }) => <span className={'sk-pill p-' + (GROUP[s] || 'applied')}>{({ ...STATUS_LABEL, shortlisted: 'Shortlisted' })[s] || s}</span>

/* ---------------- dashboard ---------------- */
export function Dashboard() {
  const [d, setD] = useState(null); const [err, setErr] = useState('')
  useEffect(() => { api('/seeker/dashboard').then(setD).catch((e) => setErr(e.message)) }, [])
  if (err) return <div className="alert">{err}</div>
  if (!d) return <div className="card skel tall" />
  const { stats: s, completion: c } = d
  return (
    <>
      <div className="sk-banner">
        <div><h1>Welcome back, {d.name}!</h1><p>Track your job search progress and discover new opportunities.</p></div>
        <Link to="/jobs" className="btn btn-light">Browse jobs</Link>
      </div>

      <div className="card pad-card sk-block">
        <div className="sk-split"><div><h3>Profile completion</h3><p className="muted">Complete your profile so employers can find you.</p></div><div className="sk-pct">{c.percent}%</div></div>
        <div className="sk-barfill" role="progressbar" aria-valuenow={c.percent} aria-valuemin="0" aria-valuemax="100"><i style={{ width: c.percent + '%' }} /></div>
        {c.next.length > 0 && <>
          <h4>Next steps</h4>
          <ul className="sk-steps">{(c.steps ? c.steps.filter((x) => !x.done) : c.next.map((label) => ({ label, key: '' }))).slice(0, 3).map((x) => <li key={x.label}><Link to={'/my/profile' + (x.key ? '?focus=' + x.key : '')}>{x.label}</Link></li>)}</ul></>}
        {c.done.length > 0 && <div className="sk-tags">{c.done.map((t) => <span key={t} className="sk-tag ok">✓ {t.replace(/^(Add|Write) (your |a |the )?/, '')}</span>)}</div>}
      </div>

      <AtsCard />

      <div className="sk-stats">
        {[['Applications', s.total, 'Total applications', ''], ['Interviews', s.interview, 'Interview stage', 'interview'], ['Under review', s.review, 'Being reviewed', 'review'], ['Accepted', s.accepted, 'Offers received', 'accepted']].map(([l, n, sub, f]) => (
          <Link key={l} to={'/my/applications' + (f ? '?filter=' + f : '')} className="card sk-stat sk-statlink"><span>{l}</span><b>{n}</b><small className="muted">{sub}</small></Link>
        ))}
      </div>

      <div className="sk-grid">
        <div className="card pad-card">
          <div className="sk-split"><h3>Recent applications</h3><Link to="/my/applications" className="btn btn-outline sm">View all</Link></div>
          {d.recent.length === 0 ? <div className="sk-empty"><p>No applications yet</p><Link to="/jobs" className="btn btn-outline sm">Browse jobs</Link></div>
            : d.recent.map((a) => (
              <div key={a.id} className="sk-recent">
                <div><Link to={`/jobs/${a.job_id}`}><strong>{a.job_title}</strong></Link><div className="muted small">{a.company_name} · {timeAgo(a.created_at)}</div></div>
                <Pill s={a.status} />
              </div>))}
        </div>
        <div className="sk-col">
          <div className="card pad-card">
            <h3>Quick actions</h3>
            <div className="sk-actions">
              <Link to="/jobs">Browse jobs</Link><Link to="/my/saved">Saved jobs ({d.saved})</Link>
              <Link to="/my/applications">My applications</Link><Link to="/my/profile">Edit profile</Link>
            </div>
          </div>
          <div className="card pad-card">
            <h3>Application status</h3>
            {Object.entries(GROUP_LABEL).map(([k, l]) => <Link key={k} to={'/my/applications?filter=' + k} className="sk-line sk-linelink"><span><i className={'dot p-' + k} />{l}</span><b>{s[k]}</b></Link>)}
            <Link to="/my/applications" className="sk-line total sk-linelink"><span>Total</span><b>{s.total}</b></Link>
          </div>
          <div className="card pad-card">
            <h3>Tips</h3>
            <ul className="sk-tips">
              <li>Add the job titles you want. Your home page then shows jobs for you.</li>
              <li>A short summary and your skills help employers understand you quickly.</li>
              <li>Check Messages often. Employers reply there.</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}

/* ---------------- applications ---------------- */
const PER = 10
export function Applications() {
  const [items, setItems] = useState(null); const [err, setErr] = useState('')
  const [sp] = useSearchParams()
  const [q, setQ] = useState(''); const [filter, setFilter] = useState(sp.get('filter') || ''); const [page, setPage] = useState(0)
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' })
  const [sel, setSel] = useState([])
  const [cols, setCols] = useState({ company_name: true, location: true, created_at: true, status: true })
  const [colMenu, setColMenu] = useState(false)
  const colRef = useOutside(colMenu, () => setColMenu(false))
  const load = () => api('/seeker/applications').then((d) => { setItems(d); setSel([]) }).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    const s = { total: 0, applied: 0, review: 0, interview: 0, accepted: 0 }
    ;(items || []).filter((a) => !a.archived).forEach((a) => { s.total++; const g = GROUP[a.status]; if (g in s) s[g]++ })
    return s
  }, [items])

  const rows = useMemo(() => {
    let r = (items || []).filter((a) => (filter === 'archived' ? a.archived : !a.archived && (!filter || GROUP[a.status] === filter)))
    if (q.trim()) { const t = q.toLowerCase(); r = r.filter((a) => [a.job_title, a.company_name, a.location].some((v) => (v || '').toLowerCase().includes(t))) }
    const k = sort.key, m = sort.dir === 'asc' ? 1 : -1
    return [...r].sort((a, b) => (String(a[k] ?? '') < String(b[k] ?? '') ? -1 : String(a[k] ?? '') > String(b[k] ?? '') ? 1 : 0) * m)
  }, [items, q, filter, sort])

  const pages = Math.max(1, Math.ceil(rows.length / PER))
  const cur = Math.min(page, pages - 1)
  const slice = rows.slice(cur * PER, cur * PER + PER)
  const from = rows.length ? cur * PER + 1 : 0, to = Math.min(rows.length, cur * PER + PER)
  const allOn = slice.length > 0 && slice.every((a) => sel.includes(a.id))
  const toggle = (id) => setSel((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]))

  const th = (key, label) => cols[key] === false ? null : (
    <th><button className="sk-th" onClick={() => { setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' })); setPage(0) }}>
      {label} <span className="ap-sort" aria-hidden="true">{sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : '⇅'}</span></button></th>)
  const archive = async (a) => { try { await api(`/seeker/applications/${a.id}/archive?archived=${!a.archived}`, { method: 'POST' }); load() } catch (e) { setErr(e.message) } }
  const archiveSel = async () => {
    const mine = (items || []).filter((a) => sel.includes(a.id))
    try { await Promise.all(mine.map((a) => api(`/seeker/applications/${a.id}/archive?archived=${!a.archived}`, { method: 'POST' }))); load() } catch (e) { setErr(e.message) }
  }
  const withdraw = async (a) => {
    if (!window.confirm(`Withdraw your application for "${a.job_title}"? This cannot be undone.`)) return
    try { await api('/seeker/applications/' + a.id, { method: 'DELETE' }); load() } catch (e) { setErr(e.message) }
  }
  const COLS = [['company_name', 'Company'], ['location', 'Location'], ['created_at', 'Applied date'], ['status', 'Status']]
  const span = 3 + COLS.filter(([k]) => cols[k] !== false).length

  return (
    <>
      <h1 className="page-title">My Applications</h1>
      <p className="ap-sub">Track and manage all your job applications in one place</p>
      <div className="ap-stats">
        {[['Total Applications', stats.total, ''], ['Applied', stats.applied, 'blue'], ['Under Review', stats.review, 'amber'], ['Interviews', stats.interview, 'purple'], ['Accepted', stats.accepted, 'green']]
          .map(([l, n, c]) => <div key={l} className="ap-stat"><b className={c}>{n}</b><span>{l}</span></div>)}
      </div>

      <div className="ap-card">
        <h2>Applications</h2>
        <p className="ap-sub2">A list of all your job applications with status and details</p>
        <div className="ap-tools">
          <label className="ap-search"><Icon name="search" size={18} />
            <input placeholder="Search applications..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} aria-label="Search applications" /></label>
          <label className="ap-select"><Icon name="filter" size={18} />
            <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }} aria-label="Filter by status">
              <option value="">All Status</option>{Object.entries(GROUP_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}<option value="archived">Archived</option>
            </select></label>
          <div className="ap-colwrap" ref={colRef}>
            <button type="button" className="ap-btn" onClick={() => setColMenu(!colMenu)} aria-haspopup="true" aria-expanded={colMenu}>Columns</button>
            {colMenu && <div className="ap-colmenu">
              {COLS.map(([k, l]) => <label key={k}><input type="checkbox" checked={cols[k] !== false} onChange={() => setCols({ ...cols, [k]: cols[k] === false })} />{l}</label>)}
            </div>}
          </div>
        </div>
        {err && <div className="alert" style={{ marginBottom: 12 }}>{err}</div>}
        {sel.length > 0 && <div className="ap-bulk"><span>{sel.length} selected</span><button className="btn btn-outline sm" onClick={archiveSel}>Archive / Unarchive</button></div>}

        <div className="ap-tablewrap"><table className="ap-table">
          <thead><tr>
            <th className="ap-chk"><input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSel(allOn ? [] : slice.map((a) => a.id))} /></th>
            {th('job_title', 'Job Title')}{th('company_name', 'Company')}{th('location', 'Location')}{th('created_at', 'Applied Date')}{th('status', 'Status')}<th>Actions</th>
          </tr></thead>
          <tbody>
            {items === null ? <tr><td colSpan={span} className="ap-empty">Loading…</td></tr>
              : slice.length === 0 ? <tr><td colSpan={span} className="ap-empty"><Icon name="doc" size={44} /><div>No applications found.</div><Link to="/jobs" className="btn btn-outline sm">Browse jobs</Link></td></tr>
              : slice.map((a) => (
                <tr key={a.id}>
                  <td className="ap-chk"><input type="checkbox" aria-label={'Select ' + a.job_title} checked={sel.includes(a.id)} onChange={() => toggle(a.id)} /></td>
                  <td><Link to={`/jobs/${a.job_id}`} className="ap-title">{a.job_title}</Link>{a.job_status !== 'published' && <small className="muted"> (no longer active)</small>}</td>
                  {cols.company_name !== false && <td>{a.company_id ? <Link to={`/companies/${a.company_id}`}>{a.company_name}</Link> : a.company_name}</td>}
                  {cols.location !== false && <td>{a.location || '–'}</td>}
                  {cols.created_at !== false && <td>{shortDate(a.created_at)}</td>}
                  {cols.status !== false && <td><Pill s={a.status} /></td>}
                  <td className="sk-rowacts"><Link to={`/messages?app=${a.id}`}>Message</Link>
                    <button onClick={() => archive(a)}>{a.archived ? 'Unarchive' : 'Archive'}</button>
                    <button className="danger" onClick={() => withdraw(a)}>Withdraw</button></td>
                </tr>))}
          </tbody>
        </table></div>

        <div className="ap-foot">
          <span className="ap-count">Showing {from} to {to} of {rows.length} results</span>
          <div className="ap-pg">
            <button aria-label="First page" disabled={cur === 0} onClick={() => setPage(0)}><Icon name="first" size={16} /></button>
            <button aria-label="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)}><Icon name="left" size={16} /></button>
            <span>Page {cur + 1} of {pages}</span>
            <button aria-label="Next page" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><Icon name="right" size={16} /></button>
            <button aria-label="Last page" disabled={cur >= pages - 1} onClick={() => setPage(pages - 1)}><Icon name="last" size={16} /></button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ---------------- saved jobs ---------------- */
export function Saved() {
  const [jobs, setJobs] = useState(null); const [err, setErr] = useState('')
  useEffect(() => { api('/seeker/saved').then(setJobs).catch((e) => setErr(e.message)) }, [])
  const remove = async (id) => { try { await api('/seeker/saved/' + id, { method: 'DELETE' }); setJobs((j) => j.filter((x) => x.id !== id)) } catch (e) { setErr(e.message) } }
  return (
    <>
      <h1 className="page-title">Saved jobs</h1>
      {err && <div className="alert">{err}</div>}
      {jobs === null ? <div className="card skel tall" /> : jobs.length === 0
        ? <div className="card empty">You have not saved any jobs yet. <Link className="link" to="/jobs">Browse jobs</Link></div>
        : <div className="joblist">{jobs.map((j) => (
          <div key={j.id} className="sk-saved"><JobCard job={j} /><button className="btn btn-ghost sm danger" onClick={() => remove(j.id)}>Remove from saved</button></div>))}</div>}
    </>
  )
}

/* ---------------- profile ---------------- */
const EMPTY = { full_name: '', phone: '', location: '', visible: true, resume_url: '', resume_name: '', job_titles: [], job_types: [],
  min_pay: null, min_pay_period: 'month', relocation: '', available_now: false, summary: '', skills: [], experience: [], education: [], languages: [], certifications: [],
  linkedin_url: '', github_url: '', portfolio_url: '', projects: [] }
// the profile form edits a project's tech stack as comma separated text; the API stores it as a list
const fromApi = (r) => ({ ...EMPTY, ...r, projects: (r.projects || []).map((x) => ({ ...x, tech_stack: (x.tech_stack || []).join(', ') })) })

function useDraft(initial, save) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const open = (v = initial) => { setDraft(v); setErr(''); setEditing(true) }
  const submit = async (e) => {
    e?.preventDefault(); setBusy(true); setErr('')
    try { await save(draft); setEditing(false) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return { editing, draft, setDraft, open, close: () => setEditing(false), submit, busy, err }
}

function Frame({ id, title, hint, d, hasData, addLabel, onAdd, view, form }) {
  return (
    <div id={id} className="card pad-card sk-sec">
      <div className="sk-split"><div><h3>{title}</h3><p className="muted">{hint}</p></div>
        {hasData && !d.editing && <button className="btn btn-outline sm" onClick={() => onAdd()}>Edit</button>}</div>
      {d.editing ? (
        <form onSubmit={d.submit} className="form">
          {form}
          {d.err && <div className="alert">{d.err}</div>}
          <div className="acts"><button className="btn btn-primary sm" disabled={d.busy}>{d.busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn btn-outline sm" onClick={d.close}>Cancel</button></div>
        </form>
      ) : hasData ? view : <button className="sk-add" onClick={() => onAdd()}>+ {addLabel}</button>}
    </div>
  )
}

function TextSection({ p, save }) {
  const d = useDraft(p.summary || '', (v) => save({ summary: v }))
  return <Frame id="sec-summary" title="Personal summary" hint="A short bio or introduction about yourself" d={d} hasData={!!p.summary} addLabel="Add summary" onAdd={() => d.open(p.summary || '')}
    view={<p className="sk-text">{p.summary}</p>}
    form={<textarea rows={5} maxLength={2000} value={d.draft} onChange={(e) => d.setDraft(e.target.value)} aria-label="Summary" />} />
}

function SkillsSection({ p, save }) {
  const d = useDraft(p.skills, (v) => save({ skills: v })); const [t, setT] = useState('')
  const add = () => {
    const v = t.trim(); if (!v) return
    if (!d.draft.some((x) => x.toLowerCase() === v.toLowerCase())) d.setDraft([...d.draft, v].slice(0, 40))
    setT('')
  }
  return <Frame id="sec-skills" title="Skills" hint="Your professional skills and expertise" d={d} hasData={p.skills.length > 0} addLabel="Add skills" onAdd={() => d.open(p.skills)}
    view={<div className="sk-tags">{p.skills.map((s) => <span key={s} className="sk-tag">{s}</span>)}</div>}
    form={<>
      <div className="sk-tags">{d.draft.map((s) => <span key={s} className="sk-tag">{s}<button type="button" aria-label={'Remove ' + s} onClick={() => d.setDraft(d.draft.filter((x) => x !== s))}>×</button></span>)}</div>
      <input value={t} placeholder="Type a skill and press Enter" maxLength={50} onChange={(e) => setT(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }} onBlur={add} />
    </>} />
}

function ListSection({ title, hint, addLabel, items, field, blank, fields, required, render, save }) {
  const d = useDraft(items, (v) => save({ [field]: v.filter((i) => (i[required] || '').trim()) }))
  const set = (i, k, v) => d.setDraft(d.draft.map((x, n) => (n === i ? { ...x, [k]: v } : x)))
  return <Frame id={'sec-' + field} title={title} hint={hint} d={d} hasData={items.length > 0} addLabel={addLabel} onAdd={() => d.open(items.length ? items : [blank])}
    view={<div className="sk-items">{items.map((it, i) => <div key={i} className="sk-item">{render(it)}</div>)}</div>}
    form={<>
      {d.draft.map((it, i) => (
        <div key={i} className="sk-edit">
          {fields.map(([k, label, kind]) => kind === 'check'
            ? <label key={k} className="chk"><input type="checkbox" checked={!!it[k]} onChange={(e) => set(i, k, e.target.checked)} /> {label}</label>
            : kind === 'area'
              ? <label key={k}>{label}<textarea rows={3} maxLength={1500} value={it[k] || ''} onChange={(e) => set(i, k, e.target.value)} /></label>
              : <label key={k}>{label}<input type={kind || 'text'} required={k === required} maxLength={150} value={it[k] || ''} disabled={k === 'end' && it.current} onChange={(e) => set(i, k, e.target.value)} /></label>)}
          <button type="button" className="btn btn-ghost sm danger" onClick={() => d.setDraft(d.draft.filter((_, n) => n !== i))}>Remove</button>
        </div>))}
      <button type="button" className="btn btn-outline sm" onClick={() => d.setDraft([...d.draft, blank])}>+ Add another</button>
    </>} />
}

const RESUME_MAX_MB = 5
// Multipart upload. api() sends JSON, so this one call uses fetch directly (same /api proxy as api()).
async function uploadResume(file) {
  const fd = new FormData(); fd.append('file', file)
  let res
  try { res = await fetch('/api/seeker/resume', { method: 'POST', headers: { Authorization: 'Bearer ' + getToken() }, body: fd }) }
  catch { throw new Error('Cannot reach the server. Please try again.') }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Upload failed. Please try again.')
  return data
}

const RESUME_HINT = {
  ok: ['ok', 'Your resume text is readable. Employers see how well it matches each job you apply to.'],
  image: ['warn', 'This is an image, so its text cannot be read for job matching. Upload a PDF for the best results.'],
  scanned: ['warn', 'This PDF looks scanned, so its text cannot be read. Upload a text-based PDF for job matching.'],
  link: ['warn', 'Links cannot be read for job matching. Upload your resume as a PDF to be matched against jobs.'],
  missing: ['warn', 'The resume file is missing on the server. Please upload it again.'],
}
function ResumeSection({ p, save }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const hint = p.resume_url ? RESUME_HINT[p.resume_state] : null
  const isLink = p.resume_url && !p.resume_url.includes('/api/files/')
  const d = useDraft({ resume_url: '', resume_name: '' }, (v) => save({ resume_url: v.resume_url.trim(), resume_name: v.resume_name.trim() }))
  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (f.size > RESUME_MAX_MB * 1024 * 1024) { setErr(`File is too large. Maximum size is ${RESUME_MAX_MB} MB.`); return }
    setBusy(true); setErr('')
    try { const r = await uploadResume(f); await save({ resume_url: r.resume_url, resume_name: r.resume_name }) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!window.confirm('Remove your resume?')) return
    setBusy(true); setErr('')
    try { await api('/seeker/resume', { method: 'DELETE' }); await save({ resume_url: '', resume_name: '' }) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div id="sec-resume" className="card pad-card sk-sec">
      <div className="sk-split"><div><h3>Resume / CV</h3><p className="muted">Upload a PDF, PNG or JPG (max {RESUME_MAX_MB} MB), or paste a link.</p></div></div>
      {p.resume_url && <a className="link" href={p.resume_url} target="_blank" rel="noopener noreferrer">{p.resume_name || 'View resume'} ↗</a>}
      {hint && <div className={'alert ' + (hint[0] === 'ok' ? 'ok' : 'warn')}>{hint[1]}</div>}
      <div className="acts">
        <label className="btn btn-primary sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? 'Working…' : p.resume_url && !isLink ? 'Replace file' : 'Upload file'}
          <input type="file" hidden disabled={busy} accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={pick} />
        </label>
        <button type="button" className="btn btn-outline sm" disabled={busy} onClick={() => d.open({ resume_url: isLink ? p.resume_url : '', resume_name: isLink ? p.resume_name || '' : '' })}>Use a link</button>
        {p.resume_url && <button type="button" className="btn btn-ghost sm danger" disabled={busy} onClick={remove}>Remove</button>}
      </div>
      {err && <div className="alert">{err}</div>}
      {d.editing && (
        <form onSubmit={d.submit} className="form">
          <label>Resume link<input type="url" required placeholder="https://" maxLength={500} value={d.draft.resume_url} onChange={(e) => d.setDraft({ ...d.draft, resume_url: e.target.value })} /></label>
          <label>Display name (optional)<input maxLength={200} value={d.draft.resume_name} onChange={(e) => d.setDraft({ ...d.draft, resume_name: e.target.value })} /></label>
          {d.err && <div className="alert">{d.err}</div>}
          <div className="acts"><button className="btn btn-primary sm" disabled={d.busy}>{d.busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn btn-outline sm" onClick={d.close}>Cancel</button></div>
        </form>
      )}
    </div>
  )
}

function LinksSection({ p, save }) {
  const init = { linkedin_url: p.linkedin_url || '', github_url: p.github_url || '', portfolio_url: p.portfolio_url || '' }
  const d = useDraft(init, (v) => save(v))
  const set = (k) => (e) => d.setDraft({ ...d.draft, [k]: e.target.value })
  const ROWS = [['github_url', 'GitHub'], ['linkedin_url', 'LinkedIn'], ['portfolio_url', 'Portfolio']]
  return <Frame id="sec-links" title="Links & proof of work" hint="Employers check your skills against your public GitHub and portfolio, not only what you type" d={d}
    hasData={ROWS.some(([k]) => p[k])} addLabel="Add GitHub, LinkedIn or portfolio" onAdd={() => d.open(init)}
    view={<div className="sk-items">{ROWS.filter(([k]) => p[k]).map(([k, l]) => <div key={k} className="sk-item"><span className="muted">{l}: </span><a className="link" href={p[k]} target="_blank" rel="noopener noreferrer">{p[k]}</a></div>)}</div>}
    form={<>
      <label>GitHub profile<input type="text" placeholder="https://github.com/username" maxLength={300} value={d.draft.github_url} onChange={set('github_url')} /></label>
      <label>LinkedIn profile<input type="text" placeholder="https://www.linkedin.com/in/your-name" maxLength={300} value={d.draft.linkedin_url} onChange={set('linkedin_url')} /></label>
      <label>Portfolio / website<input type="text" placeholder="https://your-site.com" maxLength={300} value={d.draft.portfolio_url} onChange={set('portfolio_url')} /></label>
    </>} />
}

/* ---------------- job alerts (emailed by the hourly job in scheduler.py) ---------------- */
function AlertsSection() {
  const [loaded, setLoaded] = useState(false); const [kw, setKw] = useState(''); const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState('')
  useEffect(() => {
    api('/seeker/alerts').then((r) => { setKw((r.keywords || []).join(', ')); setOn(!!r.is_active); setLoaded(true) }).catch((e) => setErr(e.message))
  }, [])
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(''); setOk('')
    try {
      const r = await api('/seeker/alerts', { method: 'PUT', body: { keywords: kw.split(',').map((s) => s.trim()).filter(Boolean), is_active: on } })
      setKw((r.keywords || []).join(', ')); setOn(!!r.is_active)
      setOk(r.is_active ? 'Job alerts are on. We will email you when new jobs match.' : 'Saved. Job alerts are off.')
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  if (!loaded) return err ? <div className="alert">{err}</div> : <div className="card skel" />
  return (
    <div id="sec-alerts" className="card pad-card sk-sec">
      <div className="sk-split"><div><h3>Job Alerts</h3><p className="muted">Get an email when new jobs match your keywords. We check every hour.</p></div></div>
      <form onSubmit={submit} className="form">
        <div className="avail">
          <strong id="alerts-lbl">Subscribe to Job Alerts</strong>
          <button type="button" role="switch" aria-checked={on} aria-labelledby="alerts-lbl" className={'tog' + (on ? ' on' : '')} onClick={() => { setOn(!on); setOk('') }} />
        </div>
        <label>Keywords (comma separated, e.g., React, Python)
          <input value={kw} maxLength={400} placeholder="React, Python" onChange={(e) => { setKw(e.target.value); setOk('') }} />
        </label>
        {err && <div className="alert">{err}</div>}
        {ok && <div className="alert ok" role="status">{ok}</div>}
        <div className="acts"><button className="btn btn-primary sm" disabled={busy}>{busy ? 'Saving…' : 'Save alerts'}</button></div>
      </form>
    </div>
  )
}

function BasicsForm({ p, save, onDone }) {
  const [f, setF] = useState({ full_name: p.full_name || '', phone: p.phone || '', location: p.location || '', titles: p.job_titles.join(', '),
    job_types: p.job_types, min_pay: p.min_pay ?? '', min_pay_period: p.min_pay_period || 'month', relocation: p.relocation || '', available_now: p.available_now, visible: p.visible })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const toggle = (k) => setF({ ...f, job_types: f.job_types.includes(k) ? f.job_types.filter((x) => x !== k) : [...f.job_types, k] })
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      await save({ full_name: f.full_name, phone: f.phone || null, location: f.location || null, job_titles: f.titles.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 15),
        job_types: f.job_types, min_pay: f.min_pay === '' ? null : Number(f.min_pay), min_pay_period: f.min_pay_period, relocation: f.relocation || null,
        available_now: f.available_now, visible: f.visible })
      onDone()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form id="sec-basics" className="card pad-card form sk-block" onSubmit={submit}>
      <h3>Edit profile</h3>
      <div className="sk-two">
        <label>Full name<input value={f.full_name} maxLength={150} onChange={s('full_name')} /></label>
        <label>Phone<input value={f.phone} maxLength={40} onChange={s('phone')} /></label>
        <label>Location<input value={f.location} maxLength={150} onChange={s('location')} placeholder="e.g. Rawalpindi" /></label>
        <label>Open to relocation<input value={f.relocation} maxLength={100} onChange={s('relocation')} /></label>
      </div>
      <label>Job titles you want (comma separated)<input value={f.titles} onChange={s('titles')} placeholder="e.g. Accountant, Data analyst" /></label>
      <div><div className="sk-lbl">Job types</div><div className="sk-checks">{Object.entries(JOB_TYPES).map(([k, l]) => <label key={k} className="chk"><input type="checkbox" checked={f.job_types.includes(k)} onChange={() => toggle(k)} /> {l}</label>)}</div></div>
      <div className="sk-two">
        <label>Minimum pay (Rs)<input type="number" min="0" value={f.min_pay} onChange={s('min_pay')} /></label>
        <label>Per<select value={f.min_pay_period} onChange={s('min_pay_period')}>{['hour', 'day', 'week', 'month', 'year'].map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <label className="chk"><input type="checkbox" checked={f.available_now} onChange={(e) => setF({ ...f, available_now: e.target.checked })} /> Available to start now</label>
      <label className="chk"><input type="checkbox" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} /> Employers can find my profile</label>
      {err && <div className="alert">{err}</div>}
      <div className="acts"><button className="btn btn-primary sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="btn btn-outline sm" onClick={onDone}>Cancel</button></div>
    </form>
  )
}

const month = (v) => { if (!v) return ''; const [y, m] = v.split('-'); return m ? new Date(y, m - 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : v }

export function Profile() {
  const { user, refresh } = useAuth()
  const [p, setP] = useState(null); const [err, setErr] = useState(''); const [editing, setEditing] = useState(false); const [ver, setVer] = useState(0)
  const [sp] = useSearchParams(); const focus = sp.get('focus')
  useEffect(() => { api('/seeker/profile').then((r) => setP(fromApi(r))).catch((e) => setErr(e.message)) }, [])
  // "Next steps" on the dashboard link here with ?focus=<step>: open the right form, scroll to it and highlight it
  useEffect(() => {
    if (!p || !focus) return
    const basics = focus === 'basics' || focus === 'titles'
    if (basics) setEditing(true)
    const t = setTimeout(() => {
      const el = document.getElementById(basics ? 'sec-basics' : 'sec-' + focus)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('sk-flash'); setTimeout(() => el.classList.remove('sk-flash'), 2000)
      if (!basics) el.querySelector('.sk-add')?.click()              // empty section: open its editor
      if (focus === 'titles') el.querySelector('input[placeholder^="e.g. Accountant"]')?.focus()
      if (focus === 'basics') el.querySelector('input[placeholder="e.g. Rawalpindi"]')?.focus()
    }, 80)
    return () => clearTimeout(t)
  }, [p === null, focus]) // eslint-disable-line
  if (err) return <div className="alert">{err}</div>
  if (!p) return <div className="card skel tall" />
  const save = async (patch) => {            // the API replaces the whole profile, so always send it in full
    const { id, email, ...rest } = { ...p, ...patch }
    const r = await api('/seeker/profile', { method: 'PUT', body: { ...rest, summary: rest.summary || null, resume_url: rest.resume_url || null, resume_name: rest.resume_name || null } })
    setP(fromApi(r)); setVer((v) => v + 1); refresh()
  }
  const name = p.full_name || user?.email
  return (
    <>
      <div className="sk-hero">
        <div className="sk-avatar" aria-hidden="true">{(name || '?')[0].toUpperCase()}</div>
        <div className="sk-hero-in">
          <h1>{name}</h1>
          <div>{p.email}</div>
          {p.phone && <div>{p.phone}</div>}
          {p.location && <div>{p.location}</div>}
          {p.job_titles.length > 0 && <div className="sk-tags">{p.job_titles.map((t) => <span key={t} className="sk-tag light">{t}</span>)}</div>}
          <div className="acts">
            <button className="btn btn-light sm" onClick={() => setEditing(!editing)}>{editing ? 'Close' : 'Edit profile'}</button>
            <DownloadResume />
          </div>
        </div>
      </div>
      {editing && <BasicsForm p={p} save={save} onDone={() => setEditing(false)} />}
      <AtsCard refreshKey={ver} />
      <AlertsSection />
      <div className="sk-cards">
        <TextSection p={p} save={save} />
        <SkillsSection p={p} save={save} />
        <LinksSection p={p} save={save} />
        <ListSection title="Projects" hint="Real work you built. Employers compare it with your GitHub" addLabel="Add a project" items={p.projects} field="projects" required="name"
          blank={{ name: '', tech_stack: '', description: '', url: '' }}
          fields={[['name', 'Project name'], ['tech_stack', 'Tech stack (comma separated, e.g. Python, React, Docker)'], ['description', 'Description', 'area'], ['url', 'Link (optional)', 'url']]}
          render={(x) => <><strong>{x.name}</strong>{x.tech_stack && <div className="muted small">{x.tech_stack}</div>}{x.description && <p className="sk-text">{x.description}</p>}{x.url && <a className="link" href={x.url} target="_blank" rel="noopener noreferrer">{x.url}</a>}</>} save={save} />
        <ListSection title="Career history" hint="Your previous job roles and experience" addLabel="Add experience" items={p.experience} field="experience" required="title"
          blank={{ title: '', company: '', start: '', end: '', current: false, description: '' }}
          fields={[['title', 'Job title'], ['company', 'Company'], ['start', 'Start', 'month'], ['end', 'End', 'month'], ['current', 'I currently work here', 'check'], ['description', 'Description', 'area']]}
          render={(x) => <><strong>{x.title}</strong><div>{x.company}</div><div className="muted small">{month(x.start)}{x.start && ' – '}{x.current ? 'Present' : month(x.end)}</div>{x.description && <p className="sk-text">{x.description}</p>}</>} save={save} />
        <ListSection title="Education" hint="Your academic qualifications" addLabel="Add education" items={p.education} field="education" required="degree"
          blank={{ degree: '', institution: '', year: '' }} fields={[['degree', 'Degree / qualification'], ['institution', 'Institution'], ['year', 'Year']]}
          render={(x) => <><strong>{x.degree}</strong><div>{x.institution}</div>{x.year && <div className="muted small">{x.year}</div>}</>} save={save} />
        <ListSection title="Languages" hint="Languages you speak" addLabel="Add languages" items={p.languages} field="languages" required="language"
          blank={{ language: '', level: '' }} fields={[['language', 'Language'], ['level', 'Level (e.g. Fluent)']]}
          render={(x) => <><strong>{x.language}</strong>{x.level && <span className="muted"> · {x.level}</span>}</>} save={save} />
        <ResumeSection p={p} save={save} />
      </div>
      <ListSection title="Licenses & certifications" hint="Licenses, certificates, memberships or accreditations" addLabel="Add certifications" items={p.certifications} field="certifications" required="name"
        blank={{ name: '', issuer: '', year: '' }} fields={[['name', 'Name'], ['issuer', 'Issued by'], ['year', 'Year']]}
        render={(x) => <><strong>{x.name}</strong>{x.issuer && <div>{x.issuer}</div>}{x.year && <div className="muted small">{x.year}</div>}</>} save={save} />
    </>
  )
}