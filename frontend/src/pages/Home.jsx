import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import JobCard from '../components/JobCard.jsx'

const POPULAR = ['IT jobs', 'Remote', 'Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Marketing', 'Engineer']

export default function Home() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('')
  const [jobs, setJobs] = useState(null)
  useEffect(() => { api('/jobs?limit=9').then(setJobs).catch(() => setJobs([])) }, [])
  const go = (e) => { e.preventDefault(); nav(`/jobs?q=${encodeURIComponent(q)}&location=${encodeURIComponent(loc)}`) }
  return (
    <>
      <section className="hero">
        <div className="blob b1" /><div className="blob b2" />
        <div className="wrap hero-in">
          <span className="pill">● New jobs added every 30 minutes</span>
          <h1>Land your <em>dream job</em><br />today</h1>
          <p className="sub">Jobs from top sources and verified employers, all in one searchable place.</p>
          <form className="searchbar" onSubmit={go}>
            <input placeholder="Job title, skill, or company" value={q} onChange={(e) => setQ(e.target.value)} />
            <input placeholder="City or Remote" value={loc} onChange={(e) => setLoc(e.target.value)} />
            <button className="btn btn-primary">Search</button>
          </form>
          <div className="chips"><span>Popular:</span>
            {POPULAR.map((p) => <Link key={p} className="chip" to={`/jobs?q=${encodeURIComponent(p)}`}>{p}</Link>)}
          </div>
        </div>
      </section>

      <section className="wrap features">
        {[['🔎', 'One unified feed', 'Aggregated and employer jobs together, clearly tagged.'],
          ['✅', 'Verified employers', 'Every employer job is reviewed before it goes live.'],
          ['⚡', 'Always fresh', 'New jobs are fetched automatically all day.']].map(([i, t, d]) => (
          <div className="card feat" key={t}><div className="ico">{i}</div><h3>{t}</h3><p>{d}</p></div>
        ))}
      </section>

      <section className="wrap section">
        <div className="sec-head">
          <div><span className="pill pill-soft">FRESH TODAY</span><h2>Latest jobs</h2></div>
          <Link to="/jobs" className="link">View all jobs →</Link>
        </div>
        {jobs === null ? <div className="grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card skel" />)}</div>
          : jobs.length === 0 ? <div className="card empty">No jobs yet. Jobs appear here once they are fetched or approved.</div>
          : <div className="grid">{jobs.map((j) => <JobCard key={j.id} job={j} />)}</div>}
      </section>

      <section className="wrap section">
        <div className="cta">
          <div><h2>Hiring? Post a job in minutes</h2><p>Reach thousands of job seekers and get your opening shared on our social channels.</p></div>
          <Link to="/register?role=employer" className="btn btn-light">Start hiring</Link>
        </div>
      </section>
    </>
  )
}
