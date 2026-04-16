import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'
import { computeBadges, BADGE_COLORS } from '../utils/badges'

const FILE_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const YEARS_HIRING_LABELS = {
  'first-time': 'First time hiring',
  '1-2': '1–2 years hiring',
  '3-5': '3–5 years hiring',
  '5+': '5+ years hiring',
}

const COMM_LABELS = {
  async: 'Async (messages & docs)',
  sync: 'Sync (calls & check-ins)',
  flexible: 'Flexible (mix of both)',
}

export default function ClientProfile() {
  const { userId } = useParams()
  const me = JSON.parse(localStorage.getItem('user') || '{}')
  const [profile, setProfile] = useState(null)
  const [ratings, setRatings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: p }, { data: r }] = await Promise.all([
          api.get(`/api/portfolio/${userId}`),
          api.get(`/api/ratings/user/${userId}`)
        ])
        setProfile(p)
        setRatings(r)
      } catch { toast.error('Failed to load profile') }
      finally { setLoading(false) }
    }
    load()
  }, [userId])

  if (loading) return (
    <div className="min-h-screen bg-zinc-100"><Navbar />
      <div className="flex justify-center py-20">
        <div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" />
      </div>
    </div>
  )
  if (!profile) return (
    <div className="min-h-screen bg-zinc-100"><Navbar />
      <p className="text-center py-12 text-zinc-500">Profile not found</p>
    </div>
  )

  const isBusiness = profile.clientType === 'business'
  const isIndividual = profile.clientType === 'individual'
  const avatarShape = isBusiness ? 'rounded-xl' : 'rounded-full'
  const avatarUrl = profile.avatarUrl
    ? (profile.avatarUrl.startsWith('http') ? profile.avatarUrl : `${FILE_BASE}${profile.avatarUrl}`)
    : null

  const { earned: earnedBadges } = computeBadges('client', profile.user, profile)

  const avgRating = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1)
    : null

  return (
    <div className="min-h-screen bg-zinc-100">
      <Toaster />
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">

        {/* Header card */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-4">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            {avatarUrl
              ? <img src={avatarUrl} alt={profile.user?.name}
                  className={`w-16 h-16 object-cover border border-zinc-200 flex-shrink-0 ${avatarShape}`} />
              : <div className={`w-16 h-16 bg-zinc-900 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 ${avatarShape}`}>
                  {profile.user?.name?.[0]?.toUpperCase()}
                </div>
            }

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-zinc-900">{profile.user?.name}</h1>
              {isBusiness && profile.companyName && (
                <p className="text-sm text-zinc-500 mt-0.5">{profile.companyName}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {profile.clientType && (
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                    isIndividual ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {isIndividual ? 'Individual' : 'Business'}
                  </span>
                )}
                {isBusiness && profile.industry && (
                  <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md font-medium">
                    {profile.industry}
                  </span>
                )}
                {isBusiness && profile.companySize && (
                  <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-md">
                    {profile.companySize} people
                  </span>
                )}
                {profile.paymentVerified && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Payment Verified
                  </span>
                )}
                {avgRating && (
                  <span className="text-amber-600 font-medium text-sm">
                    ★ {avgRating}
                    <span className="text-zinc-400 font-normal text-xs ml-1">({ratings.length} review{ratings.length !== 1 ? 's' : ''})</span>
                  </span>
                )}
              </div>

              {profile.bio && (
                <p className="text-zinc-600 mt-3 leading-relaxed text-sm border-t border-zinc-100 pt-3">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Links */}
          {(profile.linkedinUrl || profile.websiteUrl) && (
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-zinc-100">
              {profile.linkedinUrl && (
                <a href={profile.linkedinUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 text-sm transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </a>
              )}
              {profile.websiteUrl && (
                <a href={profile.websiteUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 text-sm transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Website
                </a>
              )}
            </div>
          )}
        </div>

        {/* Stats row */}
        {(profile.projectsPosted > 0 || profile.projectsCompleted > 0) && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-zinc-200 p-4 text-center">
              <div className="text-2xl font-bold text-zinc-900">{profile.projectsPosted || 0}</div>
              <div className="text-zinc-500 text-xs mt-0.5">Jobs Posted</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{profile.projectsCompleted || 0}</div>
              <div className="text-zinc-500 text-xs mt-0.5">Completed</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4 text-center">
              <div className="text-2xl font-bold text-zinc-700">
                {profile.avgBudget > 0 ? `₹${Math.round(profile.avgBudget / 1000)}k` : '—'}
              </div>
              <div className="text-zinc-500 text-xs mt-0.5">Avg Budget</div>
            </div>
          </div>
        )}

        {/* Details */}
        {(profile.location || profile.yearsHiring || profile.preferredComm) && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Details</h2>
            <div className="space-y-3">
              {profile.location && (
                <div className="flex items-center gap-3">
                  <span className="text-base w-5 text-center">📍</span>
                  <div>
                    <p className="text-xs text-zinc-400">Location</p>
                    <p className="text-sm text-zinc-700 font-medium">{profile.location}</p>
                  </div>
                </div>
              )}
              {profile.yearsHiring && (
                <div className="flex items-center gap-3">
                  <span className="text-base w-5 text-center">🕐</span>
                  <div>
                    <p className="text-xs text-zinc-400">Hiring Experience</p>
                    <p className="text-sm text-zinc-700 font-medium">
                      {YEARS_HIRING_LABELS[profile.yearsHiring] || profile.yearsHiring}
                    </p>
                  </div>
                </div>
              )}
              {profile.preferredComm && (
                <div className="flex items-center gap-3">
                  <span className="text-base w-5 text-center">💬</span>
                  <div>
                    <p className="text-xs text-zinc-400">Preferred Communication</p>
                    <p className="text-sm text-zinc-700 font-medium">
                      {COMM_LABELS[profile.preferredComm] || profile.preferredComm}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Badges */}
        {earnedBadges.length > 0 && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Badges & Achievements
              <span className="ml-2 text-zinc-300 font-normal normal-case tracking-normal">{earnedBadges.length} earned</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {earnedBadges.map(badge => {
                const c = BADGE_COLORS[badge.color]
                return (
                  <div key={badge.id} title={badge.description}
                    className={`flex items-center gap-2 border rounded-xl px-3 py-2 ${c.earned}`}>
                    <span className="text-sm">{badge.icon}</span>
                    <span className="text-xs font-semibold whitespace-nowrap">{badge.title}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Reviews from freelancers */}
        {ratings.length > 0 && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">Freelancer Reviews</h2>
            <div className="space-y-4">
              {ratings.map(r => (
                <div key={r._id} className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-zinc-700 text-sm">{r.ratedBy?.name}</span>
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(star => (
                        <span key={star} className={`text-sm ${star <= r.stars ? 'text-amber-400' : 'text-zinc-200'}`}>★</span>
                      ))}
                      <span className="text-zinc-400 text-xs ml-1">({r.stars}/5)</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 mb-1.5">
                    <span>Communication: {r.communication}/5</span>
                    <span>Timeliness: {r.timeliness}/5</span>
                  </div>
                  {r.review && <p className="text-sm text-zinc-500 italic">"{r.review}"</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Own profile hint */}
        {me.id === userId && (
          <div className="text-center py-4">
            <Link to="/profile/setup" className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
              Edit your profile →
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
