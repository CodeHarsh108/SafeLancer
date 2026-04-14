import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

const FILE_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

export default function FreelancerProfile() {
  const { userId } = useParams()
  const me = JSON.parse(localStorage.getItem('user') || '{}')
  const [profile, setProfile] = useState(null)
  const [ratings, setRatings] = useState([])
  const [loading, setLoading] = useState(true)
  const [demoModal, setDemoModal] = useState(false)
  const [demoForm, setDemoForm] = useState({ message: '', proposedAt: '' })

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

  const sendDemoRequest = async () => {
    if (!demoForm.message) return toast.error('Please describe what you want to see')
    try {
      await api.post('/api/demos/request', { freelancerId: userId, message: demoForm.message, proposedAt: demoForm.proposedAt })
      toast.success('Demo request sent!')
      setDemoModal(false)
      setDemoForm({ message: '', proposedAt: '' })
    } catch { toast.error('Failed to send demo request') }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    </div>
  )

  if (!profile) return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <p className="text-center py-12 text-slate-500">Profile not found</p>
    </div>
  )

  const avgRating = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1)
    : null

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">

        {/* Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {profile.user?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">{profile.user?.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  {avgRating && (
                    <span className="text-yellow-600 font-semibold">★ {avgRating} <span className="text-slate-400 font-normal text-sm">({ratings.length} reviews)</span></span>
                  )}
                  {profile.user?.totalJobsCompleted > 0 && (
                    <span className="text-slate-500 text-sm">{profile.user.totalJobsCompleted} jobs completed</span>
                  )}
                  <span className={`capitalize text-xs px-2 py-0.5 rounded-full ${
                    profile.availability === 'full-time' ? 'bg-green-100 text-green-700'
                    : profile.availability === 'part-time' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}>{profile.availability || 'full-time'}</span>
                </div>
                {profile.hourlyRate > 0 && (
                  <p className="text-slate-500 text-sm mt-1">Rate: <strong className="text-slate-700">₹{profile.hourlyRate}/hr</strong></p>
                )}
              </div>
            </div>
            {me.role === 'client' && (
              <button onClick={() => setDemoModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors">
                Request Demo
              </button>
            )}
          </div>

          {profile.bio && (
            <p className="text-slate-600 mt-4 leading-relaxed">{profile.bio}</p>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {profile.skills?.map(s => (
              <span key={s} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">{s}</span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4">
            {profile.githubUrl && (
              <a href={profile.githubUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 text-sm transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                GitHub
              </a>
            )}
            {profile.linkedinUrl && (
              <a href={profile.linkedinUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-blue-600 text-sm transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </a>
            )}
            {profile.portfolioUrl && (
              <a href={profile.portfolioUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 text-sm transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Portfolio
              </a>
            )}
          </div>
        </div>

        {/* Stats */}
        {(profile.user?.onTimeDeliveryRate > 0 || profile.user?.disputeRate >= 0) && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{profile.user?.onTimeDeliveryRate?.toFixed(0) || 0}%</div>
              <div className="text-slate-500 text-sm">On-time Delivery</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{profile.user?.totalJobsCompleted || 0}</div>
              <div className="text-slate-500 text-sm">Jobs Completed</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-2xl font-bold text-red-500">{profile.user?.disputeRate?.toFixed(0) || 0}%</div>
              <div className="text-slate-500 text-sm">Dispute Rate</div>
            </div>
          </div>
        )}

        {/* Resume */}
        {profile.resumeUrl && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3">Resume</h2>
            <a
              href={`${FILE_BASE}${profile.resumeUrl}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Download Resume (PDF)
            </a>
          </div>
        )}

        {/* Portfolio Samples */}
        {profile.projectSamples?.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Portfolio Samples</h2>
            <div className="space-y-3">
              {profile.projectSamples.map((sample, i) => (
                <div key={i} className="border border-slate-100 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800">{sample.title}</h3>
                      {sample.description && (
                        <p className="text-sm text-slate-500 mt-1">{sample.description}</p>
                      )}
                      {sample.fileUrl && (
                        <a
                          href={`${FILE_BASE}${sample.fileUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:underline text-sm mt-2 font-medium"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          View / Download
                        </a>
                      )}
                    </div>
                    {sample.fileHash && (
                      <a
                        href={`/verify/${sample.fileHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-shrink-0 text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full hover:bg-green-100 transition-colors font-medium"
                      >
                        SHA-256 Verified ✓
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {ratings.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Client Reviews</h2>
            <div className="space-y-4">
              {ratings.map(r => (
                <div key={r._id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-700">{r.ratedBy?.name}</span>
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map(star => (
                        <span key={star} className={star <= r.stars ? 'text-yellow-400' : 'text-slate-200'}>★</span>
                      ))}
                      <span className="text-slate-500 text-sm ml-1">({r.stars}/5)</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs text-slate-500 mb-2">
                    <span>Communication: {r.communication}/5</span>
                    <span>Quality: {r.quality}/5</span>
                    <span>Timeliness: {r.timeliness}/5</span>
                    <span>Professional: {r.professionalism}/5</span>
                  </div>
                  {r.review && <p className="text-sm text-slate-600 italic">"{r.review}"</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Demo Modal */}
      {demoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Request Demo from {profile.user?.name}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">What do you want to see?</label>
                <textarea value={demoForm.message} onChange={e => setDemoForm({ ...demoForm, message: e.target.value })} rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. I want to see your React dashboard and how you structure components" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Proposed Meeting Time</label>
                <input type="datetime-local" value={demoForm.proposedAt} onChange={e => setDemoForm({ ...demoForm, proposedAt: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3">
                <button onClick={sendDemoRequest}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors">
                  Send Request
                </button>
                <button onClick={() => setDemoModal(false)}
                  className="flex-1 border border-slate-300 text-slate-600 font-semibold py-2.5 rounded-lg hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
