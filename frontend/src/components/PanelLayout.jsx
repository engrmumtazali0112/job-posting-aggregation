import { NavLink, Outlet } from 'react-router-dom'
export default function PanelLayout({ title, items }) {
  return (
    <div className="panel">
      <aside className="side">
        <div className="side-title">{title}</div>
        {items.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => 'side-link' + (isActive ? ' on' : '')}>{label}</NavLink>
        ))}
      </aside>
      <section className="panel-main"><Outlet /></section>
    </div>
  )
}
