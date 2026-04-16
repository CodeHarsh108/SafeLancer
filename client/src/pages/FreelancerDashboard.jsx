import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

const PIPELINE = [
  { key: 'applied', label: 'Applied' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'interview_scheduled', label: 'Interview' },
  { key: 'interviewed', label: 'Interviewed' },
  { key: 'hired', label: 'Hired' },
]

const STATUS_COLOR = {
  applied: 'bg-zinc-100 text-zinc-600',
  shortlisted: 'bg-zinc-800 text-white',
  interview_scheduled: 'bg-zinc-100 text-zinc-700',
  interviewed: 'bg-zinc-900 text-white',
  negotiating: 'bg-zinc-100 text-zinc-700',
  hired: 'bg-zinc-900 text-white',
  rejected: 'bg-zinc-200 text-zinc-600',
}

export default function FreelancerDashboard() {
  const [contracts, setContracts] = useState([])
  const [negotiations, setNegotiations] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    Promise.all([
      api.get('/api/contracts/my-work'),
      api.get('/api/negotiations/my-negotiations'),
      api.get('/api/jobs/my-applications')
    ]).then(([c, n, a]) => {
      setContracts(c.data)
      setNegotiations(n.data.filter(n => n.status === 'active'))
      setApplications(a.data)
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const activeContracts = contracts.filter(c => c.status === 'active')
  const totalEarned = contracts.filter(c => c.status === 'completed').reduce((sum, c) => sum + c.amount, 0)

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
            <p className="text-zinc-500 text-sm">Manage your work and earnings</p>
          </div>
          <Link to="/jobs" className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">
            Browse Jobs
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Active Contracts', value: activeContracts.length },
            { label: 'Total Earned', value: `₹${totalEarned.toLocaleString()}` },
            { label: 'All Contracts', value: contracts.length },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-2xl font-bold text-zinc-900">{s.value}</div>
              <div className="text-zinc-500 text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Applications */}
        {applications.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">My Applications ({applications.length})</h2>
            {applications.map(({ job, bid, contractId, negotiationId }) => (
              <div key={bid._id} className="bg-white rounded-xl border border-zinc-200 p-4 mb-2 flex items-start gap-4">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-zinc-900 truncate">{job.title}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${STATUS_COLOR[bid.status]}`}>
                      {bid.status === 'interview_scheduled' ? 'Interview Scheduled'
                        : bid.status === 'hired' ? 'Hired'
                        : bid.status === 'negotiating' ? 'In Negotiation'
                        : bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-500">{job.client?.name} · ₹{job.budget?.toLocaleString()}</div>

                  {/* Pipeline bar */}
                  <div className="flex gap-1 mt-2">
                    {PIPELINE.map((step) => {
                      const stepIndex = PIPELINE.findIndex(p => p.key === step.key)
                      const currentIndex = PIPELINE.findIndex(p => p.key === bid.status)
                      const isActive = step.key === bid.status
                      const isPast = currentIndex > stepIndex
                      return (
                        <div key={step.key}
                          className={`h-1 flex-1 rounded-full ${
                            isActive ? 'bg-zinc-900'
                            : isPast ? 'bg-zinc-300'
                            : 'bg-zinc-100'
                          }`}
                        />
                      )
                    })}
                  </div>

                  <div className="mt-3 space-y-2">
                    {bid.status === 'interview_scheduled' && bid.meetingRoomId && (
                      <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg flex items-center justify-between">
                        <p className="text-sm text-zinc-800 font-medium">
                          Interview at {new Date(bid.interviewScheduledAt).toLocaleString()}
                        </p>
                        <Link
                          to={`/interview/${bid.meetingRoomId}?job=${encodeURIComponent(job.title)}&jobId=${job._id}`}
                          className="bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                        >
                          Join
                        </Link>
                      </div>
                    )}
                    {bid.status === 'rejected' && bid.rejectionReason && (
                      <p className="text-sm text-zinc-500">Reason: {bid.rejectionReason}</p>
                    )}
                    {bid.status === 'hired' && contractId && (
                      <Link to={`/contracts/${contractId}`}
                        className="inline-block border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                        View Contract
                      </Link>
                    )}
                    {bid.status === 'negotiating' && negotiationId && (
                      <Link to={`/negotiations/${negotiationId}`}
                        className="inline-block border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                        View Negotiation
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Negotiations */}
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
                  <div className="text-sm text-zinc-500">Round {n.currentRound}/{n.maxRounds} · with {n.client?.name}</div>
                </div>
                <Link to={`/negotiations/${n._id}`} className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-1.5 rounded-lg text-sm font-medium flex-shrink-0">
                  Respond
                </Link>
              </div>
            ))}
          </section>
        )}

        {/* Contracts */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">My Contracts</h2>
          {contracts.length === 0
            ? <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center text-zinc-400 text-sm">
                No contracts yet.{' '}
                <Link to="/jobs" className="text-zinc-900 font-medium underline underline-offset-2">Browse jobs</Link>
              </div>
            : contracts.map(c => (
              <div key={c._id} className="bg-white rounded-xl border border-zinc-200 p-4 mb-2 flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-zinc-900">{c.job?.title || 'Contract'}</div>
                  <div className="text-sm text-zinc-500">with {c.client?.name} · ₹{c.amount?.toLocaleString()} · <span className="capitalize">{c.status}</span></div>
                </div>
                <Link to={`/contracts/${c._id}`} className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-1.5 rounded-lg text-sm font-medium flex-shrink-0">
                  View Work
                </Link>
              </div>
            ))
          }
        </section>
      </div>
    </div>
  )
}
