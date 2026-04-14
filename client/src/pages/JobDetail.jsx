import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

export default function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [job, setJob] = useState(null)
  const [bid, setBid] = useState({ amount: '', proposal: '' })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get(`/api/jobs/${id}`).then(({ data }) => setJob(data))
      .catch(() => toast.error('Job not found'))
      .finally(() => setLoading(false))
  }, [id])

  const handleBid = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post(`/api/jobs/${id}/bid`, bid)
      toast.success('Bid submitted!')
      const { data } = await api.get(`/api/jobs/${id}`)
      setJob(data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit bid')
    } finally { setSubmitting(false) }
  }

  const handleAcceptBid = async (bidId, freelancerId, bidAmount) => {
    try {
      await api.patch(`/api/jobs/${id}/accept/${bidId}`)
      toast.success('Bid accepted! Starting negotiation...')
      const neg = await api.post('/api/negotiations/start', {
        jobId: id, freelancerId,
        amount: bidAmount, timeline: 30,
        scope: job.description, milestoneCount: 3,
        message: 'Accepted your bid. Starting negotiation.'
      })
      setTimeout(() => navigate(`/negotiations/${neg.data._id}`), 1000)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept bid')
    }
  }

  const myBid = job?.bids?.find(b => b.freelancer?._id === user.id || b.freelancer === user.id)

  if (loading) return <div className="min-h-screen bg-slate-50"><Navbar /><div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div></div>
  if (!job) return <div className="min-h-screen bg-slate-50"><Navbar /><p className="text-center py-12 text-slate-500">Job not found</p></div>

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-800">{job.title}</h1>
          <div className="flex gap-4 mt-2 text-sm text-slate-500">
            <span>Budget: <strong className="text-slate-700">₹{job.budget?.toLocaleString()}</strong></span>
            <span>Deadline: <strong className="text-slate-700">{new Date(job.deadline).toLocaleDateString()}</strong></span>
            <span>Status: <strong className="capitalize text-slate-700">{job.status}</strong></span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {job.skills?.map(s => <span key={s} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">{s}</span>)}
          </div>
          <p className="mt-4 text-slate-600 leading-relaxed">{job.description}</p>
          {job.client && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm">
              <span className="text-slate-500">Posted by: </span>
              <span className="font-medium text-slate-700">{job.client.name}</span>
              {job.client.rating > 0 && <span className="ml-2 text-yellow-600">★ {job.client.rating}</span>}
            </div>
          )}
        </div>

        {user.role === 'freelancer' && job.status === 'open' && !myBid && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Place Your Bid</h2>
            <form onSubmit={handleBid} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your Price (₹)</label>
                <input type="number" required value={bid.amount}
                  onChange={e => setBid({ ...bid, amount: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your bid amount" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proposal</label>
                <textarea required rows={4} value={bid.proposal}
                  onChange={e => setBid({ ...bid, proposal: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Describe your approach, experience, and why you're the right fit..." />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Bid'}
              </button>
            </form>
          </div>
        )}

        {myBid && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-green-700 font-medium">Your bid: ₹{myBid.amount} — Status: <span className="capitalize">{myBid.status}</span></p>
          </div>
        )}

        {user.role === 'client' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Bids Received ({job.bids?.length || 0})</h2>
            {!job.bids?.length
              ? <p className="text-slate-400 text-center py-4">No bids yet</p>
              : job.bids.map(b => (
                <div key={b._id} className="border-b border-slate-100 pb-4 mb-4 last:border-0 last:mb-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">{b.freelancer?.name}</div>
                      {b.freelancer?.rating > 0 && <div className="text-yellow-600 text-sm">★ {b.freelancer.rating}</div>}
                      <div className="text-slate-600 mt-1 text-sm">{b.proposal}</div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-indigo-600">₹{b.amount?.toLocaleString()}</div>
                      {b.status === 'pending' && job.status === 'open' && (
                        <button onClick={() => handleAcceptBid(b._id, b.freelancer?._id, b.amount)}
                          className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                          Accept & Negotiate
                        </button>
                      )}
                      {b.status !== 'pending' && (
                        <span className={`text-xs font-medium capitalize ${b.status === 'accepted' ? 'text-green-600' : 'text-slate-400'}`}>{b.status}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
