import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'

const MAX_MB = 5
const OK_EXT = /\.(pdf|png|jpe?g)$/i

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
  const [file, setFile] = useState(null); const fileRef = useRef(null)
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
      const fd = new FormData()
      if (cover.trim()) fd.append('cover_letter', cover.trim())
      fd.append('answers', JSON.stringify(job.questions.map((q) => ({ id: q.id, answer: String(ans[q.id] || '').trim() })).filter((a) => a.answer)))
      if (file) fd.append('resume', file)                                   // a new resume for this application only
      else if (profile?.resume_url) fd.append('resume_url', profile.resume_url)   // otherwise the profile resume
      await api(`/seeker/jobs/${id}/apply`, { method: 'POST', formData: fd })
      setDone(true)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const pick = (e) => {
    const f = e.target.files?.[0]; setErr('')
    if (!f) { setFile(null); return }
    if (!OK_EXT.test(f.name)) { setErr('Resume must be a PDF, PNG or JPG file.'); e.target.value = ''; setFile(null); return }
    if (f.size > MAX_MB * 1024 * 1024) { setErr(`Resume is too large. Maximum size is ${MAX_MB} MB.`); e.target.value = ''; setFile(null); return }
    setFile(f)
  }
  const clearFile = () => { setFile(null); if (fileRef.current) fileRef.current.value = '' }
  const [tone, text] = NOTE[profile?.resume_state] || NOTE.none
  return (
    <div className="wrap pad">
      <form className="card pad-card form ap-form" onSubmit={submit}>
        <Link to={`/jobs/${id}`} className="link">‹ Back to job</Link>
        <h1 className="page-title" style={{ margin: '8px 0 2px' }}>Apply: {job.title}</h1>
        <p className="muted">{job.company_name}{job.location ? ' · ' + job.location : ''}</p>
        {file
          ? <div className="alert ok">This file will be sent with this application only. Your profile resume is not changed. A text-based PDF gives the best job match.</div>
          : <div className={'alert ' + (tone === 'ok' ? 'ok' : 'warn')}>
              {text} {tone !== 'ok' && <Link className="link" to="/my/profile?focus=resume">Open profile</Link>}
            </div>}
        {job.questions.length > 0 && <>
          <h3>Questions from the employer</h3>
          {job.questions.map((q) => {
            const Wrap = q.type === 'yes_no' ? 'div' : 'label'          // Yes/No has its own labels; nesting labels can swallow clicks
            return (
              <Wrap key={q.id} className="ap-q"><span>{q.text}{q.required && <b className="req"> *</b>}</span>
                <Field q={q} value={ans[q.id] || ''} onChange={set(q.id)} /></Wrap>)
          })}
        </>}
        <label>Upload a resume for this job (optional)
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={pick} />
          <span className="muted small">PDF, PNG or JPG, up to {MAX_MB} MB.{profile?.resume_name && !file ? ` If you skip this, your profile resume (${profile.resume_name}) is used.` : ''}</span>
        </label>
        {file && <p className="muted small">Selected: <b>{file.name}</b> · <button type="button" className="link" onClick={clearFile}>Remove</button></p>}
        <label>Cover letter (optional)<textarea rows={5} maxLength={5000} value={cover} onChange={(e) => setCover(e.target.value)} placeholder="Tell the employer why you are a good fit" /></label>
        {err && <div className="alert" role="alert">{err}</div>}
        <div className="acts"><button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit application'}</button>
          <Link className="btn btn-outline" to={`/jobs/${id}`}>Cancel</Link></div>
      </form>
    </div>
  )
}