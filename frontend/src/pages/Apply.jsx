import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'

const NOTE = {
  ok: ['ok', 'Your resume is readable, so employers can see how well it matches this job.'],
  image: ['warn', 'Your resume is an image, so its text cannot be read. A PDF resume gives the most accurate job match.'],
  scanned: ['warn', 'Your PDF looks scanned, so its text cannot be read. Upload a text-based PDF for a better job match.'],
  link: ['warn', 'Your resume is a link. Links cannot be read, so upload a PDF in your profile for job matching.'],
  none: ['warn', 'You have no resume yet. Add one in your profile so employers can match you to this job.'],
  missing: ['warn', 'Your resume file is missing. Upload it again in your profile.'],
}

function Field({ q, value, onChange }) {
  if (q.type === 'yes_no') return (
    <div className="ap-choices">{['Yes', 'No'].map((v) => (
      <label key={v} className={'ap-opt' + (value === v ? ' on' : '')}><input type="radio" name={q.id} checked={value === v} onChange={() => onChange(v)} /> {v}</label>))}</div>)
  if (q.type === 'choice') return (
    <select value={value} onChange={(e) => onChange(e.target.value)}><option value="">Select…</option>{q.options.map((o) => <option key={o}>{o}</option>)}</select>)
  if (q.type === 'number') return <input type="number" min="0" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Enter a number" />
  return <textarea rows={3} maxLength={500} value={value} onChange={(e) => onChange(e.target.value)} />
}

export default function Apply() {
  const { id } = useParams()
  const [job, setJob] = useState(null); const [profile, setProfile] = useState(null); const [err, setErr] = useState('')
  const [cover, setCover] = useState(''); const [ans, setAns] = useState({}); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false)
  useEffect(() => {
    api('/jobs/' + id).then(setJob).catch((e) => setErr(e.message))
    api('/seeker/profile').then(setProfile).catch(() => {})
  }, [id])

  if (err && !job) return <div className="wrap pad"><div className="alert">{err}</div></div>
  if (!job) return <div className="wrap pad"><div className="card skel tall" /></div>
  if (job.source_type !== 'employer') return (
    <div className="wrap pad"><div className="card pad-card">This job is hosted on another website. <a className="link" href={job.apply_url} target="_blank" rel="noopener noreferrer">Apply there ↗</a></div></div>)
  if (done) return (
    <div className="wrap pad"><div className="card pad-card ap-done">
      <h2>Application sent ✓</h2><p className="muted">{job.company_name} will review your application. You will get a notification when its status changes.</p>
      <div className="acts"><Link className="btn btn-primary" to="/my/applications">My applications</Link><Link className="btn btn-outline" to="/jobs">Keep browsing</Link></div></div></div>)

  const set = (qid) => (v) => setAns({ ...ans, [qid]: v })
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    const missing = job.questions.find((q) => q.required && !String(ans[q.id] || '').trim())
    if (missing) { setErr('Please answer: ' + missing.text); return }
    setBusy(true)
    try {
      await api(`/seeker/jobs/${id}/apply`, { method: 'POST', body: { cover_letter: cover.trim() || null,
        answers: job.questions.map((q) => ({ id: q.id, answer: String(ans[q.id] || '').trim() })).filter((a) => a.answer) } })
      setDone(true)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const [tone, text] = NOTE[profile?.resume_state] || NOTE.none
  return (
    <div className="wrap pad">
      <form className="card pad-card form ap-form" onSubmit={submit}>
        <Link to={`/jobs/${id}`} className="link">‹ Back to job</Link>
        <h1 className="page-title" style={{ margin: '8px 0 2px' }}>Apply: {job.title}</h1>
        <p className="muted">{job.company_name}{job.location ? ' · ' + job.location : ''}</p>
        <div className={'alert ' + (tone === 'ok' ? 'ok' : 'warn')}>
          {text} {tone !== 'ok' && <Link className="link" to="/my/profile?focus=resume">Open profile</Link>}
        </div>
        {job.questions.length > 0 && <>
          <h3>Questions from the employer</h3>
          {job.questions.map((q) => (
            <label key={q.id} className="ap-q"><span>{q.text}{q.required && <b className="req"> *</b>}</span>
              <Field q={q} value={ans[q.id] || ''} onChange={set(q.id)} /></label>))}
        </>}
        <label>Cover letter (optional)<textarea rows={5} maxLength={5000} value={cover} onChange={(e) => setCover(e.target.value)} placeholder="Tell the employer why you are a good fit" /></label>
        {err && <div className="alert" role="alert">{err}</div>}
        <div className="acts"><button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit application'}</button>
          <Link className="btn btn-outline" to={`/jobs/${id}`}>Cancel</Link></div>
      </form>
    </div>
  )
}