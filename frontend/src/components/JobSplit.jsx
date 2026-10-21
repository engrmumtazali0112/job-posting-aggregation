import { useEffect, useState } from 'react'
import JobCard from './JobCard.jsx'
import JobPane from './JobPane.jsx'
import { useSeekerJobs, useWide } from './hooks.js'
import { useNavigate } from 'react-router-dom'

// Indeed-style layout: list on the left, selected job on the right (list only on phones)
export default function JobSplit({ jobs, loading, empty = 'No jobs match your search.' }) {
  const wide = useWide(); const nav = useNavigate()
  const sj = useSeekerJobs()
  const [sel, setSel] = useState(null)
  useEffect(() => { if (jobs.length && !jobs.some((j) => j.id === sel?.id)) setSel(jobs[0]) }, [jobs]) // eslint-disable-line
  if (loading && !jobs.length) return <div className="split"><div className="joblist">{[1, 2, 3].map((i) => <div key={i} className="card skel" />)}</div><div className="pane"><div className="card skel tall" /></div></div>
  if (!jobs.length) return <div className="card empty">{empty}</div>
  const pick = (j) => (wide ? setSel(j) : nav('/jobs/' + j.id))
  return (
    <div className="split">
      <div className="joblist">
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} selected={wide && sel?.id === j.id} onSelect={pick}
            saved={sj.saved.has(j.id)} onSave={sj.canSave ? sj.toggleSave : undefined} />))}
      </div>
      <JobPane job={sel} saved={sel && sj.saved.has(sel.id)} applied={sel && sj.applied.has(sel.id)}
        onSave={sj.toggleSave} onApplied={sj.markApplied} canSave={sj.canSave} />
    </div>
  )
}
