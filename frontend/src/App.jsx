import { Link, NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Home from './pages/Home.jsx'
import Jobs from './pages/Jobs.jsx'
import JobDetail from './pages/JobDetail.jsx'
import Company from './pages/Company.jsx'
import CompanySearch from './pages/CompanySearch.jsx'
import { Login, Register } from './pages/Auth.jsx'
import * as E from './pages/Employer.jsx'
import * as A from './pages/Admin.jsx'
import * as S from './pages/Seeker.jsx'
import { useState } from 'react'

function Navbar() {
  const { user, logout } = useAuth()
  const role = user?.role
  const [showMenu, setShowMenu] = useState(false)

  return (
    <header style={{ background: '#fff', borderBottom: '1px solid var(--line)' }}>
      <div className="wrap nav-in" style={{ height: '70px' }}>
        <Link to="/" className="logo" style={{ color: '#2557a7', fontSize: '28px', fontWeight: '900', letterSpacing: '-1px', display: 'flex', alignItems: 'center' }}>
          JobBoard
        </Link>
        
        <nav className="links" style={{ marginLeft: '30px' }}>
          <NavLink to="/" style={({isActive}) => ({ color: isActive ? 'var(--p)' : 'var(--mut)', borderBottom: isActive ? '2px solid var(--p)' : 'none', height: '70px', display: 'flex', alignItems: 'center', padding: '0 10px' })}>Home</NavLink>
          <NavLink to="/companies" style={({isActive}) => ({ color: isActive ? 'var(--p)' : 'var(--mut)', borderBottom: isActive ? '2px solid var(--p)' : 'none', height: '70px', display: 'flex', alignItems: 'center', padding: '0 10px' })}>Company reviews</NavLink>
        </nav>

        <div className="nav-right" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          {user ? (
            <>
              <Link to="/my/saved" className="nav-icon" title="Saved Jobs">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              </Link>
              <Link to="/my/applications" className="nav-icon" title="My Jobs">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
              </Link>
              <Link to="/my/profile" className="nav-icon" title="Profile">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </Link>
              
              <div style={{ position: 'relative', marginLeft: '15px' }}>
                <button onClick={() => setShowMenu(!showMenu)} className="btn btn-outline sm" style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Menu <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                {showMenu && (
                  <div style={{ position: 'absolute', top: '40px', right: 0, background: '#fff', border: '1px solid var(--line)', borderRadius: '8px', width: '250px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100 }}>
                    <div style={{ padding: '15px', borderBottom: '1px solid var(--line)', fontSize: '13px', color: 'var(--mut)' }}>{user.email}</div>
                    <Link to="/my/profile" style={{ display: 'block', padding: '10px 15px', color: 'var(--ink)', borderBottom: '1px solid #f0f0f0' }}>Profile</Link>
                    <Link to="/my/applications" style={{ display: 'block', padding: '10px 15px', color: 'var(--ink)', borderBottom: '1px solid #f0f0f0' }}>My Jobs</Link>
                    <button onClick={logout} style={{ display: 'block', padding: '10px 15px', width: '100%', textAlign: 'left', color: 'var(--p)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '15px' }}>
              <Link to="/login" className="btn btn-ghost sm">Sign in</Link>
              <Link to="/register" className="btn btn-outline sm">Register</Link>
            </div>
          )}
          
          <div style={{ width: '1px', height: '30px', background: 'var(--line)', margin: '0 20px' }}></div>
          <Link to="/employer" style={{ color: 'var(--ink)', fontWeight: '600', fontSize: '14px' }}>Employers / Post Job</Link>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer style={{ background: '#faf9f8', borderTop: '1px solid var(--line)', padding: '40px 0', marginTop: 'auto' }}>
      <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--mut)' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--p)', marginBottom: '10px' }}>JobBoard</div>
          <p>© {new Date().getFullYear()} JobBoard. All rights reserved.</p>
        </div>
        <div style={{ display: 'flex', gap: '40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <strong style={{ color: 'var(--ink)' }}>Explore</strong>
            <Link to="/jobs">Find jobs</Link>
            <Link to="/companies">Company reviews</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <strong style={{ color: 'var(--ink)' }}>Employers</strong>
            <Link to="/employer">Post a job</Link>
          </div>
        </div>
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

export default function App() {
  return (
    <>
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

          {/* Public Employer Landing Page */}
          <Route path="/employer" element={<E.LandingPage />} />

          {/* Protected Employer Dashboard */}
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
            <Route index element={<Navigate to="applications" replace />} />
            <Route path="applications" element={<S.Applications />} />
            <Route path="saved" element={<S.Saved />} />
            <Route path="profile" element={<S.Profile />} />
          </Route>

          <Route path="*" element={<div className="wrap pad"><div className="card empty">Page not found.</div></div>} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}