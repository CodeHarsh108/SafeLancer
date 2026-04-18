import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'
import { computeBadges, BADGE_COLORS } from '../utils/badges'

const FILE_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

// ── SVG icon set ─────────────────────────────────────────────────────────────
const Icons = {
  github: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
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
  document: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  paperclip: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  ),
  shield: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  star: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  download: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  ),
}

function StatCard({ value, label, color = 'text-zinc-900' }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-zinc-500 text-xs mt-1">{label}</div>
    </div>
  )
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

export default function FreelancerProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
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
      <p className="text-center py-12 text-zinc-400 text-sm">Profile not found</p>
    </div>
  )

  const avgRating = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1)
    : null

  const avatarUrl = profile.avatarUrl
    ? (profile.avatarUrl.startsWith('http') ? profile.avatarUrl : `${FILE_BASE}${profile.avatarUrl}`)
    : null

  const { earned: earnedBadges, total: totalBadges } = computeBadges('freelancer', profile.user, profile)

  const inputCls = "w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 pt-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
      </div>

      {/* Cover */}
      <div className="bg-zinc-900 h-36" />

      <div className="max-w-4xl mx-auto px-6 pb-16">

        {/* ── Hero card ── */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-6 -mt-12 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-end gap-5">
              {/* Avatar */}
              {avatarUrl
                ? <img src={avatarUrl} alt={profile.user?.name}
                    className="w-20 h-20 rounded-xl object-cover border-4 border-white shadow-md -mt-14 flex-shrink-0" />
                : <div className="w-20 h-20 rounded-xl bg-zinc-800 border-4 border-white shadow-md -mt-14 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 select-none">
                    {profile.user?.name?.[0]?.toUpperCase()}
                  </div>
              }
              <div className="pb-0.5">
                <h1 className="text-xl font-bold text-zinc-900">{profile.user?.name}</h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {avgRating && (
                    <span className="flex items-center gap-1 text-zinc-900 font-semibold text-sm">
                      <svg className="w-3.5 h-3.5 fill-zinc-700" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      {avgRating}
                      <span className="text-zinc-400 font-normal text-xs">({ratings.length})</span>
                    </span>
                  )}
                  {profile.user?.totalJobsCompleted > 0 && (
                    <span className="text-xs text-zinc-400">{profile.user.totalJobsCompleted} jobs completed</span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                    profile.availability === 'full-time'
                      ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                      : profile.availability === 'part-time'
                      ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                      : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                  }`}>
                    {profile.availability === 'full-time' ? 'Available full-time'
                      : profile.availability === 'part-time' ? 'Available part-time'
                      : 'Not available'}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA — only for clients, never show edit here */}
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-zinc-600 mt-5 text-sm leading-relaxed border-t border-zinc-100 pt-4">{profile.bio}</p>
          )}

          {/* Skills */}
          {profile.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {profile.skills.map(s => (
                <span key={s} className="bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded-lg text-xs font-medium border border-zinc-200">{s}</span>
              ))}
            </div>
          )}

          {/* Links */}
          {(profile.githubUrl || profile.linkedinUrl || profile.portfolioUrl) && (
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-zinc-100">
              {profile.githubUrl && (
                <a href={profile.githubUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 text-sm font-medium transition-colors border border-zinc-200 hover:border-zinc-400 rounded-lg px-3 py-1.5">
                  {Icons.github} GitHub
                </a>
              )}
              {profile.linkedinUrl && (
                <a href={profile.linkedinUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 text-sm font-medium transition-colors border border-zinc-200 hover:border-zinc-400 rounded-lg px-3 py-1.5">
                  {Icons.linkedin} LinkedIn
                </a>
              )}
              {profile.portfolioUrl && (
                <a href={profile.portfolioUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 text-sm font-medium transition-colors border border-zinc-200 hover:border-zinc-400 rounded-lg px-3 py-1.5">
                  {Icons.globe} Portfolio
                </a>
              )}
            </div>
          )}

        </div>

        {/* ── Stats ── */}
        <div className="bg-white rounded-xl border border-zinc-200 mb-4">
          <div className="grid grid-cols-4 divide-x divide-zinc-100">
            {[
              { value: avgRating ? `${avgRating}` : '—', label: 'Avg Rating', color: 'text-zinc-900' },
              { value: profile.user?.totalJobsCompleted || 0, label: 'Jobs Done', color: 'text-zinc-900' },
              { value: `${profile.user?.onTimeDeliveryRate?.toFixed(0) || 0}%`, label: 'On-time', color: 'text-zinc-900' },
              { value: `${profile.user?.disputeRate?.toFixed(0) || 0}%`, label: 'Disputes', color: 'text-zinc-900' },
            ].map(stat => (
              <div key={stat.label} className="py-4 px-2 text-center">
                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-zinc-400 text-xs mt-0.5 leading-tight">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Badges ── */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-800">Badges & Achievements</h2>
            <span className="text-xs text-zinc-400">{earnedBadges.length} / {totalBadges} earned</span>
          </div>

          {earnedBadges.length === 0 && (
            <p className="text-sm text-zinc-400 italic">No badges earned yet.</p>
          )}

          {earnedBadges.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {earnedBadges.map(badge => {
                const c = BADGE_COLORS[badge.color]
                return (
                  <div key={badge.id} className={`flex items-start gap-2 border rounded-lg px-2.5 py-2 ${c.earned}`}>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${c.icon}`}>
                      {badge.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold leading-tight truncate">{badge.title}</p>
                      <p className="text-[10px] opacity-60 mt-0.5 leading-tight line-clamp-2">{badge.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Resume ── */}
        {profile.resumeUrl && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-zinc-800 mb-3">Resume</h2>
            <a href={`${FILE_BASE}${profile.resumeUrl}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2.5 border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-medium text-sm px-4 py-2.5 rounded-xl transition-colors">
              {Icons.download}
              Download Resume (PDF)
            </a>
          </div>
        )}

        {/* ── Portfolio Samples ── */}
        {profile.projectSamples?.length > 0 && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-800">Portfolio Samples</h2>
              <span className="text-xs text-zinc-400">{profile.projectSamples.length} project{profile.projectSamples.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-col gap-2">
              {profile.projectSamples.map((sample, i) => (
                <div key={i} className="flex items-center gap-3 bg-white border border-zinc-200 rounded-xl px-4 py-3 hover:border-zinc-300 transition-colors">
                  <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                    {Icons.paperclip}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{sample.title}</p>
                    {sample.description
                      ? <p className="text-xs text-zinc-500 mt-0.5 truncate">{sample.description}</p>
                      : sample.fileUrl && (
                        <a href={`${FILE_BASE}${sample.fileUrl}`} target="_blank" rel="noreferrer"
                          className="text-xs text-zinc-500 hover:text-zinc-700 mt-0.5 truncate block transition-colors">
                          View / Download
                        </a>
                      )
                    }
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {sample.description && sample.fileUrl && (
                      <a href={`${FILE_BASE}${sample.fileUrl}`} target="_blank" rel="noreferrer"
                        className="text-xs text-zinc-500 hover:text-zinc-700 font-medium transition-colors">
                        Download
                      </a>
                    )}
                    {sample.fileHash && (
                      <a href={`/verify/${sample.fileHash}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-zinc-900 text-white px-2.5 py-1 rounded-lg hover:bg-zinc-700 transition-colors font-medium">
                        {Icons.shield}
                        SHA-256
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

    </div>
  )
}
