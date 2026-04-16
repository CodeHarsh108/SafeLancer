import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

const STATUS_LABELS = {
  applied: { label: 'Applied', color: 'bg-zinc-100 text-zinc-600' },
  shortlisted: { label: 'Shortlisted', color: 'bg-blue-50 text-blue-700' },
  interview_scheduled: { label: 'Interview Scheduled', color: 'bg-amber-50 text-amber-700' },
  interviewed: { label: 'Interviewed', color: 'bg-purple-50 text-purple-700' },
  negotiating: { label: 'In Negotiation', color: 'bg-orange-50 text-orange-700' },
  hired: { label: 'Hired', color: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-600' },
}

const TABS = ['All', 'Applied', 'Shortlisted', 'Interview', 'Interviewed']
const TAB_STATUS = {
  All: null,
  Applied: ['applied'],
  Shortlisted: ['shortlisted'],
  Interview: ['interview_scheduled'],
  Interviewed: ['interviewed'],
}

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const [job, setJob] = useState(null)
  const [proposal, setProposal] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('All')
  const [actionLoading, setActionLoading] = useState(null)
  const [schedulingBidId, setSchedulingBidId] = useState(null)
  const [scheduledAt, setScheduledAt] = useState('')

  const reload = () =>
    api.get(`/api/jobs/${id}`)
      .then(({ data }) => setJob(data))
      .catch(() => toast.error('Job not found'))

  useEffect(() => { reload().finally(() => setLoading(false)) }, [id])

  const handleApply = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post(`/api/jobs/${id}/apply`, { proposal })
      toast.success('Application submitted!')
      await reload()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply')
    } finally { setSubmitting(false) }
  }

  const action = async (bidId, endpoint, body = {}) => {
    setActionLoading(bidId + endpoint)
    try {
      const { data } = await api.patch(`/api/jobs/${id}/applications/${bidId}/${endpoint}`, body)
      setJob(data.job || data)
      toast.success('Done')
      return data
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally { setActionLoading(null) }
  }

  const handleSchedule = async (bidId) => {
    if (!scheduledAt) return toast.error('Pick a date and time')
    setActionLoading(bidId + 'schedule')
    try {
      const { data } = await api.patch(`/api/jobs/${id}/applications/${bidId}/schedule-interview`, { scheduledAt })
      setJob(data)
      setSchedulingBidId(null)
      setScheduledAt('')
      toast.success('Interview scheduled!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule')
    } finally { setActionLoading(null) }
  }

  const handleNegotiate = async (bidId) => {
    setActionLoading(bidId + 'negotiate')
    try {
      const { data } = await api.patch(`/api/jobs/${id}/applications/${bidId}/negotiate`)
      toast.success('Negotiation started!')
      setTimeout(() => navigate(`/negotiations/${data.negotiationId}`), 800)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start negotiation')
    } finally { setActionLoading(null) }
  }

  const myBid = job?.bids?.find(b => b.freelancer?._id === user.id || b.freelancer === user.id)
  const filteredBids = () => {
    if (!job?.bids) return []
    const statuses = TAB_STATUS[activeTab]
    if (!statuses) return job.bids
    return job.bids.filter(b => statuses.includes(b.status))
  }
  const tabCount = (tab) => {
    if (!job?.bids) return 0
    const statuses = TAB_STATUS[tab]
    if (!statuses) return job.bids.length
    return job.bids.filter(b => statuses.includes(b.status)).length
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-100"><Navbar />
      <div className="flex justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" />
      </div>
    </div>
  )
  if (!job) return (
    <div className="min-h-screen bg-zinc-100"><Navbar />
      <p className="text-center py-12 text-zinc-500">Job not found</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-100">
      <Toaster />
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">

        {/* Job card */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-5">
          <h1 className="text-xl font-semibold text-zinc-900">{job.title}</h1>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-zinc-500">
            <span>Fixed Budget: <strong className="text-zinc-700">₹{job.budget?.toLocaleString()}</strong></span>
            <span>Deadline: <strong className="text-zinc-700">{new Date(job.deadline).toLocaleDateString()}</strong></span>
            <span>Status: <strong className="capitalize text-zinc-700">{job.status}</strong></span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {job.skills?.map(s => (
              <span key={s} className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-xs font-medium">{s}</span>
            ))}
          </div>
          <p className="mt-4 text-zinc-600 leading-relaxed text-sm">{job.description}</p>
          {job.client && (
            <div className="mt-4 p-3 bg-zinc-50 rounded-lg text-sm border border-zinc-100">
              <span className="text-zinc-500">Posted by: </span>
              {user.role === 'freelancer'
                ? <Link to={`/clients/${job.client._id}`} className="font-medium text-zinc-700 hover:text-zinc-900 hover:underline underline-offset-2 transition-colors">{job.client.name}</Link>
                : <span className="font-medium text-zinc-700">{job.client.name}</span>
              }
              {job.client.rating > 0 && <span className="ml-2 text-amber-600 text-xs">★ {job.client.rating}</span>}
            </div>
          )}
        </div>

        {/* Freelancer: apply */}
        {user.role === 'freelancer' && job.status === 'open' && !myBid && (
          <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-5">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Apply for this Job</h2>
            <p className="text-sm text-zinc-500 mb-4">Fixed budget: ₹{job.budget?.toLocaleString()} — set by client</p>
            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Your Proposal</label>
                <textarea required rows={5} value={proposal}
                  onChange={e => setProposal(e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
                  placeholder="Describe your approach, experience, and why you're the right fit..." />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Apply Now'}
              </button>
            </form>
          </div>
        )}

        {/* My bid status */}
        {myBid && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-zinc-900">Your Application</h2>
              <span className={`text-xs font-medium px-2 py-1 rounded-md ${STATUS_LABELS[myBid.status]?.color}`}>
                {STATUS_LABELS[myBid.status]?.label}
              </span>
            </div>
            <p className="text-zinc-600 text-sm leading-relaxed">{myBid.proposal}</p>
            {myBid.status === 'interview_scheduled' && myBid.meetingRoomId && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                <p className="text-sm text-amber-800 font-medium">
                  Interview at {new Date(myBid.interviewScheduledAt).toLocaleString()}
                </p>
                <Link
                  to={`/interview/${myBid.meetingRoomId}?job=${encodeURIComponent(job.title)}&jobId=${job._id}`}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                  Join
                </Link>
              </div>
            )}
            {myBid.status === 'rejected' && myBid.rejectionReason && (
              <p className="mt-2 text-sm text-red-500">Reason: {myBid.rejectionReason}</p>
            )}
          </div>
        )}

        {/* Client: pipeline */}
        {user.role === 'client' && (
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-4">
              Applications ({job.bids?.length || 0})
            </h2>

            {/* Tabs */}
            <div className="flex gap-1 mb-5 overflow-x-auto border-b border-zinc-100 pb-0">
              {TABS.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    activeTab === tab
                      ? 'border-zinc-900 text-zinc-900'
                      : 'border-transparent text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {tab} <span className="text-xs text-zinc-400">({tabCount(tab)})</span>
                </button>
              ))}
            </div>

            {filteredBids().length === 0
              ? <p className="text-zinc-400 text-center py-6 text-sm">No applications in this stage</p>
              : filteredBids().map(b => {
                const isLoading = (suf) => actionLoading === b._id + suf
                const badge = STATUS_LABELS[b.status]
                return (
                  <div key={b._id} className="border border-zinc-100 rounded-xl p-4 mb-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link to={`/freelancers/${b.freelancer?._id}`} className="font-medium text-zinc-900 hover:underline underline-offset-2 transition-colors">{b.freelancer?.name}</Link>
                          {b.freelancer?.rating > 0 && (
                            <span className="text-amber-600 text-xs">★ {b.freelancer.rating}</span>
                          )}
                          {b.freelancer?.totalJobsCompleted > 0 && (
                            <span className="text-zinc-400 text-xs">{b.freelancer.totalJobsCompleted} jobs</span>
                          )}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${badge?.color}`}>
                            {badge?.label}
                          </span>
                        </div>
                        <p className="text-zinc-500 text-sm leading-relaxed line-clamp-3">{b.proposal}</p>
                        {b.status === 'interview_scheduled' && (
                          <p className="text-xs text-amber-700 mt-1 font-medium">
                            Interview: {new Date(b.interviewScheduledAt).toLocaleString()}
                          </p>
                        )}
                        {b.status === 'rejected' && b.rejectionReason && (
                          <p className="text-xs text-red-500 mt-1">Reason: {b.rejectionReason}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {b.status === 'applied' && (
                        <>
                          <button onClick={() => action(b._id, 'shortlist')} disabled={isLoading('shortlist')}
                            className="bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                            {isLoading('shortlist') ? '...' : 'Shortlist'}
                          </button>
                          <button onClick={() => action(b._id, 'reject')} disabled={isLoading('reject')}
                            className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                            Reject
                          </button>
                        </>
                      )}
                      {b.status === 'shortlisted' && (
                        <>
                          {schedulingBidId === b._id ? (
                            <div className="flex items-center gap-2">
                              <input type="datetime-local" value={scheduledAt}
                                onChange={e => setScheduledAt(e.target.value)}
                                className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-400 transition-colors" />
                              <button onClick={() => handleSchedule(b._id)} disabled={isLoading('schedule')}
                                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
                                {isLoading('schedule') ? '...' : 'Confirm'}
                              </button>
                              <button onClick={() => setSchedulingBidId(null)}
                                className="text-zinc-400 hover:text-zinc-600 text-sm">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setSchedulingBidId(b._id)}
                              className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                              Schedule Interview
                            </button>
                          )}
                          <button onClick={() => action(b._id, 'reject')} disabled={isLoading('reject')}
                            className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                            Reject
                          </button>
                        </>
                      )}
                      {b.status === 'interview_scheduled' && (
                        <>
                          <Link
                            to={`/interview/${b.meetingRoomId}?job=${encodeURIComponent(job.title)}&jobId=${job._id}&bidId=${b._id}`}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                            Join Interview
                          </Link>
                          <button onClick={() => action(b._id, 'interview-done')} disabled={isLoading('interview-done')}
                            className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                            {isLoading('interview-done') ? '...' : 'Mark Done'}
                          </button>
                        </>
                      )}
                      {b.status === 'interviewed' && (
                        <>
                          <button onClick={() => action(b._id, 'hire')} disabled={isLoading('hire')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                            {isLoading('hire') ? '...' : `Hire — ₹${job.budget?.toLocaleString()}`}
                          </button>
                          <button onClick={() => handleNegotiate(b._id)} disabled={isLoading('negotiate')}
                            className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                            {isLoading('negotiate') ? '...' : 'Negotiate'}
                          </button>
                          <button onClick={() => action(b._id, 'reject')} disabled={isLoading('reject')}
                            className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                            Reject
                          </button>
                        </>
                      )}
                      {b.status === 'negotiating' && (
                        <Link to={`/negotiations`}
                          className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                          View Negotiation
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })
            }
          </div>
        )}
      </div>
    </div>
  )
}
