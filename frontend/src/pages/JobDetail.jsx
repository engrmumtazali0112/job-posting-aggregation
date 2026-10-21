import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import JobPane from '../components/JobPane.jsx'
import { useSeekerJobs } from '../components/hooks.js'

export default function JobDetail() {
  const { id } = useParams(); const sj = useSeekerJobs()
  const [job, setJob] = useState(null); const [err, setErr] = useState('')
  useEffect(() => { setJob(null); setErr(''); api('/jobs/' + id).then(setJob).catch((e) => setErr(e.message)) }, [id])
  if (err) return <div className="wrap pad"><div className="card empty">{err}</div></div>
  if (!job) return <div className="wrap pad"><div className="card skel tall" /></div>
  const n = Number(id)
  return (
    <div className="wrap pad">
      <Link to="/jobs" className="link">← Back to jobs</Link>
      <div style={{ marginTop: 14 }}>
        <JobPane full job={job} saved={sj.saved.has(n)} applied={sj.applied.has(n)} onSave={sj.toggleSave} onApplied={sj.markApplied} canSave={sj.canSave} />
      </div>
    </div>
  )
}
