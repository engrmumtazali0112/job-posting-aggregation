import { useEffect, useRef } from 'react'
import { STATUS_LABEL } from '../api'

export function Pager({ total, offset, limit, onChange }) {
  if (total <= limit) return null
  const page = Math.floor(offset / limit) + 1, pages = Math.ceil(total / limit)
  return (
    <div className="pager">
      <button className="btn btn-outline sm" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>← Prev</button>
      <span className="muted">Page {page} of {pages} · {total} total</span>
      <button className="btn btn-outline sm" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>Next →</button>
    </div>
  )
}
export const Badge = ({ s }) => <span className={'status s-' + s}>{s}</span>
export const AppStatus = ({ s }) => <span className={'status s-' + s}>{STATUS_LABEL[s] || s}</span>
export const Stat = ({ label, value }) => (
  <div className="card stat"><div className="stat-n">{value ?? '—'}</div><div className="muted">{label}</div></div>
)
export const Stars = ({ value = 0 }) => {
  const full = Math.round(value)
  return <span className="stars" aria-label={`${value} out of 5`}>{'★'.repeat(full)}<span className="stars-off">{'★'.repeat(5 - full)}</span></span>
}
// closes a popup when you click outside it
export function useOutside(open, close) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) close() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, close])
  return ref
}
