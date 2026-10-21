import { useState } from 'react'
import { JOB_TYPES, WORKPLACES, TIMELINES, payText } from '../api'

const STEPS = ['Basics', 'Details', 'Pay', 'Description', 'Review']
export const emptyJob = { title: '', workplace_type: 'in_person', location: '', job_type: 'full_time', openings: 1,
  hiring_timeline: '', salary_min: '', salary_max: '', salary_period: 'month', description: '', apply_url: '' }

export const toForm = (j) => ({ title: j.title, workplace_type: j.workplace_type || 'in_person', location: j.location || '',
  job_type: j.job_type || 'full_time', openings: j.openings || 1, hiring_timeline: j.hiring_timeline || '',
  salary_min: j.salary_min ?? '', salary_max: j.salary_max ?? '', salary_period: j.salary_period || 'month',
  description: j.description || '', apply_url: j.apply_url || '' })

export default function JobForm({ initial = emptyJob, submitLabel = 'Submit job', onSubmit }) {
  const [f, setF] = useState(initial)
  const [step, setStep] = useState(0)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const put = (k, v) => setF({ ...f, [k]: v })
  const num = (v) => (v === '' || v == null ? null : Number(v))

  const payload = () => ({
    title: f.title.trim(), workplace_type: f.workplace_type, location: f.location.trim(), job_type: f.job_type,
    openings: Number(f.openings) || 1, hiring_timeline: f.hiring_timeline || null,
    salary_min: num(f.salary_min), salary_max: num(f.salary_max), salary_period: f.salary_period,
    description: f.description, apply_url: f.apply_url.trim() || null,
  })

  const check = (s) => {
    if (s === 0) {
      if (f.title.trim().length < 3) return 'Enter a job title (at least 3 characters).'
      if (f.workplace_type !== 'remote' && !f.location.trim()) return 'Enter the job location.'
    }
    if (s === 2) {
      const a = num(f.salary_min), b = num(f.salary_max)
      if (a !== null && b !== null && a > b) return 'Minimum pay cannot be higher than maximum pay.'
    }
    if (s === 3 && f.description.trim().length < 20) return 'Description must be at least 20 characters.'
    return ''
  }
  const next = () => { const m = check(step); if (m) { setErr(m); return } setErr(''); setStep(step + 1) }
  const submit = async () => {
    for (let s = 0; s < 4; s++) { const m = check(s); if (m) { setErr(m); setStep(s); return } }
    setBusy(true); setErr('')
    try { await onSubmit(payload()) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <div className="card pad-card jobform">
      <div className="steps">
        {STEPS.map((s, i) => (
          <button key={s} type="button" className={'step' + (i === step ? ' on' : i < step ? ' done' : '')}
            onClick={() => i < step && setStep(i)}><span>{i + 1}</span>{s}</button>
        ))}
      </div>
      <div className="form">
        {step === 0 && <>
          <label>Job title *<input value={f.title} onChange={set('title')} placeholder="e.g. Senior React Developer" /></label>
          <div><div className="lbl">Job location type *</div>
            <div className="opt-chips">
              {Object.entries(WORKPLACES).map(([k, v]) => (
                <button type="button" key={k} className={'optc' + (f.workplace_type === k ? ' on' : '')} onClick={() => put('workplace_type', k)}>{v}</button>))}
            </div></div>
          <label>{f.workplace_type === 'remote' ? 'Location (optional)' : 'What is the job location? *'}
            <input value={f.location} onChange={set('location')} placeholder="e.g. Islamabad, Pakistan" /></label>
        </>}

        {step === 1 && <>
          <div><div className="lbl">Job type *</div>
            <div className="opt-chips">
              {Object.entries(JOB_TYPES).map(([k, v]) => (
                <button type="button" key={k} className={'optc' + (f.job_type === k ? ' on' : '')} onClick={() => put('job_type', k)}>{v}</button>))}
            </div></div>
          <label>Number of people to hire<input type="number" min={1} max={500} value={f.openings} onChange={set('openings')} /></label>
          <label>Hiring timeline
            <select value={f.hiring_timeline} onChange={set('hiring_timeline')}>
              <option value="">Not specified</option>
              {TIMELINES.map((t) => <option key={t}>{t}</option>)}
            </select></label>
          <label>Apply link (optional)<input value={f.apply_url} onChange={set('apply_url')} placeholder="https://" /></label>
        </>}

        {step === 2 && <>
          <div className="muted">Pay is shown in Pakistani rupees (PKR). Leave empty to hide pay.</div>
          <div className="grid3">
            <label>Minimum (Rs)<input type="number" min={0} value={f.salary_min} onChange={set('salary_min')} placeholder="45000" /></label>
            <label>Maximum (Rs)<input type="number" min={0} value={f.salary_max} onChange={set('salary_max')} placeholder="230000" /></label>
            <label>Rate
              <select value={f.salary_period} onChange={set('salary_period')}>
                {['hour', 'day', 'week', 'month', 'year'].map((p) => <option key={p} value={p}>per {p}</option>)}
              </select></label>
          </div>
        </>}

        {step === 3 && (
          <label>Job description * (min 20 characters)
            <textarea rows={12} value={f.description} onChange={set('description')} placeholder="Responsibilities, requirements, benefits…" /></label>
        )}

        {step === 4 && (
          <dl className="review">
            <dt>Job title</dt><dd>{f.title}</dd>
            <dt>Location</dt><dd>{WORKPLACES[f.workplace_type]}{f.location ? ' · ' + f.location : ''}</dd>
            <dt>Job type</dt><dd>{JOB_TYPES[f.job_type]}</dd>
            <dt>Openings</dt><dd>{f.openings}</dd>
            <dt>Timeline</dt><dd>{f.hiring_timeline || '—'}</dd>
            <dt>Pay</dt><dd>{payText({ salary_min: num(f.salary_min), salary_max: num(f.salary_max), salary_period: f.salary_period, currency: 'PKR' }) || 'Not shown'}</dd>
            <dt>Apply link</dt><dd>{f.apply_url || '—'}</dd>
            <dt>Description</dt><dd className="desc">{f.description}</dd>
          </dl>
        )}

        {err && <div className="alert">{err}</div>}
        <div className="form-nav">
          {step > 0 ? <button type="button" className="btn btn-outline" onClick={() => { setErr(''); setStep(step - 1) }}>? Back</button> : <span />}
          {step < 4 ? <button type="button" className="btn btn-primary" onClick={next}>Continue ?</button>
            : <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : submitLabel}</button>}
        </div>
      </div>
    </div>
  )
}
