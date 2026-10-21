import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiList, qs, CATEGORIES } from '../api'
import JobSplit from '../components/JobSplit.jsx'
import SearchPill from '../components/SearchPill.jsx'
const PAGE = 15

export default function Jobs() {
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') || ''); const [loc, setLoc] = useState(sp.get('location') || '')
  const category = sp.get('category') || ''; const source = sp.get('source') || ''; const workplace = sp.get('workplace') || ''
  const [jobs, setJobs] = useState([]); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true)

  const load = (offset = 0) => {
    setLoading(true)
    apiList('/jobs?' + qs({ q: sp.get('q'), location: sp.get('location'), source, category, workplace, limit: PAGE, offset }))
      .then((r) => { setJobs((prev) => (offset ? [...prev, ...r.items] : r.items)); setTotal(r.total) })
      .catch(() => { if (!offset) { setJobs([]); setTotal(0) } }).finally(() => setLoading(false))
  }
  useEffect(() => { setQ(sp.get('q') || ''); setLoc(sp.get('location') || ''); load(0) }, [sp]) // eslint-disable-line

  const setParam = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n) }
  const submit = (e) => { e.preventDefault(); const n = new URLSearchParams(sp); q ? n.set('q', q) : n.delete('q'); loc ? n.set('location', loc) : n.delete('location'); setSp(n) }

  return (
    <div className="wrap pad">
      <SearchPill q={q} loc={loc} setQ={setQ} setLoc={setLoc} onSubmit={submit} />
      <div className="filter-line" style={{ marginTop: 18 }}>
        <select className="mini" value={category} onChange={(e) => setParam('category', e.target.value)}>
          <option value="">All categories</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="mini" value={workplace} onChange={(e) => setParam('workplace', e.target.value)}>
          <option value="">Any workplace</option><option value="remote">Remote</option><option value="in_person">In person</option><option value="hybrid">Hybrid</option>
        </select>
        <select className="mini" value={source} onChange={(e) => setParam('source', e.target.value)}>
          <option value="">All sources</option><option value="aggregated">Aggregated</option><option value="employer">Employer</option>
        </select>
      </div>
      <p className="count">{loading && !jobs.length ? 'Searching…' : `${total.toLocaleString()} job${total === 1 ? '' : 's'} found`}</p>
      <JobSplit jobs={jobs} loading={loading} />
      {jobs.length < total && <div className="more-wrap"><button className="btn btn-outline" disabled={loading} onClick={() => load(jobs.length)}>{loading ? 'Loading…' : 'Load more'}</button></div>}
    </div>
  )
}
