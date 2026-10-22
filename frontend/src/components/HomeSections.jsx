import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Avatar } from './JobCard.jsx'

const initials = (n) => (n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

export function TopCompanies() {
  const [list, setList] = useState(null)
  const rail = useRef(null)
  useEffect(() => { api('/home/top-companies').then(setList).catch(() => setList([])) }, [])
  if (list && list.length === 0) return null
  const scroll = (dir) => rail.current?.scrollBy({ left: dir * 340, behavior: 'smooth' })
  return (
    <section className="hs">
      <div className="hs-head">
        <h2>Top companies</h2>
        <div className="hs-actions">
          <button type="button" className="rail-btn" aria-label="Scroll left" onClick={() => scroll(-1)}>‹</button>
          <button type="button" className="rail-btn" aria-label="Scroll right" onClick={() => scroll(1)}>›</button>
          <Link to="/companies" className="btn btn-outline sm">View all companies</Link>
        </div>
      </div>
      <div className="rail" ref={rail}>
        {list === null
          ? Array.from({ length: 5 }, (_, i) => <div key={i} className="co-card co-skel" />)
          : list.map((c) => (
            <Link key={c.id} to={`/companies/${c.id}`} className="co-card">
              {c.logo_url ? <img className="co-logo" src={c.logo_url} alt="" loading="lazy" /> : <Avatar name={c.name} />}
              <div className="co-name" title={c.name}>{c.name}</div>
              {c.location && <div className="co-loc" title={c.location}>{c.location}</div>}
              <div className="co-open">Open positions ({c.open_jobs})</div>
            </Link>
          ))}
      </div>
    </section>
  )
}

export function Trending() {
  const [t, setT] = useState(null)
  useEffect(() => { api('/home/trending').then(setT).catch(() => setT(null)) }, [])
  if (!t) return null
  const q = (v) => '/jobs?q=' + encodeURIComponent(v)
  const cols = [
    ['Trending searches', t.searches.map((s) => [s, q(s)])],
    ['Trending jobs', t.jobs.map((s) => [s, q(s)])],
    ['Trending locations', t.locations.map((s) => [s, '/jobs?location=' + encodeURIComponent(s)])],
    ['Trending companies', t.companies.map((c) => [c.name, `/companies/${c.id}`])],
  ].filter(([, items]) => items.length)
  if (!cols.length) return null
  return (
    <section className="hs">
      <h2>What’s trending</h2>
      <div className="trend">
        {cols.map(([title, items]) => (
          <div key={title}>
            <h3>{title}</h3>
            <ul>{items.map(([label, to]) => <li key={title + label}><Link to={to}>{label}</Link></li>)}</ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export function SuccessStories() {
  const [list, setList] = useState([])
  useEffect(() => { api('/home/success-stories').then(setList).catch(() => setList([])) }, [])
  if (!list.length) return null          // hidden until an admin adds real stories
  return (
    <section className="hs">
      <h2>Success stories</h2>
      <div className="stories">
        {list.map((s) => (
          <figure key={s.id} className="story">
            <figcaption className="story-who">
              {s.photo_url ? <img src={s.photo_url} alt="" loading="lazy" /> : <span className="story-ini">{initials(s.name)}</span>}
              <div><strong>{s.name}</strong><span>{s.role_title}</span></div>
            </figcaption>
            {s.hired_in && <div className="story-meta">Hired in {s.hired_in}</div>}
            <blockquote>{s.quote}</blockquote>
          </figure>
        ))}
      </div>
    </section>
  )
}
