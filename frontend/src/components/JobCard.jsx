import { Link } from 'react-router-dom'
import { timeAgo, payText, JOB_TYPES } from '../api'

const COLORS = ['#5b3cc4', '#0f9d8a', '#e0712c', '#d6336c', '#2f7de1', '#7a8b1f']

export function Avatar({ name = '?' }) {
  const c = COLORS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length]
  const ini = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return <div className="avatar" style={{ background: c + '1f', color: c }}>{ini}</div>
}

export default function JobCard({ job }) {
  const emp = job.source_type === 'employer'
  const pay = payText(job)
  return (
    <Link to={`/jobs/${job.id}`} className="card job">
      <div className="job-top">
        <Avatar name={job.company_name} />
        <div className="job-head">
          <h3>{job.title}</h3>
          <p>
            {job.company_id ? (
              <Link 
                to={`/companies/${job.company_id}`} 
                style={{ color: 'var(--p)', fontWeight: '600' }} 
                onClick={(e) => e.stopPropagation()} // Prevents the main job card link from triggering
              >
                {job.company_name}
              </Link>
            ) : (
              job.company_name
            )}
          </p>
        </div>
      </div>
      <div className="meta">
        <span>📍 {job.location || 'Not specified'}</span>
        <span>🕒 {timeAgo(job.created_at)}</span>
        {job.job_type && emp && <span>💼 {JOB_TYPES[job.job_type] || job.job_type}</span>}
        {pay && <span>💰 {pay}</span>}
      </div>
      <div className="job-foot">
        <span className={'tag ' + (emp ? 'tag-emp' : 'tag-agg')}>{emp ? 'Employer' : 'Aggregated'}</span>
        <span className="view">View job →</span>
      </div>
    </Link>
  )
}