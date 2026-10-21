import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import JobCard, { Avatar } from '../components/JobCard.jsx'

export default function Company() {
  const { id } = useParams()
  const { user } = useAuth()
  const [company, setCompany] = useState(null)
  const [reviews, setReviews] = useState([])
  const [error, setError] = useState('')
  
  // Review form state
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ rating: 5, title: '', pros: '', cons: '' })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const loadData = () => {
    api(`/companies/${id}`).then(setCompany).catch(e => setError(e.message))
    api(`/companies/${id}/reviews`).then(setReviews).catch(() => {})
  }

  useEffect(() => { loadData() }, [id])

  const submitReview = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      await api(`/companies/${id}/reviews`, { method: 'POST', body: form })
      setMsg({ ok: true, t: 'Review submitted successfully!' })
      setShowForm(false)
      setForm({ rating: 5, title: '', pros: '', cons: '' })
      loadData() // Reload to show the new review and updated average rating
    } catch (err) {
      setMsg({ ok: false, t: err.message })
    } finally {
      setBusy(false)
    }
  }

  if (error) return <div className="wrap pad"><div className="card empty">{error}</div></div>
  if (!company) return <div className="wrap pad"><div className="card skel tall" /></div>

  return (
    <div className="wrap pad">
      {/* COMPANY HEADER */}
      <div className="card detail-card" style={{ marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        <Avatar name={company.name} />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: '0 0 10px 0' }}>{company.name}</h1>
          <p style={{ color: 'var(--mut)', marginBottom: '10px' }}>{company.description || 'No description provided.'}</p>
          {company.website && <a href={company.website} target="_blank" rel="noopener noreferrer" className="link">Visit Website ↗</a>}
        </div>
        <div style={{ textAlign: 'center', background: '#f8f9fa', padding: '15px', borderRadius: '10px', minWidth: '120px' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f59e0b' }}>{company.average_rating}</div>
          <div style={{ fontSize: '12px', color: 'var(--mut)', textTransform: 'uppercase', letterSpacing: '1px' }}>Avg Rating</div>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: 'start', gap: '30px' }}>
        
        {/* OPEN JOBS */}
        <div>
          <h3 className="sub-h">Open Jobs ({company.active_jobs.length})</h3>
          {company.active_jobs.length === 0 ? (
            <div className="card empty">No active jobs at the moment.</div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
              {company.active_jobs.map(j => <JobCard key={j.id} job={j} />)}
            </div>
          )}
        </div>

        {/* REVIEWS SECTION */}
        <div>
          <div className="sec-head" style={{ marginBottom: '15px' }}>
            <h3 className="sub-h" style={{ margin: 0 }}>Company Reviews</h3>
            {user?.role === 'job_seeker' && !showForm && (
              <button className="btn btn-primary sm" onClick={() => setShowForm(true)}>Write a Review</button>
            )}
          </div>

          {msg && <div className={msg.ok ? 'alert ok' : 'alert'} style={{ marginBottom: '15px' }}>{msg.t}</div>}

          {showForm && (
            <form className="card pad-card form" onSubmit={submitReview} style={{ marginBottom: '20px' }}>
              <label>Rating
                <select value={form.rating} onChange={e => setForm({...form, rating: Number(e.target.value)})}>
                  {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Stars</option>)}
                </select>
              </label>
              <label>Review Title<input required minLength={3} value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Great place to learn" /></label>
              <label>Pros (min 10 chars)<textarea required minLength={10} rows={3} value={form.pros} onChange={e => setForm({...form, pros: e.target.value})} placeholder="What did you like?" /></label>
              <label>Cons (min 10 chars)<textarea required minLength={10} rows={3} value={form.cons} onChange={e => setForm({...form, cons: e.target.value})} placeholder="What could be improved?" /></label>
              <div className="acts">
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit Review'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          )}

          {reviews.length === 0 ? (
            <div className="card empty">No reviews yet. Be the first to review!</div>
          ) : (
            reviews.map(r => (
              <div key={r.id} className="card" style={{ padding: '20px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <strong>{r.title}</strong>
                  <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{r.rating} ★</span>
                </div>
                <div style={{ marginBottom: '10px' }}><strong style={{ color: 'var(--ok)' }}>Pros:</strong> {r.pros}</div>
                <div><strong style={{ color: 'var(--bad)' }}>Cons:</strong> {r.cons}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}