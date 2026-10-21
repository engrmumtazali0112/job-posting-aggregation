import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, payText, JOB_TYPES, WORKPLACES, timeAgo } from '../api'
import { useAuth } from '../auth.jsx'
import Icon from './Icon.jsx'

// SEO: JobPosting structured data for the job on screen
function useJobSchema(job) {
  useEffect(() => {
    if (!job) return
    const emp = job.source_type === 'employer'
    const data = {
      '@context': 'https://schema.org/', '@type': 'JobPosting', title: job.title, description: job.description || job.title,
      datePosted: new Date(/Z|[+-]\d\d:?\d\d$/.test(job.created_at) ? job.created_at : job.created_at + 'Z').toISOString(),
      hiringOrganization: { '@type': 'Organization', name: job.company_name },
      jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location || 'Pakistan', addressCountry: 'PK' } },
      directApply: emp,
    }
    if (job.workplace_type === 'remote') data.jobLocationType = 'TELECOMMUTE'
    const types = { full_time: 'FULL_TIME', part_time: 'PART_TIME', contract: 'CONTRACTOR', temporary: 'TEMPORARY', internship: 'INTERN' }
    if (types[job.job_type]) data.employmentType = types[job.job_type]
    if (job.salary_min || job.salary_max) {
      const unit = { hour: 'HOUR', day: 'DAY', week: 'WEEK', month: 'MONTH', year: 'YEAR' }[job.salary_period] || 'MONTH'
      data.baseSalary = { '@type': 'MonetaryAmount', currency: job.currency || 'PKR',
        value: { '@type': 'QuantitativeValue', minValue: job.salary_min || undefined, maxValue: job.salary_max || undefined, unitText: unit } }
    }
    let el = document.getElementById('jobposting-ld')
    if (!el) { el = document.createElement('script'); el.id = 'jobposting-ld'; el.type = 'application/ld+json'; document.head.appendChild(el) }
    el.textContent = JSON.stringify(data)
    return () => { document.getElementById('jobposting-ld')?.remove() }
  }, [job])
}

export default function JobPane({ job, full = false, saved, applied, onSave, onApplied, canSave }) {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const [f, setF] = useState({ cover_letter: '', resume_url: '' })
  const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false)
  useJobSchema(job)
  useEffect(() => { setShow(false); setMsg(null) }, [job?.id])
  if (!job) return <div className="pane"><div className="empty-split">Select a job to see the details.</div></div>

  const emp = job.source_type === 'employer'
  const seeker = user?.role === 'job_seeker'
  const pay = payText(job)

  const openApply = async () => {
    setShow(!show)
    if (!show && !f.resume_url && seeker) {
      try { const p = await api('/seeker/profile'); if (p.resume_url) setF((x) => ({ ...x, resume_url: p.resume_url })) } catch { /* optional */ }
    }
  }
  const apply = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      await api(`/seeker/jobs/${job.id}/apply`, { method: 'POST', body: { cover_letter: f.cover_letter || null, resume_url: f.resume_url || null } })
      onApplied?.(job.id); setShow(false); setMsg({ ok: true, t: 'Application sent. Track it under My jobs.' })
    } catch (x) { setMsg({ ok: false, t: x.message }) } finally { setBusy(false) }
  }
  const share = async () => {
    const url = `${location.origin}/jobs/${job.id}`
    try { await navigator.clipboard.writeText(url); setMsg({ ok: true, t: 'Link copied.' }) } catch { setMsg({ ok: false, t: url }) }
  }

  return (
    <div className={'pane' + (full ? ' full' : '')}>
      <h1>{job.title}</h1>
      {job.company_id
        ? <Link className="co-link" to={`/companies/${job.company_id}`}>{job.company_name}<Icon name="external" size={14} /></Link>
        : <div className="pl" style={{ margin: '8px 0 4px' }}>{job.company_name}</div>}
      <div className="pl">{job.location || 'Location not specified'}</div>
      <div className="pl">{[pay, emp ? JOB_TYPES[job.job_type] : null].filter(Boolean).join(' - ')}</div>

      <div className="pane-acts">
        {emp && seeker && !applied && <button className="btn btn-primary" onClick={openApply}>Apply now</button>}
        {emp && seeker && applied && <span className="status s-published">Applied ✓</span>}
        {emp && !user && <Link className="btn btn-primary" to="/login">Log in to apply</Link>}
        {emp && user && !seeker && <span className="muted">Sign in as a job seeker to apply.</span>}
        {job.apply_url && <a className={'btn ' + (emp ? 'btn-outline' : 'btn-primary')} href={job.apply_url} target="_blank" rel="noopener noreferrer">{emp ? 'Company website' : 'Apply now'} <Icon name="external" size={15} /></a>}
        {canSave && <button className={'sqbtn' + (saved ? ' on' : '')} onClick={() => onSave?.(job)} title={saved ? 'Saved' : 'Save job'}><Icon name="bookmark" fill={saved} /></button>}
        <button className="sqbtn" onClick={share} title="Copy link"><Icon name="share" /></button>
      </div>
      {msg && <div className={msg.ok ? 'alert ok' : 'alert'}>{msg.t}</div>}

      {show && (
        <form className="form apply-box" onSubmit={apply}>
          <label>Cover letter (optional)<textarea rows={6} maxLength={5000} value={f.cover_letter} onChange={(e) => setF({ ...f, cover_letter: e.target.value })} /></label>
          <label>Link to your resume<input value={f.resume_url} onChange={(e) => setF({ ...f, resume_url: e.target.value })} placeholder="https://" /></label>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send application'}</button>
        </form>
      )}

      <hr />
      <h2>Job details</h2>
      {pay && <div className="detail-row"><Icon name="cash" />{pay}</div>}
      {emp && <div className="detail-row"><Icon name="clock" />{JOB_TYPES[job.job_type] || job.job_type}</div>}
      <div className="detail-row"><Icon name="pin" />{job.location || 'Not specified'}{emp && job.workplace_type ? ' · ' + (WORKPLACES[job.workplace_type] || job.workplace_type) : ''}</div>
      <div className="detail-row muted" style={{ fontWeight: 400 }}>Posted {timeAgo(job.created_at)}</div>
      <hr />
      <h2>Full job description</h2>
      <div className="desc">{job.description || 'No description provided.'}</div>
      {!emp && <p className="note">This job was found on an external source. You will be taken to the original listing to apply.</p>}
    </div>
  )
}
