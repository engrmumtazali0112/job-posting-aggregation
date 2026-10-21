import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import JobSplit from '../components/JobSplit.jsx'
import SearchPill from '../components/SearchPill.jsx'
import Icon from '../components/Icon.jsx'

const POPULAR = ['IT jobs', 'Remote', 'Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Marketing', 'Engineer']
const short = (n) => (n >= 1000 ? Math.round(n / 1000) + 'K' : n)

export default function Home() {
  const nav = useNavigate(); const { user } = useAuth()
  const [q, setQ] = useState(''); const [loc, setLoc] = useState('')
  const [jobs, setJobs] = useState(null); const [profile, setProfile] = useState(null)
  const seeker = user?.role === 'job_seeker'

  useEffect(() => {
    if (!seeker) { setProfile(null); return }
    api('/seeker/profile').then(setProfile).catch(() => setProfile(null))
  }, [seeker])

  const hint = seeker && profile?.job_titles?.[0] ? profile.job_titles[0] : ''
  useEffect(() => {
    setJobs(null)
    const run = (query) => api('/jobs?limit=12' + (query ? '&q=' + encodeURIComponent(query) : ''))
    run(hint).then((r) => (r.length || !hint ? r : run(''))).then(setJobs).catch(() => setJobs([]))
  }, [hint])

  const go = (e) => { e.preventDefault(); nav(`/jobs?q=${encodeURIComponent(q)}&location=${encodeURIComponent(loc)}`) }
  const name = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0]

  return (
    <div className="wrap">
      <div className="page-top"><SearchPill q={q} loc={loc} setQ={setQ} setLoc={setLoc} onSubmit={go} /></div>

      {user ? (
        <>
          <h1 className="welcome">Welcome, {name}</h1>
          {profile?.min_pay ? <div className="paychip"><Icon name="cash" size={18} />Rs {short(profile.min_pay)} / {profile.min_pay_period === 'month' ? 'mo' : profile.min_pay_period}</div> : null}
        </>
      ) : (
        <div style={{ textAlign: 'center', marginTop: 34 }}>
          <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', letterSpacing: -1.2, lineHeight: 1.1 }}>Find your <em style={{ fontStyle: 'normal', color: 'var(--p)' }}>next job</em></h1>
          <p className="muted" style={{ fontSize: 18, margin: '10px 0 16px' }}>Jobs from top sources and verified employers, refreshed every 30 minutes.</p>
          <div className="chips"><span>Popular:</span>{POPULAR.map((p) => <Link key={p} className="chip" to={`/jobs?q=${encodeURIComponent(p)}`}>{p}</Link>)}</div>
        </div>
      )}

      <h2 className="h-title">{hint ? 'Jobs for you' : 'Latest jobs'}</h2>
      <JobSplit jobs={jobs || []} loading={jobs === null} empty="No jobs yet. Jobs appear here once they are fetched or approved." />
      <div className="center"><Link to="/jobs" className="btn btn-outline">Browse all jobs</Link></div>

      {!user && (
        <section className="section">
          <div className="cta">
            <div><h2>Hiring? Post a job in minutes</h2><p>Reach thousands of job seekers and get your opening shared on our social channels.</p></div>
            <Link to="/register?role=employer" className="btn btn-light">Start hiring</Link>
          </div>
        </section>
      )}
    </div>
  )
}
