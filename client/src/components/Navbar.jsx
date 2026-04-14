import { useNavigate, Link } from 'react-router-dom'

export default function Navbar() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || 'null')

  const logout = () => {
    localStorage.clear()
    navigate('/')
  }

  const dashboardPath = user?.role === 'client'
    ? '/client/dashboard'
    : user?.role === 'freelancer'
    ? '/freelancer/dashboard'
    : '/admin'

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <Link to={dashboardPath} className="flex items-center gap-2">
        <span className="text-2xl font-bold text-indigo-600">FreeLock</span>
        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Beta</span>
      </Link>
      {user && (
        <div className="flex items-center gap-4">
          <Link to="/jobs" className="text-slate-600 hover:text-indigo-600 text-sm font-medium">Jobs</Link>
          {user.role === 'client' && (
            <Link to="/browse" className="text-slate-600 hover:text-indigo-600 text-sm font-medium">Find Talent</Link>
          )}
          <Link to="/profile-setup" className="text-slate-600 hover:text-indigo-600 text-sm font-medium">Profile</Link>
          <div className="flex items-center gap-2 border-l pl-4">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">{user.name}</div>
              <div className="text-xs text-indigo-600 capitalize font-medium">{user.role}</div>
            </div>
          </div>
          <button onClick={logout} className="text-sm text-slate-500 hover:text-red-500 font-medium transition-colors">
            Logout
          </button>
        </div>
      )}
    </nav>
  )
}
