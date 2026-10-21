import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import JobCard, { Avatar } from '../components/JobCard.jsx'
import { Stars } from '../components/ui.jsx'

export default function Company() {
  const { id } = useParams(); const { user } = useAuth()
  const [company, setCompany] = useState(null); const [reviews, setReviews] = useState([]); const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false); const [form, setForm] = useState({ rating: 5, title: '', pros: '', cons: '' })
  const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false)

  const loadData = () => {
    api(`/companies/${id}`).then(setCompany).catch((e) => setError(e.message))
    api(`/companies/${id}/reviews`).then(setReviews).catch(() => {})
  }
  useEffect(() => { setCompany(null); loadData() }, [id]) // eslint-disable-line

  const submitReview = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      await api(`/companies/${id}/reviews`, { method: 'POST', body: form })
      setMsg({ ok: true, t: 'Review submitted. Thank you!' }); setShowForm(false); setForm({ rating: 5, title: '', pros: '', cons: '' }); loadData()
    } catch (err) { setMsg({ ok: false, t: err.message }) } finally { setBusy(false) }
  }

  if (error) return <div className="wrap pad"><div className="card empty">{error}</div></div>
  if (!company) return <div className="wrap pad"><div className="card skel tall" /></div>

  return (
    <div className="wrap pad">
      <div className="card pad-card" style={{ marginBottom: 24, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Avatar name={company.name} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: 30 }}>{company.name} {company.domain_verified && <span className="status s-published" style={{ verticalAlign: 'middle' }}>Verified</span>}</h1>
          <div style={{ margin: '6px 0' }}><Stars value={company.average_rating} /> <span className="muted">{company.review_count} review{company.review_count === 1 ? '' : 's'}</span></div>
          <p className="muted" style={{ marginBottom: 8 }}>{company.description || 'No description provided.'}</p>
          {company.website && <a href={company.website} target="_blank" rel="noopener noreferrer" className="link">Visit website ↗</a>}
          {!company.claimed && <div className="unclaimed">This page was created automatically from job listings. Are you the employer? <Link className="link" to="/register?role=employer">Create an employer account</Link> to manage your company profile.</div>}
        </div>
        <div className="ratebox"><b>{company.average_rating || '–'}</b><span className="muted small">Average rating</span></div>
      </div>

      <div className="two">
        <div>
          <h3 className="sub-h" style={{ marginTop: 0 }}>Open jobs ({company.active_jobs.length})</h3>
          {company.active_jobs.length === 0 ? <div className="card empty">No active jobs at the moment.</div>
            : <div className="joblist">{company.active_jobs.map((j) => <JobCard key={j.id} job={j} />)}</div>}
        </div>
        <div>
          <div className="sec-head" style={{ marginBottom: 12 }}>
            <h3 className="sub-h" style={{ margin: 0 }}>Company reviews</h3>
            {user?.role === 'job_seeker' && !showForm && <button className="btn btn-primary sm" onClick={() => setShowForm(true)}>Write a review</button>}
            {!user && <Link className="btn btn-outline sm" to="/login">Log in to review</Link>}
          </div>
          {msg && <div className={msg.ok ? 'alert ok' : 'alert'} style={{ marginBottom: 14 }}>{msg.t}</div>}
          {showForm && (
            <form className="card pad-card form" onSubmit={submitReview} style={{ marginBottom: 20 }}>
              <label>Rating<select value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}</select></label>
              <label>Review title<input required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Great place to learn" /></label>
              <label>Pros (min 10 characters)<textarea required minLength={10} rows={3} value={form.pros} onChange={(e) => setForm({ ...form, pros: e.target.value })} /></label>
              <label>Cons (min 10 characters)<textarea required minLength={10} rows={3} value={form.cons} onChange={(e) => setForm({ ...form, cons: e.target.value })} /></label>
              <div className="acts"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit review'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button></div>
            </form>
          )}
          {reviews.length === 0 ? <div className="card empty">No reviews yet. Be the first to review!</div> : reviews.map((r) => (
            <div key={r.id} className="card review-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><strong>{r.title}</strong><Stars value={r.rating} /></div>
              <div style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ok)' }}>Pros:</strong> {r.pros}</div>
              <div><strong style={{ color: 'var(--bad)' }}>Cons:</strong> {r.cons}</div>
            </div>))}
        </div>
      </div>
    </div>
  )
}
