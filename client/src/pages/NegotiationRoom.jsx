import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

export default function NegotiationRoom() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [neg, setNeg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [counter, setCounter] = useState({ amount: '', timeline: '', scope: '', milestoneCount: 3, message: '' })
  const [showCounter, setShowCounter] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    try {
      const { data } = await api.get(`/api/negotiations/${id}`)
      setNeg(data)
      const last = data.rounds[data.rounds.length - 1]
      setCounter({ amount: last?.amount || '', timeline: last?.timeline || '', scope: last?.scope || '', milestoneCount: last?.milestoneCount || 3, message: '' })
    } catch { toast.error('Failed to load negotiation') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const respond = async (action) => {
    setSubmitting(true)
    try {
      const body = { action, ...(action === 'counter' ? counter : {}) }
      const { data } = await api.post(`/api/negotiations/${id}/respond`, body)
      if (action === 'accept' && data.contract) {
        toast.success('Agreement reached! Contract created.')
        setTimeout(() => navigate(`/contracts/${data.contract._id}`), 1000)
      } else {
        toast.success(action === 'reject' ? 'Negotiation rejected' : 'Counter-offer sent!')
        setNeg(data.negotiation || data)
        setShowCounter(false)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setSubmitting(false) }
  }

  const isMyTurn = neg && neg.status === 'active' && (() => {
    const last = neg.rounds[neg.rounds.length - 1]
    return last?.status === 'pending' && last?.proposedByRole !== user.role
  })()

  if (loading) return <div className="min-h-screen bg-slate-50"><Navbar /><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div></div>
  if (!neg) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Negotiation — {neg.job?.title}</h1>
              <p className="text-slate-500 text-sm mt-1">{neg.client?.name} (client) ↔ {neg.freelancer?.name} (freelancer)</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
              neg.status === 'active' ? 'bg-blue-100 text-blue-700' : neg.status === 'agreed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>{neg.status} • Round {neg.currentRound}/{neg.maxRounds}</span>
          </div>
        </div>

        {neg.status === 'agreed' && (
          <div className="bg-green-50 border border-green-300 rounded-2xl p-6 mb-6">
            <h2 className="text-green-800 font-bold text-lg mb-3">Agreement Reached!</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Amount:</span> <strong>₹{neg.agreedAmount?.toLocaleString()}</strong></div>
              <div><span className="text-slate-500">Timeline:</span> <strong>{neg.agreedTimeline} days</strong></div>
              <div><span className="text-slate-500">Phases:</span> <strong>{neg.agreedMilestoneCount}</strong></div>
              <div><span className="text-slate-500">Scope:</span> <strong className="text-xs">{neg.agreedScope?.substring(0, 60)}</strong></div>
            </div>
          </div>
        )}

        <div className="space-y-4 mb-6">
          {neg.rounds.map((round, idx) => (
            <div key={idx} className={`bg-white rounded-xl border p-5 ${round.proposedByRole === user.role ? 'border-indigo-200' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-slate-800">
                  Round {round.roundNumber} — <span className="capitalize">{round.proposedByRole}</span>
                  {round.proposedByRole === 'client' ? ` (${neg.client?.name})` : ` (${neg.freelancer?.name})`}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                  round.status === 'accepted' ? 'bg-green-100 text-green-700'
                  : round.status === 'rejected' ? 'bg-red-100 text-red-700'
                  : round.status === 'countered' ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-slate-100 text-slate-600'
                }`}>{round.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm mb-2">
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <div className="text-slate-500 text-xs">Amount</div>
                  <div className="font-bold text-indigo-600">₹{round.amount?.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <div className="text-slate-500 text-xs">Timeline</div>
                  <div className="font-bold text-slate-700">{round.timeline} days</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <div className="text-slate-500 text-xs">Phases</div>
                  <div className="font-bold text-slate-700">{round.milestoneCount}</div>
                </div>
              </div>
              {round.scope && <p className="text-sm text-slate-600 mt-1">{round.scope}</p>}
              {round.message && <p className="text-sm text-slate-500 italic mt-1">"{round.message}"</p>}
            </div>
          ))}
        </div>

        {isMyTurn && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Turn to Respond</h2>
            <div className="flex gap-3 mb-4">
              <button onClick={() => respond('accept')} disabled={submitting}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50">
                Accept Terms
              </button>
              <button onClick={() => setShowCounter(!showCounter)}
                className="flex-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold py-2.5 rounded-lg">
                Counter-Offer
              </button>
              <button onClick={() => respond('reject')} disabled={submitting}
                className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 font-semibold py-2.5 rounded-lg disabled:opacity-50">
                Reject
              </button>
            </div>
            {showCounter && (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Budget (₹)</label>
                    <input type="number" value={counter.amount} onChange={e => setCounter({ ...counter, amount: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Timeline (days)</label>
                    <input type="number" value={counter.timeline} onChange={e => setCounter({ ...counter, timeline: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Phases</label>
                    <select value={counter.milestoneCount} onChange={e => setCounter({ ...counter, milestoneCount: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value={3}>3 phases</option>
                      <option value={5}>5 phases</option>
                    </select>
                  </div>
                </div>
                <textarea value={counter.scope} onChange={e => setCounter({ ...counter, scope: e.target.value })} rows={2}
                  placeholder="Scope — what exactly will be delivered"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <textarea value={counter.message} onChange={e => setCounter({ ...counter, message: e.target.value })} rows={2}
                  placeholder="Your message with this counter-offer"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={() => respond('counter')} disabled={submitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50">
                  {submitting ? 'Sending...' : 'Send Counter-Offer'}
                </button>
              </div>
            )}
          </div>
        )}

        {neg.status === 'active' && !isMyTurn && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center text-blue-700 text-sm">
            Waiting for the other party to respond...
          </div>
        )}
      </div>
    </div>
  )
}
