import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, timeAgo } from '../api'
import { Avatar } from '../components/JobCard.jsx'

export default function JobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api('/jobs/' + id).then(setJob).catch((e) => setErr(e.message)) }, [id])
  if (err) return <div className="wrap pad"><div className="card empty">{err}</div></div>
  if (!job) return <div className="wrap pad"><div className="card skel tall" /></div>
  const emp = job.source_type === 'employer'
  return (
    <div className="wrap pad detail">
      <Link to="/jobs" className="link">← Back to jobs</Link>
      <div className="card detail-card">
        <div className="job-top">
          <Avatar name={job.company_name} />
          <div className="job-head"><h1>{job.title}</h1><p>{job.company_name}</p></div>
        </div>
        <div className="meta big">
          <span>📍 {job.location || 'Not specified'}</span><span>🕒 Posted {timeAgo(job.created_at)}</span>
          <span className={'tag ' + (emp ? 'tag-emp' : 'tag-agg')}>{emp ? 'Employer' : 'Aggregated'}</span>
        </div>
        {job.apply_url && <a className="btn btn-primary" href={job.apply_url} target="_blank" rel="noopener noreferrer">Apply now ↗</a>}
        <h3>Job description</h3>
        <div className="desc">{job.description || 'No description provided.'}</div>
        {!emp && <p className="note">This job was found on an external source. You will be taken to the original listing to apply.</p>}
      </div>
    </div>
  )
}
