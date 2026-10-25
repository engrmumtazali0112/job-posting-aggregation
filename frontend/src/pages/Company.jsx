import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, JOB_TYPES, timeAgo } from '../api'
import { useAuth } from '../auth.jsx'

const PERIOD = { hour: 'hour', day: 'day', week: 'week', month: 'month', year: 'year' }
const Stars = ({ value, size = 16 }) => (
  <span className="cp-stars" style={{ fontSize: size }} role="img" aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= Math.round(value) ? 'on' : ''}>★</i>)}
  </span>)
const pay = (j) => (!j.salary_min && !j.salary_max ? null : `Rs ${[j.salary_min, j.salary_max].filter(Boolean).map((n) => Number(n).toLocaleString()).join(' - ')} a ${PERIOD[j.salary_period] || 'month'}`)

function Distribution({ reviews }) {
  const n = reviews.length
  return (
    <div className="cp-dist">
      {[5, 4, 3, 2, 1].map((s) => {
        const c = reviews.filter((r) => r.rating === s).length
        return <div key={s} className="cp-bar"><span>{s} ★</span><i><b style={{ width: n ? (c / n) * 100 + '%' : 0 }} /></i><em>{c}</em></div>
      })}
    </div>)
}

function ReviewCard({ r }) {
  return (
    <article className="card pad-card cp-review">
      <div className="cp-rhead"><Stars value={r.rating} /><span className="muted">{timeAgo(r.created_at)}</span></div>
      <h4>{r.title}</h4>
      <div className="cp-pc"><div><strong className="pro">Pros</strong><p>{r.pros}</p></div><div><strong className="con">Cons</strong><p>{r.cons}</p></div></div>
    </article>)
}

function ReviewForm({ companyId, name, onDone }) {
  const [f, setF] = useState({ rating: 0, title: '', pros: '', cons: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [hover, setHover] = useState(0)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (!f.rating) { setErr('Please choose a star rating.'); return }
    setBusy(true)
    try { await api(`/companies/${companyId}/reviews`, { method: 'POST', body: { ...f, title: f.title.trim(), pros: f.pros.trim(), cons: f.cons.trim() } }); onDone() }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <form className="card pad-card form cp-form" onSubmit={submit} id="write-review">
      <h3>Review {name}</h3>
      <p className="muted">Your review is anonymous. Be honest and constructive.</p>
      <div className="cp-pick" role="radiogroup" aria-label="Overall rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={f.rating === i} aria-label={`${i} star${i > 1 ? 's' : ''}`}
            className={i <= (hover || f.rating) ? 'on' : ''} onMouseEnter={() => setHover(i)} onClick={() => setF({ ...f, rating: i })}>★</button>))}
        <span className="muted">{['Choose a rating', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][hover || f.rating]}</span>
      </div>
      <label>Review title<input required minLength={3} maxLength={150} value={f.title} onChange={set('title')} placeholder="Sum it up in one line" /></label>
      <label>Pros<textarea required minLength={10} rows={3} value={f.pros} onChange={set('pros')} placeholder="What is good about working here? (at least 10 characters)" /></label>
      <label>Cons<textarea required minLength={10} rows={3} value={f.cons} onChange={set('cons')} placeholder="What could be better? (at least 10 characters)" /></label>
      {err && <div className="alert" role="alert">{err}</div>}
      <div className="acts"><button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit review'}</button></div>
    </form>)
}

