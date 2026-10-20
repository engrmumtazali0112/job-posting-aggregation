import { Link, NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Home from './pages/Home.jsx'
import Jobs from './pages/Jobs.jsx'
import JobDetail from './pages/JobDetail.jsx'
import { Login, Register } from './pages/Auth.jsx'
import Employer from './pages/Employer.jsx'
import Admin from './pages/Admin.jsx'

function Navbar() {
  const { user, logout } = useAuth()
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link to="/" className="logo"><span className="logo-mark">J</span>JobBoard</Link>
        <nav className="links">
          <NavLink to="/jobs">Find jobs</NavLink>
          <NavLink to="/employer">Employers</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="nav-right">
          <Link to="/employer" className="btn btn-primary sm">＋ Post a job</Link>
          {user ? (
            <>
              <span className="who" title={user.email}>{user.email.split('@')[0]}</span>
              <button className="btn btn-ghost sm" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/register" className="btn btn-ghost sm hide-sm">Sign up</Link>
              <Link to="/login" className="btn btn-outline sm">Log in</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap foot-in">
        <div><div className="logo"><span className="logo-mark">J</span>JobBoard</div>
          <p>Fresh jobs from across the web and verified employers, in one place.</p></div>
        <div><h4>Job seekers</h4><Link to="/jobs">Browse jobs</Link><Link to="/register">Create account</Link></div>
        <div><h4>Employers</h4><Link to="/employer">Post a job</Link><Link to="/register?role=employer">Employer sign up</Link></div>
      </div>
      <div className="wrap copy">© {new Date().getFullYear()} JobBoard. All rights reserved.</div>
    </footer>
  )
}

export function Protected({ role, children }) {
  const { user, ready } = useAuth()
  if (!ready) return <div className="wrap pad">Loading…</div>
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
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/employer" element={<Protected role="employer"><Employer /></Protected>} />
          <Route path="/admin" element={<Protected role="admin"><Admin /></Protected>} />
          <Route path="*" element={<div className="wrap pad"><div className="card empty">Page not found.</div></div>} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
