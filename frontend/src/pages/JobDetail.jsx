import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import JobPane from '../components/JobPane.jsx'
import Seo, { jobPostingLd } from '../components/Seo.jsx'
import { useSeekerJobs } from '../components/hooks.js'
import Markdown from '../components/Markdown.jsx'

export default function JobDetail() {
  const { id } = useParams(); const sj = useSeekerJobs()
  const [job, setJob] = useState(null); const [err, setErr] = useState(''); const [imgOk, setImgOk] = useState(true)
  useEffect(() => { setJob(null); setErr(''); setImgOk(true); api('/jobs/' + id).then(setJob).catch((e) => setErr(e.message)) }, [id])
  if (err) return <div className="wrap pad"><Seo title="Job not found" noindex /><div className="card empty">{err}</div></div>
  if (!job) return <div className="wrap pad"><div className="card skel tall" /></div>
  const n = Number(id)
  const where = job.location ? ` in ${job.location}` : ''
  const summary = (job.description || '').replace(/\s+/g, ' ').trim().slice(0, 155)
  return (
    <div className="wrap pad">
      <Seo title={`${job.title} at ${job.company_name}${where}`} description={summary || `${job.title} at ${job.company_name}`}
        path={'/jobs/' + job.id} jsonLd={jobPostingLd(job)} />
      <Link to="/jobs" className="link">← Back to jobs</Link>
      {job.ai_article && (
        <article className="card pad-card ai-article" style={{ marginTop: 14 }}>
          {job.ai_image_url && imgOk && <img className="ai-article-img" src={job.ai_image_url} alt={job.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />}
          <Markdown text={job.ai_article} />
          <p className="muted small">This guide was written with AI from the job post. Check details on the original listing before you apply.</p>
        </article>)}
      <div style={{ marginTop: 14 }}>
        <JobPane full job={job} saved={sj.saved.has(n)} applied={sj.applied.has(n)} onSave={sj.toggleSave} onApplied={sj.markApplied} canSave={sj.canSave} />
      </div>
    </div>
  )
}