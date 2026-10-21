import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, timeAgo, payText, JOB_TYPES, WORKPLACES } from '../api'
import { useAuth } from '../auth.jsx'
import { Avatar } from '../components/JobCard.jsx'

export default function JobDetail() {
  const { id } = useParams(); const { user } = useAuth()
  const [job, setJob] = useState(null); const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false); const [applied, setApplied] = useState(false)
  const [show, setShow] = useState(false); const [f, setF] = useState({ cover_letter: '', resume_url: '' })
  const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false)
  const seeker = user?.role === 'job_seeker'

  useEffect(() => { api('/jobs/' + id).then(setJob).catch((e) => setErr(e.message)) }, [id])
  useEffect(() => {
    if (!seeker) return
    api('/seeker/saved/ids').then((ids) => setSaved(ids.includes(Number(id)))).catch(() => {})
    api('/seeker/applications').then((a) => setApplied(a.some((x) => x.job_id === Number(id)))).catch(() => {})
  }, [seeker, id])

  if (err) return <div className="wrap pad"><div className="card empty">{err}</div></div>
  if (!job) return <div className="wrap pad"><div className="card skel tall" /></div>
  const emp = job.source_type === 'employer'
  const pay = payText(job)

  const toggleSave = async () => {
    try { await api('/seeker/saved/' + id, { method: saved ? 'DELETE' : 'POST' }); setSaved(!saved) } catch (e) { setMsg({ ok: false, t: e.message }) }
  }
  const apply = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      await api(`/seeker/jobs/${id}/apply`, { method: 'POST', body: { cover_letter: f.cover_letter || null, resume_url: f.resume_url || null } })
      setApplied(true); setShow(false); setMsg({ ok: true, t: 'Application sent. Track it under My applications.' })
    } catch (x) { setMsg({ ok: false, t: x.message }) } finally { setBusy(false) }
  }

  return (
    <div className="wrap pad detail">
      <Link to="/jobs" className="link">← Back to jobs</Link>
      <div className="card detail-card">
        <div className="job-top">
          <Avatar name={job.company_name} />
          <div className="job-head"><h1>{job.title}</h1><p>{job.company_name}</p></div>
        </div>
        <div className="meta big">
          <span>📍 {job.location || 'Not specified'}</span>
          {emp && <span>🏢 {WORKPLACES[job.workplace_type] || job.workplace_type}</span>}
          {emp && <span>💼 {JOB_TYPES[job.job_type] || job.job_type}</span>}
          {pay && <span>💰 {pay}</span>}
          <span>🕒 Posted {timeAgo(job.created_at)}</span>
          <span className={'tag ' + (emp ? 'tag-emp' : 'tag-agg')}>{emp ? 'Employer' : 'Aggregated'}</span>
        </div>

        <div className="acts wrap-acts">
          {emp && seeker && !applied && <button className="btn btn-primary" onClick={() => setShow(!show)}>Apply on JobBoard</button>}
          {emp && seeker && applied && <span className="status s-published">Applied ✓</span>}
          {emp && !user && <Link className="btn btn-primary" to="/login">Log in to apply</Link>}
          {job.apply_url && <a className={'btn ' + (emp ? 'btn-outline' : 'btn-primary')} href={job.apply_url} target="_blank" rel="noopener noreferrer">{emp ? 'Employer website ↗' : 'Apply now ↗'}</a>}
          {seeker && <button className="btn btn-outline" onClick={toggleSave}>{saved ? '★ Saved' : '☆ Save job'}</button>}
        </div>
        {msg && <div className={msg.ok ? 'alert ok' : 'alert'} style={{ marginTop: 14 }}>{msg.t}</div>}

        {show && (
          <form className="form apply-box" onSubmit={apply}>
            <label>Cover letter (optional)<textarea rows={6} maxLength={5000} value={f.cover_letter} onChange={(e) => setF({ ...f, cover_letter: e.target.value })} /></label>
            <label>Link to your resume (Google Drive, LinkedIn, etc.)<input value={f.resume_url} onChange={(e) => setF({ ...f, resume_url: e.target.value })} placeholder="https://" /></label>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send application'}</button>
          </form>
        )}

        <h3>Job description</h3>
        <div className="desc">{job.description || 'No description provided.'}</div>
        {!emp && <p className="note">This job was found on an external source. You will be taken to the original listing to apply.</p>}
      </div>
    </div>
  )
}
