import { useNavigate, Link } from 'react-router-dom'

export default function Navbar() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const profileCompletion = parseInt(localStorage.getItem('profileCompletion') || '0', 10)
  const showBanner = user && profileCompletion < 100

  const logout = () => {
    localStorage.clear()
    navigate('/login')
  }

  const dashboardPath = user?.role === 'client'
    ? '/dashboard/client'
    : user?.role === 'freelancer'
    ? '/dashboard/freelancer'
    : '/admin'

  const bannerColor =
    profileCompletion < 40 ? 'bg-red-50 border-red-200 text-red-700' :
    profileCompletion < 70 ? 'bg-amber-50 border-amber-200 text-amber-700' :
    'bg-blue-50 border-blue-200 text-blue-700'

  const barColor =
    profileCompletion < 40 ? 'bg-red-400' :
    profileCompletion < 70 ? 'bg-amber-400' :
    'bg-blue-500'

  return (
    <div className="sticky top-0 z-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <Link to={dashboardPath} className="flex items-center gap-2">
          <span className="text-2xl font-bold text-indigo-600">FreeLock</span>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Beta</span>
        </Link>
        {user && (
          <div className="flex items-center gap-4">
            <Link to="/jobs" className="text-slate-600 hover:text-indigo-600 text-sm font-medium">Jobs</Link>
            {user.role === 'client' && (
              <Link to="/freelancers" className="text-slate-600 hover:text-indigo-600 text-sm font-medium">Find Talent</Link>
            )}
            <Link to="/profile/setup" className="relative text-slate-600 hover:text-indigo-600 text-sm font-medium flex items-center gap-1">
              Profile
              {profileCompletion < 100 && (
                <span className="text-xs bg-indigo-600 text-white rounded-full px-1.5 py-0.5 leading-none">
                  {profileCompletion}%
                </span>
              )}
            </Link>
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

      {/* Profile completion banner */}
      {showBanner && (
        <div className={`border-b px-6 py-2 flex items-center gap-3 ${bannerColor}`}>
          <div className="flex-1 flex items-center gap-3">
            <div className="w-32 bg-white/60 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
            <span className="text-xs font-medium">
              Profile {profileCompletion}% complete
              {profileCompletion < 60
                ? ' — A complete profile helps others find and trust you'
                : ' — Almost there! Finish your profile for maximum visibility'}
            </span>
          </div>
          <Link
            to="/profile/setup"
            className="text-xs font-semibold underline underline-offset-2 whitespace-nowrap"
          >
            Complete Profile →
          </Link>
        </div>
      )}
    </div>
  )
}
