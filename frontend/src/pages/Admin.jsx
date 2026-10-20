import { useEffect, useState } from 'react'
import { api, timeAgo } from '../api'

export default function Admin() {
  const [tab, setTab] = useState('pending'); const [jobs, setJobs] = useState([]); const [note, setNote] = useState('')
  const load = () => api('/admin/jobs?status=' + tab).then(setJobs).catch((e) => setNote(e.message))
  useEffect(() => { load() }, [tab])
  const act = async (id, a) => { await api(`/admin/jobs/${id}/${a}`, { method: 'POST' }); load() }
  const ingest = async () => {
    setNote('Fetching…')
    try { setNote('Done: ' + JSON.stringify(await api('/admin/ingest/run', { method: 'POST' }))) } catch (e) { setNote(e.message) }
  }
  return (
    <div className="wrap pad">
      <div className="sec-head"><h1 className="page-title">Admin dashboard</h1><button className="btn btn-outline" onClick={ingest}>Run aggregation now</button></div>
      {note && <div className="alert ok">{note}</div>}
      <div className="seg left">
        {['pending', 'published', 'rejected'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {jobs.length === 0 ? <div className="card empty">No {tab} jobs.</div> :
        jobs.map((j) => (
          <div className="card row" key={j.id}>
            <div><strong>{j.title}</strong><div className="muted">{j.company_name || ''} {j.location ? '· ' + j.location : ''} · {timeAgo(j.created_at)}</div></div>
            <div className="acts">
              {tab !== 'published' && <button className="btn btn-primary sm" onClick={() => act(j.id, 'approve')}>Approve</button>}
              {tab !== 'rejected' && <button className="btn btn-outline sm" onClick={() => act(j.id, 'reject')}>Reject</button>}
            </div>
          </div>))}
    </div>
  )
}
