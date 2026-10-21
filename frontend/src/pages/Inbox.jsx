import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, timeAgo, shortDate } from '../api'
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

export function Messages() {
  const { refreshCounts } = useAuth()
  const [sp, setSp] = useSearchParams(); const app = sp.get('app')
  const [threads, setThreads] = useState(null); const [convo, setConvo] = useState(null)
  const [text, setText] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const box = useRef(null)

  const loadThreads = useCallback(() => api('/messages/threads').then(setThreads).catch(() => setThreads([])), [])
  const loadConvo = useCallback(() => {
    if (!app) { setConvo(null); return }
    api('/messages/' + app).then((c) => { setConvo(c); setErr(''); refreshCounts() }).catch((e) => { setConvo(null); setErr(e.message) })
  }, [app, refreshCounts])
  useEffect(() => { loadThreads() }, [loadThreads])
  useEffect(() => {
    loadConvo()
    const t = setInterval(() => { loadConvo(); loadThreads() }, 15000)   // simple polling
    return () => clearInterval(t)
  }, [loadConvo, loadThreads])
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [convo?.messages?.length])

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true); setErr('')
    try { await api('/messages/' + app, { method: 'POST', body: { body: text.trim() } }); setText(''); loadConvo(); loadThreads() }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <div className="msgs">
      <div>
        <div className="msgs-h">Messages <span className="online">● Online</span></div>
        <div className="tlist">
          {threads === null ? <div className="empty">Loading…</div> : threads.length === 0 && !app ? <div className="empty muted">No conversations yet. Message an employer from My jobs → Update status.</div> :
            threads.map((t) => (
              <button key={t.application_id} className={'titem' + (String(t.application_id) === app ? ' on' : '') + (t.unread ? ' unread' : '')} onClick={() => setSp({ app: t.application_id })}>
                <span className="sqav"><Icon name="building" size={20} /></span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="tt"><strong>{t.title}</strong><em>{shortDate(t.last_at)}</em></span>
                  <p>{t.last_from_me ? 'You: ' : ''}{t.last}</p>
                </span>
              </button>))}
        </div>
      </div>
      <div className="convo">
        {!app || !convo ? (
          <div className="welcome-pane"><Icon name="chat" size={54} /><h3>Welcome to Messages</h3><p>{err || 'Select a conversation to view and respond.'}</p></div>
        ) : (
          <>
            <div className="convo-h"><strong>{convo.title}</strong><small>{convo.job_title}</small></div>
            <div className="bubbles" ref={box}>
              {convo.messages.length === 0 && <div className="muted" style={{ margin: 'auto' }}>No messages yet. Say hello below.</div>}
              {convo.messages.map((m) => <div key={m.id} className={'bub' + (m.mine ? ' me' : '')}>{m.body}<small>{timeAgo(m.created_at)}</small></div>)}
            </div>
            {err && <div className="alert" style={{ margin: '0 14px' }}>{err}</div>}
            <form className="composer" onSubmit={send}>
              <textarea rows={2} value={text} maxLength={3000} onChange={(e) => setText(e.target.value)} placeholder="Write a message…"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e) }} />
              <button className="btn btn-primary" disabled={busy || !text.trim()}>Send</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
