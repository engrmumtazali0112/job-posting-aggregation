import Icon from './Icon.jsx'
export default function SearchPill({ q, loc, setQ, setLoc, onSubmit, label = 'Find jobs' }) {
  return (
    <form className="pill-search" onSubmit={onSubmit}>
      <label className="f"><Icon name="search" /><input placeholder="Job title, keywords, or company" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <label className="f"><Icon name="pin" /><input placeholder='City, area, or "remote"' value={loc} onChange={(e) => setLoc(e.target.value)} /></label>
      <button className="btn btn-primary">{label}</button>
    </form>
  )
}
