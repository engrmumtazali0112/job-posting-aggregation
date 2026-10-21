import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import JobCard, { Avatar } from '../components/JobCard.jsx'
import Icon from '../components/Icon.jsx'
import { AppStatus, useOutside } from '../components/ui.jsx'
import { api, shortDate, JOB_TYPES } from '../api'
import { useAuth } from '../auth.jsx'

export const Layout = () => <div className="narrow"><Outlet /></div>

const TABS = [['saved', 'Saved'], ['applied', 'Applied'], ['interviews', 'Interviews'], ['archived', 'Archived']]
const DAY = 86400000
const asDate = (d) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(d) ? d : d + 'Z')

function RowMenu({ app, onArchive, onWithdraw }) {
  const [open, setOpen] = useState(false); const nav = useNavigate()
  const ref = useOutside(open, () => setOpen(false))
  return (
    <div className="dots" ref={ref}>
      <button className="btn btn-outline sm" onClick={() => setOpen(!open)}>Update status</button>
      {open && (
        <div className="dmenu">
          {app.source_type === 'employer' && <button onClick={() => nav('/messages?app=' + app.id)}>Message employer</button>}
          <button onClick={() => { setOpen(false); onArchive(app) }}>{app.archived ? 'Move back to Applied' : 'Archive'}</button>
          <button style={{ color: 'var(--bad)' }} onClick={() => { setOpen(false); onWithdraw(app) }}>Withdraw application</button>
        </div>
      )}
    </div>
  )
}

export function MyJobs() {
  const [sp, setSp] = useSearchParams()
  const tab = TABS.some(([k]) => k === sp.get('tab')) ? sp.get('tab') : 'applied'
  const [apps, setApps] = useState(null); const [saved, setSaved] = useState(null)
  const [sum, setSum] = useState({}); const [note, setNote] = useState('')

  const load = useCallback(() => {
    api('/seeker/applications').then(setApps).catch((e) => setNote(e.message))
    api('/seeker/saved').then(setSaved).catch(() => setSaved([]))
    api('/seeker/summary').then(setSum).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  const archive = async (a) => { try { await api(`/seeker/applications/${a.id}/archive?archived=${!a.archived}`, { method: 'POST' }); load() } catch (e) { setNote(e.message) } }
  const withdraw = async (a) => {
    if (!window.confirm('Withdraw this application? This cannot be undone.')) return
    try { await api('/seeker/applications/' + a.id, { method: 'DELETE' }); load() } catch (e) { setNote(e.message) }
  }
  const unsave = async (j) => { await api('/seeker/saved/' + j.id, { method: 'DELETE' }); load() }

  const list = (apps || []).filter((a) => (tab === 'archived' ? a.archived : tab === 'interviews' ? !a.archived && ['interviewing', 'hired'].includes(a.status) : !a.archived))
  const recent = list.filter((a) => Date.now() - asDate(a.created_at) < 14 * DAY), older = list.filter((a) => !recent.includes(a))
  const row = (a) => (
    <div className="arow" key={a.id}>
      <Avatar name={a.company_name} />
      <div className="arow-main">
        <AppStatus s={a.status} />
        <h3><Link to={'/jobs/' + a.job_id}>{a.job_title}</Link></h3>
        <p>{a.company_id ? <Link className="link" to={'/companies/' + a.company_id}>{a.company_name}</Link> : a.company_name}</p>
        <p>{a.location}</p>
        <p className="small">Applied on {shortDate(a.created_at)}</p>
      </div>
      <div className="arow-side">
        <RowMenu app={a} onArchive={archive} onWithdraw={withdraw} />
        {a.job_status !== 'published' && <div className="closed-note"><Icon name="ban" size={16} />Job closed or expired</div>}
      </div>
    </div>
  )

  return (
    <div>
      <h1 className="page-h">My jobs</h1>
      <div className="mj-tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={'mj-tab' + (tab === k ? ' on' : '')} onClick={() => setSp({ tab: k })}>
            <small>{sum[k] > 99 ? '99+' : sum[k] ?? ''}</small>{label}
          </button>))}
      </div>
      {note && <div className="alert">{note}</div>}

      {tab === 'saved' ? (
        saved === null ? <div className="card skel" /> : saved.length === 0
          ? <div className="card empty">No saved jobs yet. Open a job and press the bookmark. <Link className="link" to="/jobs">Browse jobs →</Link></div>
          : <div className="joblist">{saved.map((j) => <JobCard key={j.id} job={j} saved onSave={unsave} />)}</div>
      ) : apps === null ? <div className="card skel" /> : list.length === 0 ? (
        <div className="card empty">{tab === 'applied' ? <>You have not applied to any jobs yet. <Link className="link" to="/jobs">Browse jobs →</Link></> : `Nothing in ${tab} yet.`}</div>
      ) : (
        <>
          {recent.length > 0 && <div className="group-h">Last 14 days</div>}{recent.map(row)}
          {older.length > 0 && <div className="group-h" style={{ marginTop: 22 }}>Earlier</div>}{older.map(row)}
        </>
      )}
    </div>
  )
}

