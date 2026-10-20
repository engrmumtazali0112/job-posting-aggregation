import { useEffect, useState } from 'react'

export default function App() {
  const [jobs, setJobs] = useState([])
  const [q, setQ] = useState('')
  const [source, setSource] = useState('')

  useEffect(() => {
    const params = new URLSearchParams({ q, source })
    fetch(`/api/jobs?${params}`).then(r => r.json()).then(setJobs)
  }, [q, source])

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Job Board</h1>
      <input placeholder="Search title, company, location" value={q}
             onChange={e => setQ(e.target.value)} style={{ padding: 8, width: '60%' }} />
      <select value={source} onChange={e => setSource(e.target.value)} style={{ padding: 8, marginLeft: 8 }}>
        <option value="">All sources</option>
        <option value="aggregated">Aggregated</option>
        <option value="employer">Employer</option>
      </select>
      {jobs.map(j => (
        <div key={j.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginTop: 12 }}>
          <h3 style={{ margin: 0 }}>{j.title}</h3>
          <p style={{ margin: '4px 0' }}>{j.company_name} · {j.location}</p>
          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: j.source_type === 'employer' ? '#d1fae5' : '#dbeafe' }}>
            {j.source_type === 'employer' ? 'Employer' : 'Aggregated'}
          </span>
        </div>
      ))}
    </div>
  )
}