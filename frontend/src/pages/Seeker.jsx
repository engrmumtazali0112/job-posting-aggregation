import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, JOB_TYPES, STATUS_LABEL, shortDate, timeAgo } from '../api'
import { useAuth } from '../auth.jsx'
import Icon from '../components/Icon.jsx'
import JobCard from '../components/JobCard.jsx'
import { Pager } from '../components/ui.jsx'

const LINKS = [['/my', 'dash', 'Dashboard', true], ['/my/applications', 'briefcase', 'My applications'],
  ['/my/saved', 'bookmark', 'Saved jobs'], ['/my/profile', 'user', 'Profile']]
const CRUMB = { '/my': 'Dashboard', '/my/applications': 'My applications', '/my/saved': 'Saved jobs', '/my/profile': 'Profile' }
const GROUP = { new: 'applied', reviewing: 'review', contacting: 'review', interviewing: 'interview', hired: 'accepted', rejected: 'rejected' }
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

const Pill = ({ s }) => <span className={'sk-pill p-' + (GROUP[s] || 'applied')}>{STATUS_LABEL[s] || s}</span>

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
          <ul className="sk-steps">{c.next.slice(0, 3).map((t) => <li key={t}><Link to="/my/profile">{t}</Link></li>)}</ul></>}
        {c.done.length > 0 && <div className="sk-tags">{c.done.map((t) => <span key={t} className="sk-tag ok">✓ {t.replace(/^(Add|Write) (your |a |the )?/, '')}</span>)}</div>}
      </div>

      <div className="sk-stats">
        {[['Applications', s.total, 'Total applications'], ['Interviews', s.interview, 'Interview stage'], ['Under review', s.review, 'Being reviewed'], ['Accepted', s.accepted, 'Offers received']].map(([l, n, sub]) => (
          <div key={l} className="card sk-stat"><span>{l}</span><b>{n}</b><small className="muted">{sub}</small></div>
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
            {Object.entries(GROUP_LABEL).map(([k, l]) => <div key={k} className="sk-line"><span><i className={'dot p-' + k} />{l}</span><b>{s[k]}</b></div>)}
            <div className="sk-line total"><span>Total</span><b>{s.total}</b></div>
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
  const [q, setQ] = useState(''); const [filter, setFilter] = useState(''); const [off, setOff] = useState(0)
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' })
  const load = () => api('/seeker/applications').then(setItems).catch((e) => setErr(e.message))
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

  const th = (key, label) => (
    <th><button className="sk-th" onClick={() => { setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' })); setOff(0) }}>
      {label}{sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</button></th>)
  const archive = async (a) => { try { await api(`/seeker/applications/${a.id}/archive?archived=${!a.archived}`, { method: 'POST' }); load() } catch (e) { setErr(e.message) } }
  const withdraw = async (a) => {
    if (!window.confirm(`Withdraw your application for "${a.job_title}"? This cannot be undone.`)) return
    try { await api('/seeker/applications/' + a.id, { method: 'DELETE' }); load() } catch (e) { setErr(e.message) }
  }

  return (
    <>
      <h1 className="page-title">My applications</h1>
      <p className="muted">Track and manage all your job applications in one place.</p>
      <div className="sk-stats five">
        {[['Total', stats.total], ['Applied', stats.applied], ['Under review', stats.review], ['Interviews', stats.interview], ['Accepted', stats.accepted]].map(([l, n]) => <div key={l} className="card sk-stat"><b>{n}</b><span>{l}</span></div>)}
      </div>
      <div className="card pad-card sk-block">
        <div className="sk-tools">
          <input placeholder="Search applications…" value={q} onChange={(e) => { setQ(e.target.value); setOff(0) }} aria-label="Search applications" />
          <select value={filter} onChange={(e) => { setFilter(e.target.value); setOff(0) }} aria-label="Filter by status">
            <option value="">All status</option>{Object.entries(GROUP_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}<option value="archived">Archived</option>
          </select>
        </div>
        {err && <div className="alert">{err}</div>}
        {items === null ? <div className="card skel" /> : rows.length === 0 ? <div className="sk-empty"><p>No applications found.</p><Link to="/jobs" className="btn btn-outline sm">Browse jobs</Link></div> : (
          <div className="sk-scroll"><table className="sk-table">
            <thead><tr>{th('job_title', 'Job title')}{th('company_name', 'Company')}{th('location', 'Location')}{th('created_at', 'Applied')}{th('status', 'Status')}<th>Actions</th></tr></thead>
            <tbody>{rows.slice(off, off + PER).map((a) => (
              <tr key={a.id}>
                <td><Link to={`/jobs/${a.job_id}`}>{a.job_title}</Link>{a.job_status !== 'published' && <small className="muted"> (no longer active)</small>}</td>
                <td>{a.company_id ? <Link to={`/companies/${a.company_id}`}>{a.company_name}</Link> : a.company_name}</td>
                <td>{a.location || '–'}</td><td>{shortDate(a.created_at)}</td><td><Pill s={a.status} /></td>
                <td className="sk-rowacts"><Link to={`/messages?app=${a.id}`}>Message</Link>
                  <button onClick={() => archive(a)}>{a.archived ? 'Unarchive' : 'Archive'}</button>
                  <button className="danger" onClick={() => withdraw(a)}>Withdraw</button></td>
              </tr>))}</tbody>
          </table></div>)}
        <Pager total={rows.length} offset={off} limit={PER} onChange={setOff} />
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
  min_pay: null, min_pay_period: 'month', relocation: '', available_now: false, summary: '', skills: [], experience: [], education: [], languages: [], certifications: [] }

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

function Frame({ title, hint, d, hasData, addLabel, onAdd, view, form }) {
  return (
    <div className="card pad-card sk-sec">
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
  return <Frame title="Personal summary" hint="A short bio or introduction about yourself" d={d} hasData={!!p.summary} addLabel="Add summary" onAdd={() => d.open(p.summary || '')}
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
  return <Frame title="Skills" hint="Your professional skills and expertise" d={d} hasData={p.skills.length > 0} addLabel="Add skills" onAdd={() => d.open(p.skills)}
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
  return <Frame title={title} hint={hint} d={d} hasData={items.length > 0} addLabel={addLabel} onAdd={() => d.open(items.length ? items : [blank])}
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

function ResumeSection({ p, save }) {
  const d = useDraft({ resume_url: p.resume_url || '', resume_name: p.resume_name || '' }, (v) => save(v))
  return <Frame title="Resume / CV" hint="Link to your resume (Google Drive, Dropbox, etc.)" d={d} hasData={!!p.resume_url} addLabel="Add resume link"
    onAdd={() => d.open({ resume_url: p.resume_url || '', resume_name: p.resume_name || '' })}
    view={<a className="link" href={p.resume_url} target="_blank" rel="noopener noreferrer">{p.resume_name || 'View resume'} ↗</a>}
    form={<>
      <label>Resume link<input type="url" placeholder="https://" maxLength={500} value={d.draft.resume_url} onChange={(e) => d.setDraft({ ...d.draft, resume_url: e.target.value })} /></label>
      <label>Display name (optional)<input maxLength={200} value={d.draft.resume_name} onChange={(e) => d.setDraft({ ...d.draft, resume_name: e.target.value })} /></label>
    </>} />
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
    <form className="card pad-card form sk-block" onSubmit={submit}>
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
  const [p, setP] = useState(null); const [err, setErr] = useState(''); const [editing, setEditing] = useState(false)
  useEffect(() => { api('/seeker/profile').then((r) => setP({ ...EMPTY, ...r })).catch((e) => setErr(e.message)) }, [])
  if (err) return <div className="alert">{err}</div>
  if (!p) return <div className="card skel tall" />
  const save = async (patch) => {            // the API replaces the whole profile, so always send it in full
    const { id, email, ...rest } = { ...p, ...patch }
    const r = await api('/seeker/profile', { method: 'PUT', body: { ...rest, summary: rest.summary || null, resume_url: rest.resume_url || null, resume_name: rest.resume_name || null } })
    setP({ ...EMPTY, ...r }); refresh()
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
          <button className="btn btn-light sm" onClick={() => setEditing(!editing)}>{editing ? 'Close' : 'Edit profile'}</button>
        </div>
      </div>
      {editing && <BasicsForm p={p} save={save} onDone={() => setEditing(false)} />}
      <div className="sk-two sk-cards">
        <TextSection p={p} save={save} />
        <SkillsSection p={p} save={save} />
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