/* ---------------- Profile ---------------- */
const RELOCATE = ['Willing to relocate anywhere', 'Willing to relocate within my country', 'Prefer to stay in my city', 'Not willing to relocate']

function Sec({ icon, title, view, editor, onSave, editable = true }) {
  const [edit, setEdit] = useState(false); const [d, setD] = useState(null); const [busy, setBusy] = useState(false)
  const start = () => { setD(editor.init()); setEdit(true) }
  const save = async () => { setBusy(true); try { await onSave(editor.out(d)); setEdit(false) } finally { setBusy(false) } }
  return (
    <div className="psec">
      <div className="psec-h"><span><Icon name={icon} size={18} />{title}</span>
        {editable && !edit && <button className="btn btn-ghost sm" onClick={start} aria-label={'Edit ' + title}><Icon name="pencil" size={18} /></button>}</div>
      {edit ? (
        <div className="pbox form">
          {editor.render(d, setD)}
          <div className="acts"><button className="btn btn-primary sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="btn btn-outline sm" onClick={() => setEdit(false)}>Cancel</button></div>
        </div>
      ) : <div className="pbox">{view}</div>}
    </div>
  )
}

export function Profile() {
  const { refresh } = useAuth()
  const [p, setP] = useState(null); const [tab, setTab] = useState('resume'); const [msg, setMsg] = useState(null); const [editHead, setEditHead] = useState(false)
  const [h, setH] = useState({})
  useEffect(() => { api('/seeker/profile').then(setP).catch((e) => setMsg({ ok: false, t: e.message })) }, [])
  if (!p) return msg ? <div className="alert">{msg.t}</div> : <div className="card skel" />

  const save = async (patch) => {
    setMsg(null)
    try { const r = await api('/seeker/profile', { method: 'PUT', body: { ...p, ...patch } }); setP(r); refresh() }
    catch (x) { setMsg({ ok: false, t: x.message }); throw x }
  }
  const initials = (p.full_name || p.email).split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <div className="prof">
      <div className="bigav">{initials}</div>
      {editHead ? (
        <div className="form" style={{ textAlign: 'left' }}>
          <label>Full name<input value={h.full_name} onChange={(e) => setH({ ...h, full_name: e.target.value })} /></label>
          <label>City<input value={h.location} onChange={(e) => setH({ ...h, location: e.target.value })} /></label>
          <label>Phone<input value={h.phone} onChange={(e) => setH({ ...h, phone: e.target.value })} /></label>
          <div className="acts"><button className="btn btn-primary sm" onClick={async () => { await save(h).then(() => setEditHead(false)).catch(() => {}) }}>Save</button>
            <button className="btn btn-outline sm" onClick={() => setEditHead(false)}>Cancel</button></div>
        </div>
      ) : (
        <>
          <h1>{p.full_name || 'Add your name'} <button className="btn btn-ghost sm" aria-label="Edit details" onClick={() => { setH({ full_name: p.full_name || '', location: p.location || '', phone: p.phone || '' }); setEditHead(true) }}><Icon name="pencil" size={18} /></button></h1>
          {p.location && <div className="sub3">{p.location}</div>}
          <div className="sub3">{[p.phone, p.email].filter(Boolean).join(' • ')}</div>
        </>
      )}
      <div><button className={'vis' + (p.visible ? '' : ' off')} onClick={() => save({ visible: !p.visible })}>
        <Icon name="eye" size={18} />{p.visible ? 'Employers can find you' : 'Hidden from employers'}</button></div>
      {msg && <div className={msg.ok ? 'alert ok' : 'alert'} style={{ marginTop: 14 }}>{msg.t}</div>}

      <div className="ptabs">
        <button className={'ptab' + (tab === 'resume' ? ' on' : '')} onClick={() => setTab('resume')}>Resume</button>
        <button className={'ptab' + (tab === 'prefs' ? ' on' : '')} onClick={() => setTab('prefs')}>Preferences</button>
      </div>

      {tab === 'resume' ? (
        <>
          <Sec icon="doc" title="Resume link" onSave={save}
            view={p.resume_url ? <div><strong>{p.resume_name || 'My resume'}</strong><div><a className="link pre" href={p.resume_url} target="_blank" rel="noopener noreferrer">{p.resume_url}</a></div></div>
              : <span className="muted">No resume added. Paste a link to your CV (Google Drive, LinkedIn, portfolio). It will be pre-filled when you apply.</span>}
            editor={{ init: () => ({ resume_name: p.resume_name || '', resume_url: p.resume_url || '' }),
              out: (d) => ({ resume_name: d.resume_name || null, resume_url: d.resume_url || null }),
              render: (d, set) => <>
                <label>Resume name<input value={d.resume_name} onChange={(e) => set({ ...d, resume_name: e.target.value })} placeholder="e.g. Full-stack CV 2026" /></label>
                <label>Resume link<input value={d.resume_url} onChange={(e) => set({ ...d, resume_url: e.target.value })} placeholder="https://" /></label></> }} />
        </>
      ) : (
        <>
          <div className="pbox soft" style={{ marginBottom: 20 }}><Icon name={p.visible ? 'eye' : 'eye'} size={18} />{p.visible ? 'Employers can see these preferences.' : "Employers can't see these preferences."}</div>
          <Sec icon="user" title="Job titles" onSave={save}
            view={p.job_titles.length ? <div className="pchips">{p.job_titles.map((t) => <span className="pchip" key={t}>{t}</span>)}</div> : <span className="muted">Add the roles you want. We use the first one to pick jobs for you.</span>}
            editor={{ init: () => ({ v: p.job_titles.join(', ') }), out: (d) => ({ job_titles: d.v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 15) }),
              render: (d, set) => <label>Job titles (separate with commas)<input value={d.v} onChange={(e) => set({ v: e.target.value })} placeholder="Frontend Developer, Python Developer" /></label> }} />
          <Sec icon="briefcase" title="Job types" onSave={save}
            view={p.job_types.length ? <div className="pchips">{p.job_types.map((t) => <span className="pchip" key={t}>{JOB_TYPES[t] || t}</span>)}</div> : <span className="muted">No job types selected.</span>}
            editor={{ init: () => ({ v: p.job_types }), out: (d) => ({ job_types: d.v }),
              render: (d, set) => <div className="opt-chips">{Object.entries(JOB_TYPES).map(([k, l]) => (
                <button type="button" key={k} className={'optc' + (d.v.includes(k) ? ' on' : '')} onClick={() => set({ v: d.v.includes(k) ? d.v.filter((x) => x !== k) : [...d.v, k] })}>{l}</button>))}</div> }} />
          <Sec icon="cash" title="Minimum base pay" onSave={save}
            view={p.min_pay ? `PKR ${p.min_pay.toLocaleString()} per ${p.min_pay_period}` : <span className="muted">Not set</span>}
            editor={{ init: () => ({ a: p.min_pay ?? '', b: p.min_pay_period }), out: (d) => ({ min_pay: d.a === '' ? null : Number(d.a), min_pay_period: d.b }),
              render: (d, set) => <div className="grid3" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <label>Amount (PKR)<input type="number" min={0} value={d.a} onChange={(e) => set({ ...d, a: e.target.value })} /></label>
                <label>Per<select value={d.b} onChange={(e) => set({ ...d, b: e.target.value })}>{['hour', 'day', 'week', 'month', 'year'].map((x) => <option key={x}>{x}</option>)}</select></label></div> }} />
          <Sec icon="pin" title="Relocation" onSave={save}
            view={p.relocation || <span className="muted">Not set</span>}
            editor={{ init: () => ({ v: p.relocation || '' }), out: (d) => ({ relocation: d.v || null }),
              render: (d, set) => <label>Relocation<select value={d.v} onChange={(e) => set({ v: e.target.value })}><option value="">Not set</option>{RELOCATE.map((x) => <option key={x}>{x}</option>)}</select></label> }} />
          <div className="psec"><div className="psec-h"><span><Icon name="clock" size={18} />Availability</span></div>
            <div className="pbox avail"><div><strong>I am available to start immediately</strong><div className="muted small">Let employers know that you can begin working straight away.</div></div>
              <button className={'tog' + (p.available_now ? ' on' : '')} role="switch" aria-checked={p.available_now} aria-label="Available immediately" onClick={() => save({ available_now: !p.available_now })} /></div></div>
        </>
      )}
    </div>
  )
}
