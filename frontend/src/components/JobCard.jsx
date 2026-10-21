import { Link, useNavigate } from 'react-router-dom'
import { timeAgo, payText } from '../api'
import Icon from './Icon.jsx'

const COLORS = ['#5b3cc4', '#0f7d6c', '#b5531a', '#b02a5b', '#1f5fbf', '#6b7a14']

export function Avatar({ name = '?' }) {
  const c = COLORS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length]
  const ini = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return <div className="avatar" style={{ background: c + '22', color: c }}>{ini}</div>
}

export default function JobCard({ job, selected = false, onSelect, saved = false, onSave }) {
  const nav = useNavigate()
  const emp = job.source_type === 'employer'
  const pay = payText(job)
  const open = () => (onSelect ? onSelect(job) : nav(`/jobs/${job.id}`))
  return (
    <div className={'jc' + (selected ? ' sel' : '')} role="button" tabIndex={0} onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter') open() }}>
      {emp && <div className="tagrow"><span className="chipmini">Easily apply</span></div>}
      {onSave && (
        <button className="bm" title={saved ? 'Remove from saved' : 'Save job'} aria-label="Save job"
          onClick={(e) => { e.stopPropagation(); onSave(job) }}><Icon name="bookmark" fill={saved} /></button>
      )}
      <h3>{job.title}</h3>
      <div className="co">
        {job.company_id
          ? <Link to={`/companies/${job.company_id}`} onClick={(e) => e.stopPropagation()}>{job.company_name}</Link>
          : job.company_name}
      </div>
      <div className="loc">{job.location || 'Location not specified'}</div>
      {pay && <div style={{ marginTop: 8 }}><span className="chipmini pay">{pay}</span></div>}
      <div className="foot"><span>{timeAgo(job.created_at)}</span><span>{emp ? 'Employer' : 'Aggregated'}</span></div>
    </div>
  )
}