export default function Company() {
  const { id } = useParams(); const { user } = useAuth()
  const [sp, setSp] = useSearchParams(); const tab = sp.get('tab') || 'snapshot'
  const [co, setCo] = useState(null); const [reviews, setReviews] = useState([]); const [salaries, setSalaries] = useState([]); const [err, setErr] = useState('')
  const load = useCallback(() => Promise.all([api('/companies/' + id), api(`/companies/${id}/reviews`), api(`/companies/${id}/salaries`).catch(() => [])])
    .then(([c, r, s]) => { setCo(c); setReviews(r); setSalaries(s) }).catch((e) => setErr(e.message)), [id])
  useEffect(() => { setCo(null); load() }, [load])
  const go = (t) => setSp(t === 'snapshot' ? {} : { tab: t })

  if (err) return <div className="wrap pad"><div className="alert">{err}</div></div>
  if (!co) return <div className="wrap pad"><div className="card skel tall" /></div>
  const seeker = user?.role === 'job_seeker'
  const writeBtn = seeker ? <button className="btn btn-primary" onClick={() => { go('reviews'); setTimeout(() => document.getElementById('write-review')?.scrollIntoView({ behavior: 'smooth' }), 80) }}>Write a review</button>
    : !user ? <Link className="btn btn-primary" to="/login">Sign in to write a review</Link> : null
  const tabs = [['snapshot', 'Snapshot'], ['reviews', `Reviews (${reviews.length})`], ['salaries', `Salaries (${salaries.length})`], ['jobs', `Jobs (${co.active_jobs.length})`]]
  const empty = reviews.length === 0

  return (
    <div className="wrap pad cp">
      <nav className="muted cp-crumb"><Link to="/companies" className="link">Companies</Link> › {co.name}</nav>
      <header className="cp-head">
        <span className="cp-logo">{co.logo_url ? <img src={co.logo_url} alt="" /> : co.name[0].toUpperCase()}</span>
        <div className="cp-title">
          <h1>{co.name}</h1>
          <div className="cp-meta">
            {co.review_count > 0 ? <><Stars value={co.average_rating} /><b>{co.average_rating}</b><span className="muted">· {co.review_count} review{co.review_count === 1 ? '' : 's'}</span></> : <span className="muted">No reviews yet</span>}
            {co.domain_verified && <span className="status s-published">verified</span>}
            {!co.claimed && <span className="cp-unclaimed" title="No employer manages this page yet">Unclaimed</span>}
            {co.website && <a className="link" href={co.website} target="_blank" rel="noopener noreferrer">Website ↗</a>}
          </div>
        </div>
        <div className="cp-cta">{writeBtn}</div>
      </header>

      <div className="tabs cp-tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{l}</button>)}</div>

      {tab === 'snapshot' && (
        <div className="cp-grid">
          <div className="cp-col">
            <section className="card pad-card"><h3>About {co.name}</h3>
              <p className="cp-about">{co.description || `We don't have a description for ${co.name} yet.`}</p></section>
            <section className="card pad-card"><h3>Latest reviews</h3>
              {empty ? <div className="cp-empty"><p className="muted">We don't have any reviews for {co.name} yet.</p>{writeBtn}</div>
                : <>{reviews.slice(0, 2).map((r) => <ReviewCard key={r.id} r={r} />)}<button className="btn btn-outline sm" onClick={() => go('reviews')}>See all {reviews.length} reviews</button></>}
            </section>
          </div>
          <aside className="cp-col">
            <section className="card pad-card cp-score"><h3>Overall rating</h3>
              {empty ? <p className="muted">Not rated yet.</p> : <><div className="cp-big"><b>{co.average_rating}</b><Stars value={co.average_rating} size={20} /><span className="muted">{co.review_count} reviews</span></div><Distribution reviews={reviews} /></>}
            </section>
            <section className="card pad-card"><h3>Open jobs</h3>
              {co.active_jobs.length === 0 ? <p className="muted">No open jobs right now.</p> : <>
                {co.active_jobs.slice(0, 3).map((j) => <Link key={j.id} to={`/jobs/${j.id}`} className="cp-job"><b>{j.title}</b><span className="muted">{j.location}</span></Link>)}
                {co.active_jobs.length > 3 && <button className="btn btn-outline sm" onClick={() => go('jobs')}>See all {co.active_jobs.length} jobs</button>}</>}
            </section>
          </aside>
        </div>)}

      {tab === 'reviews' && (
        <div className="cp-grid">
          <div className="cp-col">
            {seeker && <ReviewForm companyId={id} name={co.name} onDone={() => { load(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
            {!user && <div className="card pad-card cp-empty"><p>Sign in as a job seeker to review {co.name}.</p><Link className="btn btn-primary" to="/login">Sign in</Link></div>}
            {user && !seeker && <div className="card pad-card muted">Only job seekers can write reviews.</div>}
            {empty ? <div className="card pad-card cp-empty"><p className="muted">No reviews yet. Be the first to share your experience.</p></div> : reviews.map((r) => <ReviewCard key={r.id} r={r} />)}
          </div>
          <aside className="cp-col"><section className="card pad-card cp-score"><h3>Rating breakdown</h3>
            {empty ? <p className="muted">Not rated yet.</p> : <><div className="cp-big"><b>{co.average_rating}</b><Stars value={co.average_rating} size={20} /></div><Distribution reviews={reviews} /></>}</section></aside>
        </div>)}

      {tab === 'salaries' && (
        <section className="card pad-card"><h3>Salaries at {co.name}</h3>
          {salaries.length === 0 ? <p className="muted">No salary reports yet.</p> : (
            <div className="cp-table"><table><thead><tr><th>Job title</th><th>Base salary</th></tr></thead>
              <tbody>{salaries.map((s) => <tr key={s.id}><td>{s.job_title}</td><td>{s.currency === 'PKR' ? 'Rs' : s.currency} {Number(s.base_salary).toLocaleString()} <span className="muted">a {PERIOD[s.period] || 'month'}</span></td></tr>)}</tbody></table></div>)}
        </section>)}

      {tab === 'jobs' && (
        <section className="card pad-card"><h3>Jobs at {co.name}</h3>
          {co.active_jobs.length === 0 ? <p className="muted">No open jobs right now.</p> : co.active_jobs.map((j) => (
            <Link key={j.id} to={`/jobs/${j.id}`} className="cp-job"><b>{j.title}</b>
              <span className="muted">{[j.location, JOB_TYPES?.[j.job_type] || j.job_type, pay(j)].filter(Boolean).join(' · ')} · {timeAgo(j.created_at)}</span></Link>))}
        </section>)}
    </div>
  )
}