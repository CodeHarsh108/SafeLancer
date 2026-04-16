import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { FREELANCER_BADGES, CLIENT_BADGES, BADGE_COLORS } from '../utils/badges'

export default function Navbar() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const [profileCompletion, setProfileCompletion] = useState(
    parseInt(localStorage.getItem('profileCompletion') || '0', 10)
  )
  const [badgeOpen, setBadgeOpen] = useState(false)
  const [earnedIds, setEarnedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('earnedBadgeIds') || '[]') } catch { return [] }
  })
  const [earnedCount, setEarnedCount] = useState(
    parseInt(localStorage.getItem('earnedBadgeCount') || '0', 10)
  )
  const [totalCount, setTotalCount] = useState(
    parseInt(localStorage.getItem('totalBadgeCount') || '0', 10)
  )
  const badgeRef = useRef(null)

  const showBanner = user && user.role !== 'admin' && profileCompletion < 100

  useEffect(() => {
    const sync = () => {
      setProfileCompletion(parseInt(localStorage.getItem('profileCompletion') || '0', 10))
      try { setEarnedIds(JSON.parse(localStorage.getItem('earnedBadgeIds') || '[]')) } catch {}
      setEarnedCount(parseInt(localStorage.getItem('earnedBadgeCount') || '0', 10))
      setTotalCount(parseInt(localStorage.getItem('totalBadgeCount') || '0', 10))
    }
    window.addEventListener('profileUpdated', sync)
    return () => window.removeEventListener('profileUpdated', sync)
  }, [])

  // Close popover on outside click
  useEffect(() => {
    if (!badgeOpen) return
    const handler = (e) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target)) setBadgeOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [badgeOpen])

  const logout = () => {
    localStorage.clear()
    navigate('/login')
  }

  const dashboardPath = user?.role === 'client'
    ? '/dashboard/client'
    : user?.role === 'freelancer'
    ? '/dashboard/freelancer'
    : '/admin'

  const barColor =
    profileCompletion < 40 ? 'bg-red-400' :
    profileCompletion < 70 ? 'bg-amber-400' :
    'bg-zinc-900'

  // Build the badge list for the popover from localStorage earned IDs
  const allBadges = user?.role === 'freelancer' ? FREELANCER_BADGES : CLIENT_BADGES
  const earnedBadges = allBadges.filter(b => earnedIds.includes(b.id))

  const hasAnyBadgeData = totalCount > 0

  return (
    <div className="sticky top-0 z-50">
      <nav className="bg-white border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
        <Link to={dashboardPath} className="flex items-center gap-2">
          <span className="text-base font-bold text-zinc-900 tracking-tight">FreeLock</span>
          <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase">Beta</span>
        </Link>
        {user && (
          <div className="flex items-center gap-5">
            <Link to="/jobs" className="text-zinc-500 hover:text-zinc-900 text-sm font-medium transition-colors">Jobs</Link>
            {user.role === 'client' && (
              <Link to="/freelancers" className="text-zinc-500 hover:text-zinc-900 text-sm font-medium transition-colors">Find Talent</Link>
            )}
            <Link to="/profile/setup" className="text-zinc-500 hover:text-zinc-900 text-sm font-medium transition-colors flex items-center gap-1.5">
              Profile
              {profileCompletion < 100 && (
                <span className="text-[10px] bg-zinc-900 text-white rounded px-1.5 py-0.5 leading-none font-semibold">
                  {profileCompletion}%
                </span>
              )}
            </Link>

            {/* Badge indicator */}
            {user.role !== 'admin' && (
              <div className="relative" ref={badgeRef}>
                <button
                  onClick={() => setBadgeOpen(v => !v)}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    badgeOpen ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <span className="text-base leading-none">🏅</span>
                  {hasAnyBadgeData ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded leading-none font-semibold ${
                      earnedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {earnedCount}/{totalCount}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded leading-none font-semibold">
                      Badges
                    </span>
                  )}
                </button>

                {badgeOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-zinc-200 shadow-lg overflow-hidden z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">Badges & Achievements</p>
                        {hasAnyBadgeData && (
                          <p className="text-xs text-zinc-400 mt-0.5">{earnedCount} of {totalCount} earned</p>
                        )}
                      </div>
                      <Link to="/profile/setup" onClick={() => setBadgeOpen(false)}
                        className="text-xs text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
                        View profile →
                      </Link>
                    </div>

                    <div className="p-3 max-h-96 overflow-y-auto">
                      {!hasAnyBadgeData ? (
                        <div className="py-6 text-center">
                          <p className="text-2xl mb-2">🏅</p>
                          <p className="text-sm text-zinc-600 font-medium">No badge data yet</p>
                          <p className="text-xs text-zinc-400 mt-1">Visit your profile to load your badges</p>
                          <Link to="/profile/setup" onClick={() => setBadgeOpen(false)}
                            className="inline-block mt-3 text-xs bg-zinc-900 text-white px-3 py-1.5 rounded-lg font-medium">
                            Go to Profile
                          </Link>
                        </div>
                      ) : (
                        <>
                          {/* Earned */}
                          {earnedBadges.length > 0 && (
                            <div className="mb-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-1 mb-2">Earned</p>
                              <div className="space-y-1.5">
                                {earnedBadges.map(badge => {
                                  const c = BADGE_COLORS[badge.color]
                                  return (
                                    <div key={badge.id} className={`flex items-center gap-2.5 border rounded-lg px-3 py-2 ${c.earned}`}>
                                      <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${c.icon}`}>
                                        {badge.icon}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold leading-tight">{badge.title}</p>
                                        <p className="text-[11px] opacity-70 mt-0.5 leading-tight">{badge.description}</p>
                                      </div>
                                      <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 border-l border-zinc-100 pl-5">
              <div className="w-7 h-7 bg-zinc-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {user.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-900 leading-tight">{user.name}</div>
                <div className="text-[11px] text-zinc-400 capitalize leading-tight">{user.role}</div>
              </div>
            </div>
            <button onClick={logout} className="text-sm text-zinc-400 hover:text-red-500 font-medium transition-colors">
              Logout
            </button>
          </div>
        )}
      </nav>

      {showBanner && (
        <div className="border-b border-zinc-200 bg-white px-6 py-2 flex items-center gap-4">
          <div className="w-28 bg-zinc-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${profileCompletion}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 flex-1">
            Profile <strong className="text-zinc-700">{profileCompletion}%</strong> complete
            {profileCompletion < 60
              ? ' — Complete your profile to be found by clients'
              : ' — Almost there!'}
          </span>
          <Link
            to="/profile/setup"
            className="text-xs font-semibold text-zinc-900 hover:underline underline-offset-2 whitespace-nowrap"
          >
            Complete →
          </Link>
        </div>
      )}
    </div>
  )
}
