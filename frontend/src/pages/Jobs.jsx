import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import JobCard from '../components/JobCard.jsx'
const PAGE = 12

export default function Jobs() {
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') || '')
  const [loc, setLoc] = useState(sp.get('location') || '')
  const [source, setSource] = useState(sp.get('source') || '')
  const [category, setCategory] = useState(sp.get('category') || '')
  
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)

  const load = (offset = 0) => {
    setLoading(true)
    const p = new URLSearchParams({ 
      q: sp.get('q') || '', 
      location: sp.get('location') || '', 
      source: sp.get('source') || '', 
      category: sp.get('category') || '',
      limit: PAGE, 
      offset 
    })
    api('/jobs?' + p).then((r) => { 
      setJobs((prev) => (offset ? [...prev, ...r] : r)); 
      setMore(r.length === PAGE) 
    })
    .catch(() => setMore(false)).finally(() => setLoading(false))
  }
  
  useEffect(() => { load(0) }, [sp])
  
  const submit = (e) => { e.preventDefault(); setSp({ q, location: loc, source, category }) }

  return (
    <div className="wrap pad">
      <h1 className="page-title">Find your next job</h1>
      <form className="filters card" onSubmit={submit}>
        <input placeholder="Job title, skill, or company" value={q} onChange={(e) => setQ(e.target.value)} />
        <input placeholder="Location" value={loc} onChange={(e) => setLoc(e.target.value)} />
        
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          <option value="private">Private</option>
          <option value="government">Government</option>
          <option value="contract">Contract</option>
          <option value="ngo">NGO</option>
        </select>

        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          <option value="aggregated">Aggregated</option>
          <option value="employer">Employer</option>
        </select>
        
        <button className="btn btn-primary">Search</button>
      </form>
      <p className="count">{loading && !jobs.length ? 'Searching…' : `${jobs.length}${more ? '+' : ''} jobs found`}</p>
      {!loading && jobs.length === 0 ? <div className="card empty">No jobs match your search.</div>
        : <div className="grid">{jobs.map((j) => <JobCard key={j.id} job={j} />)}</div>}
      {more && <div className="center"><button className="btn btn-outline" disabled={loading} onClick={() => load(jobs.length)}>{loading ? 'Loading…' : 'Load more'}</button></div>}
    </div>
  )
}