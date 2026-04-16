import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

export default function ClientDashboard() {
  const [contracts, setContracts] = useState([])
  const [jobs, setJobs] = useState([])
  const [negotiations, setNegotiations] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.get('/api/contracts/my-contracts'),
      api.get('/api/jobs/my-jobs'),
      api.get('/api/negotiations/my-negotiations')
    ]).then(([c, j, n]) => {
      setContracts(c.data)
      setJobs(j.data)
      setNegotiations(n.data.filter(n => n.status === 'active'))
    }).catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  const allBids = jobs.flatMap(j => (j.bids || []).map(b => ({ ...b, job: j })))
  const interviewsToday = allBids.filter(b => {
    if (b.status !== 'interview_scheduled' || !b.interviewScheduledAt) return false
    const d = new Date(b.interviewScheduledAt)
    return d.toDateString() === new Date().toDateString()
  })
  const awaitingDecision = allBids.filter(b => b.status === 'interviewed')
  const activeContracts = contracts.filter(c => c.status === 'active')
  const totalValue = contracts.reduce((sum, c) => sum + (c.amount || 0), 0)
  const openJobs = jobs.filter(j => j.status === 'open')
  const pendingInterviews = allBids.filter(b => b.status === 'interview_scheduled').length
  const toReview = allBids.filter(b => b.status === 'applied').length

  const quickAction = async (jobId, bidId, endpoint) => {
    setActionLoading(bidId + endpoint)
    try {
      const { data } = await api.patch(`/api/jobs/${jobId}/applications/${bidId}/${endpoint}`)
      if (endpoint === 'negotiate') { navigate(`/negotiations/${data.negotiationId}`); return }
      setJobs(prev => prev.map(j => j._id !== jobId ? j : (data.job || data)))
      toast.success('Done')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally { setActionLoading(null) }
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-100"><Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-100">
      <Toaster />
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Welcome, {user.name}</h1>
            <p className="text-zinc-500 text-sm">Manage your contracts and jobs</p>
          </div>
          <div className="flex gap-2">
            <Link to="/freelancers" className="border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 px-4 py-2 rounded-lg font-medium text-sm transition-colors">
              Find Talent
            </Link>
            <Link to="/jobs/post" className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">
              + Post Job
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Active Contracts', value: activeContracts.length },
            { label: 'Total Value', value: `₹${totalValue.toLocaleString()}` },
            { label: 'Open Jobs', value: openJobs.length },
            { label: 'Interviews', value: pendingInterviews },
            { label: 'To Review', value: toReview },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-2xl font-bold text-zinc-900">{s.value}</div>
              <div className="text-zinc-500 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Interviews Today */}
        {interviewsToday.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Interviews Today</h2>
            {interviewsToday.map(b => (
              <div key={b._id} className="bg-white rounded-xl border border-zinc-200 p-4 mb-2 flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-zinc-900">{b.freelancer?.name}</div>
                  <div className="text-sm text-zinc-500">
                    {b.job.title} · {new Date(b.interviewScheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <Link
                  to={`/interview/${b.meetingRoomId}?job=${encodeURIComponent(b.job.title)}&jobId=${b.job._id}&bidId=${b._id}`}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                >
                  Join Interview
                </Link>
              </div>
            ))}
          </section>
        )}

        {/* Awaiting Decision */}
        {awaitingDecision.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Awaiting Your Decision</h2>
            {awaitingDecision.map(b => {
              const isLoading = (suf) => actionLoading === b._id + suf
              return (
                <div key={b._id} className="bg-white rounded-xl border border-zinc-200 p-4 mb-2 flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-zinc-900">{b.freelancer?.name}</div>
                    <div className="text-sm text-zinc-500">{b.job.title} · ₹{b.job.budget?.toLocaleString()}{b.freelancer?.rating > 0 ? ` · ★ ${b.freelancer.rating}` : ''}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => quickAction(b.job._id, b._id, 'hire')} disabled={isLoading('hire')}
                      className="bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
                      {isLoading('hire') ? '...' : 'Hire'}
                    </button>
                    <button onClick={() => quickAction(b.job._id, b._id, 'negotiate')} disabled={isLoading('negotiate')}
                      className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
                      {isLoading('negotiate') ? '...' : 'Negotiate'}
                    </button>
                    <button onClick={() => quickAction(b.job._id, b._id, 'reject')} disabled={isLoading('reject')}
                      className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* Active Contracts */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Active Contracts</h2>
          {activeContracts.length === 0
            ? <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center text-zinc-400 text-sm">No active contracts yet</div>
            : activeContracts.map(c => (
              <div key={c._id} className="bg-white rounded-xl border border-zinc-200 p-4 mb-2 flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-zinc-900">{c.job?.title || 'Contract'}</div>
                  <div className="text-sm text-zinc-500">with {c.freelancer?.name} · ₹{c.amount?.toLocaleString()} · {c.milestoneCount} phases</div>
                </div>
                <Link to={`/contracts/${c._id}`} className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0">
                  View Contract
                </Link>
              </div>
            ))
          }
        </section>

        {/* Open Negotiations */}
        {negotiations.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Open Negotiations</h2>
            {negotiations.map(n => (
              <div key={n._id} className="bg-white rounded-xl border border-zinc-200 p-4 mb-2 flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-zinc-900">{n.job?.title}</div>
                  <div className="text-sm text-zinc-500">Round {n.currentRound}/{n.maxRounds} · with {n.freelancer?.name}</div>
                </div>
                <Link to={`/negotiations/${n._id}`} className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0">
                  View
                </Link>
              </div>
            ))}
          </section>
        )}

        {/* Posted Jobs */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">My Posted Jobs</h2>
          {jobs.length === 0
            ? <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center text-zinc-400 text-sm">
                No jobs yet.{' '}
                <Link to="/jobs/post" className="text-zinc-900 font-medium underline underline-offset-2">Post your first job</Link>
              </div>
            : jobs.map(j => {
              const bids = j.bids || []
              const counts = {
                applied: bids.filter(b => b.status === 'applied').length,
                shortlisted: bids.filter(b => b.status === 'shortlisted').length,
                interview: bids.filter(b => b.status === 'interview_scheduled').length,
                hired: bids.filter(b => b.status === 'hired').length,
              }
              return (
                <div key={j._id} className="bg-white rounded-xl border border-zinc-200 p-4 mb-2 flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-zinc-900">{j.title}</div>
                    <div className="text-sm text-zinc-500 mt-0.5">₹{j.budget?.toLocaleString()} · <span className="capitalize">{j.status}</span></div>
                    <div className="flex gap-3 mt-1.5 text-xs text-zinc-400">
                      {counts.applied > 0 && <span>{counts.applied} applied</span>}
                      {counts.shortlisted > 0 && <span className="text-zinc-600">{counts.shortlisted} shortlisted</span>}
                      {counts.interview > 0 && <span className="text-zinc-600">{counts.interview} interview</span>}
                      {counts.hired > 0 && <span className="text-zinc-700">{counts.hired} hired</span>}
                      {bids.length === 0 && <span>No applications yet</span>}
                    </div>
                  </div>
                  <Link to={`/jobs/${j._id}`} className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0">
                    Manage
                  </Link>
                </div>
              )
            })
          }
        </section>
      </div>
    </div>
  )
}
