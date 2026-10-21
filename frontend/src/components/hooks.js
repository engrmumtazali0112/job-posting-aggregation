import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'

// true on desktop-width screens (two-pane layout)
export function useWide() {
  const q = '(min-width: 901px)'
  const [wide, setWide] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q), h = () => setWide(m.matches)
    m.addEventListener('change', h)
    return () => m.removeEventListener('change', h)
  }, [])
  return wide
}

// saved + applied job ids for the logged-in seeker
export function useSeekerJobs() {
  const { user } = useAuth(); const nav = useNavigate()
  const seeker = user?.role === 'job_seeker'
  const [saved, setSaved] = useState(new Set()); const [applied, setApplied] = useState(new Set())
  useEffect(() => {
    if (!seeker) { setSaved(new Set()); setApplied(new Set()); return }
    api('/seeker/saved/ids').then((ids) => setSaved(new Set(ids))).catch(() => {})
    api('/seeker/applications').then((a) => setApplied(new Set(a.map((x) => x.job_id)))).catch(() => {})
  }, [seeker])
  const toggleSave = useCallback(async (job) => {
    if (!user) { nav('/login'); return }
    if (!seeker) return
    const on = saved.has(job.id)
    try {
      await api('/seeker/saved/' + job.id, { method: on ? 'DELETE' : 'POST' })
      setSaved((s) => { const n = new Set(s); on ? n.delete(job.id) : n.add(job.id); return n })
    } catch { /* ignore */ }
  }, [user, seeker, saved, nav])
  const markApplied = (id) => setApplied((s) => new Set(s).add(id))
  return { seeker, saved, applied, toggleSave, markApplied, canSave: !user || seeker }
}
