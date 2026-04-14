import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

export default function FreelancerDashboard() {
  const [contracts, setContracts] = useState([])
  const [demos, setDemos] = useState([])
  const [negotiations, setNegotiations] = useState([])
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    Promise.all([
      api.get('/api/contracts/my-work'),
      api.get('/api/demos/incoming'),
      api.get('/api/negotiations/my-negotiations')
    ]).then(([c, d, n]) => {
      setContracts(c.data)
      setDemos(d.data.filter(d => d.status === 'pending'))
      setNegotiations(n.data.filter(n => n.status === 'active'))
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const handleDemoResponse = async (id, action) => {
    try {
      await api.patch(`/api/demos/${id}/${action}`, action === 'reject' ? { reason: 'Not available' } : {})
      setDemos(prev => prev.filter(d => d._id !== id))
      toast.success(action === 'accept' ? 'Demo accepted!' : 'Demo declined')
    } catch { toast.error('Failed to respond') }
  }

  const activeContracts = contracts.filter(c => c.status === 'active')
  const totalEarned = contracts.filter(c => c.status === 'completed').reduce((sum, c) => sum + c.amount, 0)

  if (loading) return (
    <div className="min-h-screen bg-slate-50"><Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Welcome, {user.name}</h1>
            <p className="text-slate-500 text-sm">Manage your work and earnings</p>
          </div>
          <Link to="/jobs" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">Browse Jobs</Link>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Active Contracts', value: activeContracts.length, color: 'text-indigo-600' },
            { label: 'Total Earned', value: `₹${totalEarned.toLocaleString()}`, color: 'text-emerald-600' },
            { label: 'All Contracts', value: contracts.length, color: 'text-orange-600' }
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-500 text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        {demos.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3">Demo Requests from Clients</h2>
            {demos.map(d => (
              <div key={d._id} className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{d.client?.name} wants a demo</div>
                    <div className="text-sm text-slate-500 mt-1">"{d.message}"</div>
                    {d.proposedAt && <div className="text-xs text-slate-400 mt-1">Proposed: {new Date(d.proposedAt).toLocaleString()}</div>}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => handleDemoResponse(d._id, 'accept')}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">Accept</button>
                    <button onClick={() => handleDemoResponse(d._id, 'reject')}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium">Decline</button>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {negotiations.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3">Open Negotiations</h2>
            {negotiations.map(n => (
              <div key={n._id} className="bg-white rounded-xl border border-orange-200 p-4 mb-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{n.job?.title}</div>
                  <div className="text-sm text-slate-500">Round {n.currentRound}/{n.maxRounds} • with {n.client?.name}</div>
                </div>
                <Link to={`/negotiations/${n._id}`} className="bg-orange-50 text-orange-700 px-4 py-1.5 rounded-lg text-sm font-medium">Respond</Link>
              </div>
            ))}
          </section>
        )}

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-3">My Contracts</h2>
          {contracts.length === 0
            ? <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400">
                No contracts yet. <Link to="/jobs" className="text-indigo-600">Browse jobs</Link>
              </div>
            : contracts.map(c => (
              <div key={c._id} className="bg-white rounded-xl border border-slate-200 p-4 mb-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{c.job?.title || 'Contract'}</div>
                  <div className="text-sm text-slate-500">with {c.client?.name} • ₹{c.amount?.toLocaleString()} • <span className="capitalize">{c.status}</span></div>
                </div>
                <Link to={`/contracts/${c._id}`} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-1.5 rounded-lg text-sm font-medium">View Work</Link>
              </div>
            ))
          }
        </section>
      </div>
    </div>
  )
}
