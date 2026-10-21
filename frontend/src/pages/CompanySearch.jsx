import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, qs } from '../api'
import Icon from '../components/Icon.jsx'
import { Avatar } from '../components/JobCard.jsx'
import { Stars } from '../components/ui.jsx'

export default function CompanySearch() {
  const [sp, setSp] = useSearchParams(); const query = sp.get('q') || ''
  const [q, setQ] = useState(query); const [list, setList] = useState(null)
  useEffect(() => { setQ(query); setList(null); api('/companies?' + qs({ q: query, limit: 18 })).then(setList).catch(() => setList([])) }, [query])
  const search = (e) => { e.preventDefault(); setSp(q.trim() ? { q: q.trim() } : {}) }

  return (
    <div className="wrap">
      <div className="co-hero">
        <h1>Find great places to work</h1>
        <p className="muted" style={{ fontSize: 20, marginBottom: 28 }}>Read reviews from people who work there</p>
        <form onSubmit={search} className="pill-search" style={{ margin: 0 }}>
          <label className="f"><Icon name="search" /><input placeholder="Company name" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <button className="btn btn-primary">Find companies</button>
        </form>
        <h3 style={{ marginTop: 50, fontSize: 24 }}>{query ? `Results for “${query}”` : 'Popular companies'}</h3>
        {list === null ? <div className="co-grid">{[1, 2, 3].map((i) => <div key={i} className="card skel" />)}</div>
          : list.length === 0 ? <div className="card empty" style={{ marginTop: 18 }}>No companies found.</div>
          : <div className="co-grid">{list.map((c) => (
            <Link key={c.id} to={'/companies/' + c.id} className="card co-card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}><Avatar name={c.name} /><h4 style={{ margin: 0 }}>{c.name}</h4></div>
              <div>{c.review_count ? <><Stars value={c.average_rating} /> <span className="muted small">{c.average_rating} · {c.review_count} review{c.review_count === 1 ? '' : 's'}</span></> : <span className="muted small">No reviews yet</span>}</div>
              <div className="co-links"><span>{c.open_jobs} open job{c.open_jobs === 1 ? '' : 's'}</span></div>
            </Link>))}</div>}
      </div>
    </div>
  )
}
