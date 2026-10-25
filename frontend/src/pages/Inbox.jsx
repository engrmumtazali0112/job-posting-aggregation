import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, timeAgo, shortDate, payText, JOB_TYPES, WORKPLACES } from '../api'
import { useAuth } from '../auth.jsx'
import Icon from '../components/Icon.jsx'

export function Notifications() {
  const { refreshCounts } = useAuth(); const nav = useNavigate()
  const [items, setItems] = useState(null); const [only, setOnly] = useState(false)
  const load = useCallback(() => api('/notifications').then(setItems).catch(() => setItems([])), [])
  useEffect(() => { load() }, [load])
  const open = async (n) => {
    if (!n.is_read) { await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {}); refreshCounts() }
    if (n.link) nav(n.link); else load()
  }
  const readAll = async () => { await api('/notifications/read', { method: 'POST' }); load(); refreshCounts() }
  const list = (items || []).filter((n) => !only || !n.is_read)
  return (
    <div className="notes">
      <h1 className="page-h" style={{ fontSize: 28 }}>Notifications</h1>
      <div className="fchips">
        <button className={'fchip' + (!only ? ' on' : '')} onClick={() => setOnly(false)}>All</button>
        <button className={'fchip' + (only ? ' on' : '')} onClick={() => setOnly(true)}>Unread</button>
        <span style={{ flex: 1 }} /><button className="btn btn-ghost sm" onClick={readAll}>Mark all read</button>
      </div>
      {items === null ? <div className="card skel" /> : list.length === 0 ? <div className="card empty">{only ? 'No unread notifications.' : "You're all caught up."}</div> :
        list.map((n) => (
          <button key={n.id} className={'note-i' + (n.is_read ? '' : ' unread')} style={{ width: '100%', border: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => open(n)}>
            <span className="note-ico"><Icon name="doc" size={20} /></span>
            <span>{n.text}<small>{timeAgo(n.created_at)}</small></span>
          </button>))}
    </div>
  )
}

const initials = (s = '') => s.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

/* Job + company details shown next to the chat */
function Details({ convo, employer, onClose }) {
  const j = convo.job
  if (!j) return null
  const pay = payText({ salary_min: j.salary_min, salary_max: j.salary_max, salary_period: j.salary_period })
  const jobLink = employer && j.status !== 'published' ? `/employer/dashboard/jobs/${j.id}/edit` : `/jobs/${j.id}`
  return (
    <div className="ms-details">
      <button className="ms-x" onClick={onClose} aria-label="Close details">✕</button>
      <h3>{j.title}</h3>
      <div className="ms-co">
        {j.company_id ? <Link className="link" to={'/companies/' + j.company_id}>{j.company_name}</Link> : j.company_name}
        <span className="ms-star">{j.company_rating || 0} ★</span>
      </div>
      {j.location && <div className="muted">{j.location}</div>}
      <dl>
        <div className="ms-row"><dt>Job type</dt><dd>{JOB_TYPES[j.job_type] || j.job_type}</dd></div>
        {j.workplace_type && <div className="ms-row"><dt>Workplace</dt><dd>{WORKPLACES[j.workplace_type] || j.workplace_type}</dd></div>}
        {pay && <div className="ms-row"><dt>Salary</dt><dd>{pay}</dd></div>}
        {employer && convo.applicant && (
          <div className="ms-row"><dt>Applicant</dt><dd>{convo.applicant.name}<br /><span className="muted">{convo.applicant.email}</span><br /><span className={'status s-' + convo.applicant.status}>{convo.applicant.status}</span></dd></div>)}
      </dl>
      <Link className="ms-fulljob" to={jobLink}>View full job description</Link>
      {employer && <Link className="btn btn-outline sm" to={`/employer/dashboard/candidates?job=${j.id}`}>All candidates for this job</Link>}
    </div>
  )
}

