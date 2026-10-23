import { useState, useEffect } from 'react'
import { Link, NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Icon from './components/Icon.jsx'
import { useOutside } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import Jobs from './pages/Jobs.jsx'
import JobDetail from './pages/JobDetail.jsx'
import Company from './pages/Company.jsx'
import CompanySearch from './pages/CompanySearch.jsx'
import { Login, Register } from './pages/Auth.jsx'
import { Notifications, Messages } from './pages/Inbox.jsx'
import * as E from './pages/Employer.jsx'
import * as A from './pages/Admin.jsx'
import * as S from './pages/Seeker.jsx'

const SEEKER_MENU = [['/my', 'dash', 'Dashboard'], ['/my/applications', 'briefcase', 'My applications'], ['/my/saved', 'bookmark', 'Saved jobs'], ['/my/profile', 'user', 'Profile'], ['/companies', 'star', 'Company reviews']]
const HIRING_MENU = [['/employer/dashboard', 'dash', 'Employer dashboard'], ['/employer/dashboard/post', 'pencil', 'Post a job'], ['/employer/dashboard/company', 'building', 'Company profile']]
const MENU = {
  job_seeker: SEEKER_MENU,
  employer: HIRING_MENU,
  admin: [['/admin', 'dash', 'Admin dashboard'], ['/admin/jobs', 'briefcase', 'Review jobs']],
}

function Navbar() {
  const { user, logout, counts } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const ref = useOutside(open, () => setOpen(false))
  
  useEffect(() => { setOpen(false) }, [pathname])
  
  const role = user?.role
  const cnt = (n) => (n > 0 ? <span className="badge">{n > 9 ? '9+' : n}</span> : null)
  
  // Safely access counts, default to 0 if undefined
  const msgCount = counts?.messages || 0
  const notifCount = counts?.notifications || 0

  return (
    <header className="nav2">
      <div className="wrap nav2-in">
        <Link to="/" className="brand">JobBoard</Link>
        <NavLink to="/" end className="tl">Home</NavLink>
        <NavLink to="/companies" className="tl">Company reviews</NavLink>
        <div className="nav-spacer" />
        {user ? (
          <>
            {role === 'job_seeker' && <Link to="/my/saved" className="ibtn" title="Saved jobs"><Icon name="bookmark" fill /></Link>}
            {role !== 'admin' && <NavLink to="/messages" className="ibtn" title="Messages"><Icon name="chat" fill />{cnt(msgCount)}</NavLink>}
            {role !== 'admin' && <NavLink to="/notifications" className="ibtn" title="Notifications"><Icon name="bell" fill />{cnt(notifCount)}</NavLink>}
            <div className="menu-wrap" ref={ref}>
              <button className={'ibtn' + (open ? ' active' : '')} onClick={() => setOpen(!open)} title="Account" aria-haspopup="menu" aria-expanded={open}><Icon name="user" fill /></button>
              {open && (
                <div className="menu" role="menu">
                  <div className="menu-email">{user.email}</div>
                  {(MENU[role] || []).map(([to, ic, label]) => <Link key={to} to={to}><Icon name={ic} fill size={18} />{label}</Link>)}
                  <button className="menu-out" onClick={logout}>Sign out</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="nav-btns">
            <Link to="/login" className="btn btn-ghost sm">Sign in</Link>
            <Link to="/register" className="btn btn-outline sm">Register</Link>
          </div>
        )}
        {role !== 'employer' && role !== 'admin' && <><div className="nav-sep" /><Link to="/employer" className="post">Employers / Post Job</Link></>}
      </div>
    </header>
  )
}

// Edit these three links to point at your real pages.
const SOCIAL = [
  ['Instagram', 'https://www.instagram.com/yourjobboard',
    <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></>],
  ['LinkedIn', 'https://www.linkedin.com/company/yourjobboard',
    <><path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 10v7" /><rect x="3" y="3" width="18" height="18" rx="3" /></>],
  ['Facebook', 'https://www.facebook.com/yourjobboard',
    <path d="M14 8h2.5V4.5H14a3.5 3.5 0 0 0-3.5 3.5v2H8v3.5h2.5V20H14v-6.5h2.5L17 10h-3V8.4c0-.2.2-.4.4-.4z" />],
]

function Footer() {
  return (
    <footer className="sitefoot dark">
      <div className="wrap">
        <div className="sitefoot-in">
          <div className="col wide">
            <div className="brand">JobBoard</div>
            <span>Connecting people with jobs from top sources and verified employers across Pakistan.</span>
            <div className="social">
              {SOCIAL.map(([label, href, icon]) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
                </a>
              ))}
            </div>
          </div>
          <div className="col"><strong>Job seekers</strong><Link to="/jobs">Find jobs</Link><Link to="/companies">Company reviews</Link><Link to="/register">Create account</Link></div>
          <div className="col"><strong>Employers</strong><Link to="/employer">Post a job</Link><Link to="/register?role=employer">Create employer account</Link></div>
        </div>
        <div className="copy2">© {new Date().getFullYear()} JobBoard. All rights reserved.</div>
      </div>
    </footer>
  )
}

export function Protected({ role, children }) {
  const { user, ready } = useAuth()
  if (!ready) return <div className="wrap pad">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  const allowed = role ? [].concat(role) : null
  if (allowed && !allowed.includes(user.role)) return <div className="wrap pad"><div className="card empty">You do not have access to this page.</div></div>
  return children
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { pathname } = useLocation()
  // dashboards (job seeker, employer, admin) have their own sidebar layout, so no footer there
  const inPanel = /^\/(my|admin|employer\/dashboard)(\/|$)/.test(pathname)
  return (
    <>
      <ScrollTop />
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/companies" element={<CompanySearch />} />
          <Route path="/companies/:id" element={<Company />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/employer" element={<E.LandingPage />} />
          <Route path="/employer/dashboard" element={<Protected role="employer"><E.Layout /></Protected>}>
            <Route index element={<E.Dashboard />} />
            <Route path="post" element={<E.PostJob />} />
            <Route path="jobs" element={<E.MyJobs />} />
            <Route path="jobs/:id/edit" element={<E.EditJob />} />
            <Route path="candidates" element={<E.Candidates />} />
            <Route path="company" element={<E.CompanyProfile />} />
          </Route>

          <Route path="/admin" element={<Protected role="admin"><A.Layout /></Protected>}>
            <Route index element={<A.Dashboard />} />
            <Route path="jobs" element={<A.Jobs />} />
            <Route path="jobs/:id/edit" element={<A.EditJob />} />
            <Route path="users" element={<A.Users />} />
            <Route path="companies" element={<A.Companies />} />
            <Route path="settings" element={<A.Settings />} />
          </Route>

          <Route path="/my" element={<Protected role="job_seeker"><S.Layout /></Protected>}>
            <Route index element={<S.Dashboard />} />
            <Route path="applications" element={<S.Applications />} />
            <Route path="saved" element={<S.Saved />} />
            <Route path="profile" element={<S.Profile />} />
          </Route>

          <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
          <Route path="/messages" element={<Protected><Messages /></Protected>} />
          <Route path="*" element={<div className="wrap pad"><div className="card empty">Page not found.</div></div>} />
        </Routes>
      </main>
      {!inPanel && <Footer />}
    </>
  )
}