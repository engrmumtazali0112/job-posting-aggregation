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
export const Stat = ({ label, value }) => (
  <div className="card stat"><div className="stat-n">{value ?? '–'}</div><div className="muted">{label}</div></div>
)
