import { useState } from 'react'
import { api, qs } from '../api'
import './SalaryInsights.css'

const rs = (n) => 'Rs ' + Number(n).toLocaleString('en-PK')
const EMPTY = { job_title: '', city: '', salary_min: '', salary_max: '', years_experience: '', company_domain: '' }

function Results({ data }) {
  if (data.count === 0) {
    return <div className="card empty si-empty">No salary reports for this role yet. Be the first to add one below.</div>
  }
  const scale = data.max || 1
  const pct = (n) => Math.max(1, Math.round((n / scale) * 100))
  const bars = [['Lowest', data.min, 'si-low'], ['Average', data.average, 'si-avg'], ['Highest', data.max, 'si-high']]
  return (
    <div className="card si-card">
      <div className="si-stats">
        <div><div className="si-big">{rs(data.average)}</div><div className="muted">average per month</div></div>
        <div><div className="si-big">{data.count}</div><div className="muted">report{data.count === 1 ? '' : 's'}</div></div>
      </div>
      {data.count < 3 && <p className="muted si-note">Based on very few reports, so treat this as a rough guide.</p>}

      <h3 className="si-h">Salary range (per month)</h3>
      {bars.map(([label, value, cls]) => (
        <div className="si-row" key={label}>
          <span className="si-label">{label}</span>
          <div className="si-track"><div className={'si-bar ' + cls} style={{ width: pct(value) + '%' }} /></div>
          <span className="si-val">{rs(value)}</span>
        </div>
      ))}

      <h3 className="si-h">Recent reports</h3>
      {data.reports.map((r, i) => (
        <div className="si-row" key={i}>
          <span className="si-label" title={`${r.job_title}, ${r.city}`}>{r.years_experience} yr{r.years_experience === 1 ? '' : 's'} exp</span>
          <div className="si-track">
            <div className="si-bar si-range" style={{ left: (r.salary_min / scale) * 100 + '%', width: Math.max(1, ((r.salary_max - r.salary_min) / scale) * 100) + '%' }} />
          </div>
          <span className="si-val">{rs(r.salary_min)} – {rs(r.salary_max)}</span>
        </div>
      ))}
    </div>
  )
}

export default function SalaryInsights() {
  const [title, setTitle] = useState('')
  const [city, setCity] = useState('')
  const [data, setData] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState('')

  const [form, setForm] = useState(EMPTY)
  const [sending, setSending] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [thanks, setThanks] = useState('')

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function search(e) {
    e?.preventDefault()
    setSearchErr(''); setData(null)
    if (title.trim().length < 2) { setSearchErr('Enter a job title to search.'); return }
    setSearching(true)
    try { setData(await api('/salary/insights?' + qs({ title: title.trim(), city: city.trim() }))) }
    catch (err) { setSearchErr(err.message) }
    finally { setSearching(false) }
  }

  async function submit(e) {
    e.preventDefault()
    setFormErr(''); setThanks('')
    setSending(true)
    try {
      const res = await api('/salary/report', {
        method: 'POST',
        body: {
          job_title: form.job_title, city: form.city, company_domain: form.company_domain,
          salary_min: Number(form.salary_min), salary_max: Number(form.salary_max), years_experience: Number(form.years_experience || 0),
        },
      })
      setThanks(res.message)
      setForm(EMPTY)
      if (title.trim().length >= 2) search()      // refresh the chart if a search is on screen
    } catch (err) { setFormErr(err.message) }
    finally { setSending(false) }
  }

  return (
    <div className="wrap pad si">
      <h1 className="page-title">Salary Insights</h1>
      <p className="muted si-intro">See what people really earn in Pakistan. Reports are anonymous: we never store your name, account or IP address.</p>

      <form className="card si-search" onSubmit={search}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Role, e.g. Software Engineer" aria-label="Role" />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional), e.g. Lahore" aria-label="City" />
        <button className="btn btn-primary" disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
      </form>
      {searchErr && <p className="si-err">{searchErr}</p>}
      {data && <Results data={data} />}

      <h2 className="si-sub">Submit anonymous salary</h2>
      <form className="card si-form" onSubmit={submit}>
        <label>Job title<input required minLength={2} value={form.job_title} onChange={set('job_title')} placeholder="Software Engineer" /></label>
        <label>City<input required minLength={2} value={form.city} onChange={set('city')} placeholder="Lahore" /></label>
        <label>Min monthly salary (PKR)<input required type="number" min="1000" value={form.salary_min} onChange={set('salary_min')} placeholder="150000" /></label>
        <label>Max monthly salary (PKR)<input required type="number" min="1000" value={form.salary_max} onChange={set('salary_max')} placeholder="200000" /></label>
        <label>Years of experience<input required type="number" min="0" max="50" value={form.years_experience} onChange={set('years_experience')} placeholder="3" /></label>
        <label>Company domain<input required value={form.company_domain} onChange={set('company_domain')} placeholder="acme.com" /></label>
        <div className="si-actions">
          <button className="btn btn-primary" disabled={sending}>{sending ? 'Submitting...' : 'Submit anonymously'}</button>
          {formErr && <span className="si-err">{formErr}</span>}
          {thanks && <span className="si-ok">{thanks}</span>}
        </div>
      </form>
    </div>
  )
}