export function Messages() {
  const { user, refreshCounts } = useAuth()
  const employer = user?.role === 'employer'
  const [sp, setSp] = useSearchParams(); const app = sp.get('app')
  const [threads, setThreads] = useState(null); const [convo, setConvo] = useState(null)
  const [text, setText] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const wide = () => typeof window !== 'undefined' && window.innerWidth > 900
  const [details, setDetails] = useState(wide)          // job / company sidebar is open by default on desktop
  const box = useRef(null)

  const loadThreads = useCallback(() => api('/messages/threads').then(setThreads).catch(() => setThreads([])), [])
  const loadConvo = useCallback(() => {
    if (!app) { setConvo(null); return }
    api('/messages/' + app).then((c) => { setConvo(c); setErr(''); refreshCounts() }).catch((e) => { setConvo(null); setErr(e.message) })
  }, [app, refreshCounts])
  useEffect(() => { loadThreads() }, [loadThreads])
  useEffect(() => {
    setDetails(wide())
    loadConvo()
    const t = setInterval(() => { loadConvo(); loadThreads() }, 15000)   // simple polling
    return () => clearInterval(t)
  }, [loadConvo, loadThreads])
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [convo?.messages?.length])

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim() || !app) return
    setBusy(true); setErr('')
    try { await api('/messages/' + app, { method: 'POST', body: { body: text.trim() } }); setText(''); loadConvo(); loadThreads() }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  // a chat opened from the Candidates "Message" button has no messages yet, so add it to the list
  const rows = [...(threads || [])]
  if (app && convo && !rows.some((t) => String(t.application_id) === app)) {
    rows.unshift({ application_id: convo.application_id, title: convo.title, job_title: convo.job_title, last: '', last_at: null, unread: 0, last_from_me: false })
  }
  const active = !!(app && convo)

  return (
    <div className="ms-wrap">
      <div className={'ms' + (active ? ' has-active has-t' : '')}>
        <div className="ms-list">
          <div className="ms-lh">Messages</div>
          {threads === null ? <div className="ms-empty muted">Loading…</div> : rows.length === 0
            ? <div className="ms-empty muted">{employer ? 'No conversations yet. Open Candidates and press Message on an applicant.' : 'No conversations yet. Employers will message you here after you apply.'}</div>
            : rows.map((t) => (
              <button key={t.application_id} className={'ms-item' + (String(t.application_id) === app ? ' on' : '')} onClick={() => setSp({ app: t.application_id })}>
                <span className="ms-av">{initials(t.title)}</span>
                <span className="ms-it">
                  <span className="ms-line"><b>{t.title}</b><small>{t.last_at ? shortDate(t.last_at) : ''}</small></span>
                  <span className="ms-sub">{t.job_title}</span>
                  <span className="ms-last">{t.last ? (t.last_from_me ? 'You: ' : '') + t.last : 'No messages yet'}</span>
                </span>
                {t.unread > 0 && <span className="badge ms-badge">{t.unread > 9 ? '9+' : t.unread}</span>}
              </button>))}
        </div>

        <div className="ms-chat">
          {!active ? (
            <div className="ms-welcome"><Icon name="chat" size={54} /><h3>Welcome to Messages</h3><p>{err || 'Select a conversation to view and respond.'}</p></div>
          ) : (
            <>
              <div className="ms-head">
                <button className="ms-back" onClick={() => setSp({})} aria-label="Back to conversations">‹</button>
                <span className="ms-av">{initials(convo.title)}</span>
                <span className="ms-ht"><b>{convo.title}</b><small className="muted">{convo.job_title}</small></span>
                <button className="btn btn-ghost sm ms-dbtn" onClick={() => setDetails(!details)}>{details ? 'Hide details' : 'Job details'}</button>
              </div>
              <div className="ms-body" ref={box}>
                {convo.messages.length === 0 && <div className="muted" style={{ margin: 'auto' }}>No messages yet. Say hello below.</div>}
                {convo.messages.map((m) => (
                  <div key={m.id} className={'ms-msg ' + (m.mine ? 'me' : 'them')}>{m.body}<div className="ms-time">{timeAgo(m.created_at)}</div></div>))}
              </div>
              {err && <div className="alert" style={{ margin: '0 14px' }}>{err}</div>}
              <form className="ms-compose" onSubmit={send}>
                <textarea rows={2} value={text} maxLength={3000} onChange={(e) => setText(e.target.value)} placeholder="Write your message…"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e) }} />
                <button className="btn btn-primary" disabled={busy || !text.trim()}>Send</button>
              </form>
            </>
          )}
        </div>

        {active && <div className={'ms-dwrap' + (details ? ' show' : '')}><Details convo={convo} employer={employer} onClose={() => setDetails(false)} /></div>}
      </div>
    </div>
  )
}
