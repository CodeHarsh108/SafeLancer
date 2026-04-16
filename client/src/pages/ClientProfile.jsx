import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'
import { computeBadges, BADGE_COLORS } from '../utils/badges'

const FILE_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

// ── SVG icon set ─────────────────────────────────────────────────────────────
const Icons = {
  location: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chat: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  users: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  briefcase: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  linkedin: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  globe: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
    </svg>
  ),
  shield: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  industry: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
}

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

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-4 bg-white border border-zinc-200 rounded-xl px-4 py-3">
      <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-400 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-zinc-900 truncate">{value}</p>
      </div>
    </div>
  )
}

export default function ClientProfile() {
  const { userId } = useParams()
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
      <p className="text-center py-12 text-zinc-400 text-sm">Profile not found</p>
    </div>
  )

  const isBusiness = profile.clientType === 'business'
  const isIndividual = profile.clientType === 'individual'
  const coverBg = 'bg-zinc-900'
  const avatarFallbackBg = 'bg-zinc-800'
  const avatarShape = isBusiness ? 'rounded-xl' : 'rounded-full'

  const avatarUrl = profile.avatarUrl
    ? (profile.avatarUrl.startsWith('http') ? profile.avatarUrl : `${FILE_BASE}${profile.avatarUrl}`)
    : null

  const { earned: earnedBadges } = computeBadges(profile.user?.role || 'client', profile.user, profile)

  const avgRating = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1)
    : null

  return (
    <div className="min-h-screen bg-zinc-100">
      <Toaster />
      <Navbar />

      {/* Cover */}
      <div className={`h-36 ${coverBg}`} />

      <div className="max-w-4xl mx-auto px-6 pb-16">

        {/* ── Hero card ── */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-6 -mt-12 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-end gap-5">
              {/* Avatar */}
              {avatarUrl
                ? <img src={avatarUrl} alt={profile.user?.name}
                    className={`w-20 h-20 object-cover border-4 border-white shadow-md -mt-14 flex-shrink-0 ${avatarShape}`} />
                : <div className={`w-20 h-20 border-4 border-white shadow-md -mt-14 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 select-none ${avatarFallbackBg} ${avatarShape}`}>
                    {profile.user?.name?.[0]?.toUpperCase()}
                  </div>
              }
              <div className="pb-0.5">
                <h1 className="text-xl font-bold text-zinc-900">{profile.user?.name}</h1>
                {isBusiness && profile.companyName && (
                  <p className="text-sm text-zinc-500 mt-0.5">{profile.companyName}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {profile.clientType && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                      isIndividual
                        ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                        : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                    }`}>
                      {isIndividual ? 'Individual' : 'Business'}
                    </span>
                  )}
                  {isBusiness && profile.industry && (
                    <span className="text-xs bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-full font-medium border border-zinc-200">
                      {profile.industry}
                    </span>
                  )}
                  {profile.paymentVerified && (
                    <span className="text-xs bg-zinc-100 text-zinc-700 border border-zinc-200 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
                      {Icons.shield}
                      Payment Verified
                    </span>
                  )}
                  {avgRating && (
                    <span className="flex items-center gap-1 text-zinc-900 font-semibold text-sm">
                      <svg className="w-3.5 h-3.5 fill-zinc-700" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {avgRating}
                      <span className="text-zinc-400 font-normal text-xs">({ratings.length})</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* No edit button — this is a public view only */}
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-zinc-600 mt-5 text-sm leading-relaxed border-t border-zinc-100 pt-4">{profile.bio}</p>
          )}

          {/* Links */}
          {(profile.linkedinUrl || profile.websiteUrl) && (
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-zinc-100">
              {profile.linkedinUrl && (
                <a href={profile.linkedinUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 text-sm font-medium transition-colors border border-zinc-200 hover:border-zinc-400 rounded-lg px-3 py-1.5">
                  {Icons.linkedin} LinkedIn
                </a>
              )}
              {profile.websiteUrl && (
                <a href={profile.websiteUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 text-sm font-medium transition-colors border border-zinc-200 hover:border-zinc-400 rounded-lg px-3 py-1.5">
                  {Icons.globe} Website
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="bg-white rounded-xl border border-zinc-200 mb-4">
          <div className="grid grid-cols-4 divide-x divide-zinc-100">
            {[
              { value: avgRating ? `${avgRating}` : '—', label: 'Avg Rating' },
              { value: profile.projectsPosted || 0, label: 'Jobs Posted' },
              { value: profile.projectsCompleted || 0, label: 'Completed' },
              { value: profile.avgBudget > 0 ? `₹${Math.round(profile.avgBudget / 1000)}k` : '—', label: 'Avg Budget' },
            ].map(stat => (
              <div key={stat.label} className="py-4 px-2 text-center">
                <div className="text-xl font-bold text-zinc-900">{stat.value}</div>
                <div className="text-zinc-400 text-xs mt-0.5 leading-tight">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Details ── */}
        {(profile.location || profile.yearsHiring || profile.preferredComm || (isBusiness && profile.companySize) || (isBusiness && profile.industry)) && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-zinc-800 mb-4">Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profile.location && (
                <InfoRow icon={Icons.location} label="Location" value={profile.location} />
              )}
              {profile.yearsHiring && (
                <InfoRow icon={Icons.clock} label="Hiring Experience" value={YEARS_HIRING_LABELS[profile.yearsHiring] || profile.yearsHiring} />
              )}
              {profile.preferredComm && (
                <InfoRow icon={Icons.chat} label="Communication Style" value={COMM_LABELS[profile.preferredComm] || profile.preferredComm} />
              )}
              {isBusiness && profile.companySize && (
                <InfoRow icon={Icons.users} label="Company Size" value={`${profile.companySize} people`} />
              )}
              {isBusiness && profile.industry && (
                <InfoRow icon={Icons.industry} label="Industry" value={profile.industry} />
              )}
            </div>
          </div>
        )}

        {/* ── Badges ── */}
        {earnedBadges.length > 0 && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-800">Badges & Achievements</h2>
              <span className="text-xs text-zinc-400">{earnedBadges.length} earned</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {earnedBadges.map(badge => {
                const c = BADGE_COLORS[badge.color]
                return (
                  <div key={badge.id}
                    className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 ${c.earned}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.icon}`}>
                      {badge.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-tight">{badge.title}</p>
                      <p className="text-xs opacity-70 mt-0.5 leading-snug">{badge.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
