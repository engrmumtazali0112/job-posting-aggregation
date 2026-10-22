import { useState, useEffect } from 'react'
import { Link, NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Icon from './components/Icon.jsx'
import Seo from './components/Seo.jsx'
import { useOutside } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import Jobs from './pages/Jobs.jsx'
import JobDetail from './pages/JobDetail.jsx'
import Company from './pages/Company.jsx'
import CompanySearch from './pages/CompanySearch.jsx'
import { Login, Register } from './pages/Auth.jsx'
import { Notifications, Messages } from './pages/Inbox.jsx'
import { About, Contact, Privacy, Terms } from './pages/Legal.jsx'
import * as E from './pages/Employer.jsx'
import * as A from './pages/Admin.jsx'
import * as S from './pages/Seeker.jsx'

const MENU = {
  job_seeker: [['/my/profile', 'doc', 'Profile'], ['/my', 'briefcase', 'My jobs'], ['/companies', 'star', 'Company reviews']],
  employer: [['/employer/dashboard', 'dash', 'Dashboard'], ['/employer/dashboard/post', 'pencil', 'Post a job'], ['/employer/dashboard/company', 'building', 'Company profile']],
  admin: [['/admin', 'dash', 'Admin dashboard'], ['/admin/jobs', 'briefcase', 'Review jobs']],
}

function Navbar() {
  const { user, logout, counts } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const ref = useOutside(open, () => setOpen(false))

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const role = user?.role
  // Employers get Messages inside their dashboard layout so the sidebar stays visible
  const messagesPath = role === 'employer' ? '/employer/dashboard/messages' : '/messages'
  const cnt = (n) => (n > 0 ? <span className="badge">{n > 9 ? '9+' : n}</span> : null)

  return (
    <header className="nav2">
      <div className="wrap nav2-in">
        <Link to="/" className="brand">JobBoard</Link>
        <NavLink to="/" end className="tl">Home</NavLink>
        <NavLink to="/companies" className="tl">Company reviews</NavLink>
        <div className="nav-spacer" />
        {user ? (
          <>
            {role === 'job_seeker' && <Link to="/my?tab=saved" className="ibtn" title="Saved jobs"><Icon name="bookmark" fill /></Link>}
            {role !== 'admin' && <NavLink to={messagesPath} className="ibtn" title="Messages"><Icon name="chat" fill />{cnt(counts?.messages)}</NavLink>}
            {role !== 'admin' && <NavLink to="/notifications" className="ibtn" title="Notifications"><Icon name="bell" fill />{cnt(counts?.notifications)}</NavLink>}
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

function Footer() {
  return (
    <footer className="sitefoot">
      <div className="wrap">
        <div className="sitefoot-in">
          <div className="col"><div className="brand" style={{ margin: 0 }}>JobBoard</div><span>Jobs from top sources and verified employers.</span></div>
          <div className="col"><strong>Explore</strong><Link to="/jobs">Find jobs</Link><Link to="/companies">Company reviews</Link></div>
          <div className="col"><strong>Employers</strong><Link to="/employer">Post a job</Link><Link to="/register?role=employer">Create employer account</Link></div>
          <div className="col"><strong>Company</strong><Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Service</Link></div>
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
  if (role && user.role !== role) return <div className="wrap pad"><div className="card empty">You do not have access to this page.</div></div>
  return children
}

// /messages: employers are redirected into the dashboard layout (keeps ?app=... intact)
function MessagesRoute() {
  const { user } = useAuth()
  const { search } = useLocation()
  if (user?.role === 'employer') return <Navigate to={'/employer/dashboard/messages' + search} replace />
  return <Messages />
}

/* Page titles / descriptions for static pages; private pages are marked noindex.
   Job pages and legal pages set their own via <Seo> inside the page. */
const PAGES = {
  '/': ['Find jobs in Pakistan', 'Search thousands of jobs in Pakistan from verified employers and trusted sources. Apply online and track your applications.'],
  '/jobs': ['Search jobs', 'Browse the latest jobs in Pakistan. Filter by category, workplace type and source.'],
  '/companies': ['Company reviews', 'Read reviews from people who work at companies in Pakistan and see their open jobs.'],
  '/employer': ['Post a job and hire faster', 'Post your job, reach job seekers across Pakistan and manage candidates in one place.'],
}
const PRIVATE = ['/login', '/register', '/admin', '/employer/dashboard', '/my', '/messages', '/notifications']

function RouteSeo() {
  const { pathname } = useLocation()
  if (/^\/jobs\/\d+/.test(pathname)) return null
  if (PRIVATE.some((p) => pathname === p || pathname.startsWith(p + '/'))) return <Seo title="Account" noindex />
  if (pathname.startsWith('/companies/')) return <Seo title="Company profile and reviews" description="Company profile, open jobs and employee reviews." />
  const p = PAGES[pathname]
  return p ? <Seo title={p[0]} description={p[1]} /> : null
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <RouteSeo />
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
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          <Route path="/employer" element={<E.LandingPage />} />
          <Route path="/employer/dashboard" element={<Protected role="employer"><E.Layout /></Protected>}>
            <Route index element={<E.Dashboard />} />
            <Route path="post" element={<E.PostJob />} />
            <Route path="jobs" element={<E.MyJobs />} />
            <Route path="jobs/:id/edit" element={<E.EditJob />} />
            <Route path="candidates" element={<E.Candidates />} />
            <Route path="messages" element={<Messages />} />
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
            <Route index element={<S.MyJobs />} />
            <Route path="applications" element={<Navigate to="/my?tab=applied" replace />} />
            <Route path="saved" element={<Navigate to="/my?tab=saved" replace />} />
            <Route path="profile" element={<S.Profile />} />
          </Route>

          <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
          <Route path="/messages" element={<Protected><MessagesRoute /></Protected>} />
          <Route path="*" element={<div className="wrap pad"><Seo title="Page not found" noindex /><div className="card empty">Page not found.</div></div>} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}