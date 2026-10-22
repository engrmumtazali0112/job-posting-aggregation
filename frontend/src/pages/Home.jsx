import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import JobSplit from '../components/JobSplit.jsx'
import SearchPill from '../components/SearchPill.jsx'
import Icon from '../components/Icon.jsx'
import { TopCompanies, Trending, SuccessStories } from '../components/HomeSections.jsx'

const POPULAR = ['IT jobs', 'Remote', 'Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Marketing', 'Engineer']
const short = (n) => (n >= 1000 ? Math.round(n / 1000) + 'K' : n)

export default function Home() {
  const nav = useNavigate(); const { user } = useAuth()
  const [q, setQ] = useState(''); const [loc, setLoc] = useState('')
  const [jobs, setJobs] = useState(null); const [profile, setProfile] = useState(null)
  const [videoOk, setVideoOk] = useState(true)
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
    <>
      <section className="hero">
        {videoOk && (
          <video className="hero-video" autoPlay muted loop playsInline preload="metadata"
            aria-hidden="true" onError={() => setVideoOk(false)}>
            <source src="/hero.mp4" type="video/mp4" />
          </video>
        )}
        <div className="hero-shade" />
        <div className="wrap hero-in">
          <div className="hero-copy">
            {user ? <h1>Welcome back, {name}</h1> : <h1>Find the right job for your next step</h1>}
            <p>Browse jobs that match your skills and move forward in your career with confidence. Refreshed every 30 minutes.</p>
            {user && profile?.min_pay ? <div className="paychip"><Icon name="cash" size={18} />Rs {short(profile.min_pay)} / {profile.min_pay_period === 'month' ? 'mo' : profile.min_pay_period}</div> : null}
          </div>
          <div className="hero-card">
            <SearchPill q={q} loc={loc} setQ={setQ} setLoc={setLoc} onSubmit={go} />
            <div className="hero-pop"><span>Trending</span>{POPULAR.map((p) => <Link key={p} to={`/jobs?q=${encodeURIComponent(p)}`}>{p}</Link>)}</div>
          </div>
        </div>
      </section>

      <div className="wrap">
        <section className="hs">
          <div className="hs-head">
            <h2>{hint ? 'Jobs for you' : 'Latest jobs'}</h2>
            <Link to="/jobs" className="btn btn-outline sm">View all</Link>
          </div>
          <JobSplit jobs={jobs || []} loading={jobs === null} empty="No jobs yet. Jobs appear here once they are fetched or approved." />
        </section>

        <TopCompanies />
        <SuccessStories />
        <Trending />

        <section className="hs duo">
          <div className="duo-card">
            <h3>Become a candidate</h3>
            <p>Create your profile, upload your resume and connect with employers who are hiring now.</p>
            <Link to="/register" className="btn btn-primary">Register now</Link>
          </div>
          <div className="duo-card duo-dark">
            <h3>Become an employer</h3>
            <p>Post jobs, manage applications and reach candidates across Pakistan.</p>
            <Link to="/register?role=employer" className="btn btn-light">Start hiring</Link>
          </div>
        </section>
      </div>
    </>
  )
}
