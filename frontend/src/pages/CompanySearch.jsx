import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function CompanySearch() {
  const nav = useNavigate()
  const [q, setQ] = useState('')

  const search = (e) => {
    e.preventDefault()
    if (q) nav(`/companies/search?q=${q}`) // We'll need to add this route later
  }

  return (
    <div style={{ background: 'var(--beige)', minHeight: '80vh' }}>
      <div className="wrap" style={{ paddingTop: '80px' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '10px' }}>Find great places to work</h1>
        <p style={{ fontSize: '20px', color: 'var(--mut)', marginBottom: '30px' }}>Get access to millions of company reviews</p>
        
        <form onSubmit={search} style={{ display: 'flex', gap: '10px', maxWidth: '800px', marginBottom: '15px' }}>
          <input placeholder="Company name or job title" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, padding: '15px', fontSize: '18px', border: '1px solid var(--line)', borderRadius: '8px' }} />
          <button className="btn btn-primary" style={{ padding: '0 40px', fontSize: '18px' }}>Find Companies</button>
        </form>
        
        <a href="#" className="link" style={{ fontSize: '16px' }}>Do you want to search for salaries?</a>

        <h3 style={{ marginTop: '60px', fontSize: '24px' }}>Popular companies</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '20px' }}>
          {['SAMBA Bank', 'ROZEE.PK', 'Bank Alfalah', 'National Refinery Limited', 'ISMAIL INDUSTRIES', 'Yousaf School System'].map(c => (
            <div key={c} className="card" style={{ padding: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>{c}</h4>
              <div style={{ color: '#f59e0b', marginBottom: '10px' }}>★★★★☆ <span style={{ color: 'var(--p)' }}>Reviews</span></div>
              <div style={{ display: 'flex', gap: '15px', fontSize: '14px', color: 'var(--mut)' }}>
                <span>Salaries</span>
                <span>Q&A</span>
                <span>Open jobs</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
