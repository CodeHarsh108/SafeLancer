import { useState, useEffect } from 'react'
import api from '../api'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('verification')
  const [pendingFreelancers, setPendingFreelancers] = useState([])
  const [stats, setStats] = useState(null)
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})

  const loadData = async () => {
    setLoading(true)
    try {
      const [statsRes, pendingRes, disputesRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/freelancers/pending'),
        api.get('/api/disputes/admin/all')
      ])
      setStats(statsRes.data)
      setPendingFreelancers(pendingRes.data)
      setDisputes(disputesRes.data)
    } catch (err) {
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleVerify = async (userId, status) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }))
    try {
      await api.post(`/api/admin/freelancers/${userId}/verify`, { status })
      toast.success(`Freelancer ${status}`)
      setPendingFreelancers(prev => prev.filter(f => f._id !== userId))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed')
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }))
    }
  }

  const resolveDispute = async (id, resolution, splitPercent) => {
    try {
      await api.patch(`/api/disputes/${id}/resolve`, { resolution, splitPercent })
      toast.success('Dispute resolved!')
      loadData()
    } catch { toast.error('Failed to resolve') }
  }

  const [splits, setSplits] = useState({})

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-zinc-900 mb-5">Admin Dashboard</h1>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-2xl font-bold text-zinc-900">{stats.users.total}</div>
              <div className="text-zinc-500 text-sm">Total Users</div>
              <div className="text-xs text-zinc-400 mt-1">{stats.users.freelancers} freelancers · {stats.users.clients} clients</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-2xl font-bold text-zinc-900">{stats.jobs.total}</div>
              <div className="text-zinc-500 text-sm">Total Jobs</div>
              <div className="text-xs text-zinc-400 mt-1">{stats.jobs.open} open · {stats.jobs.inProgress} in progress</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className={`text-2xl font-bold ${stats.disputes.open > 0 ? 'text-red-600' : 'text-zinc-900'}`}>{stats.disputes.open}</div>
              <div className="text-zinc-500 text-sm">Open Disputes</div>
              <div className="text-xs text-zinc-400 mt-1">{stats.disputes.total} total</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-2xl font-bold text-amber-600">{stats.pendingVerifications}</div>
              <div className="text-zinc-500 text-sm">Pending Verifications</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-zinc-200 mb-5">
          {['verification', 'disputes', 'stats'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab ? 'text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab: Verification */}
        {activeTab === 'verification' && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-600 mb-3">Freelancer Verification Requests</h2>
            {loading ? (
              <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" /></div>
            ) : pendingFreelancers.length === 0 ? (
              <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center text-zinc-400 text-sm">No pending verification requests</div>
            ) : (
              <div className="space-y-4">
                {pendingFreelancers.map(f => (
                  <div key={f._id} className="bg-white rounded-xl border border-zinc-200 p-5">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-medium text-zinc-900">{f.name}</div>
                        <div className="text-sm text-zinc-500">{f.email}</div>
                        <div className="mt-3 space-y-1 text-sm">
                          {f.linkedin && (
                            <div><span className="font-medium text-zinc-600">LinkedIn:</span> <a href={f.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{f.linkedin}</a></div>
                          )}
                          {f.github && (
                            <div><span className="font-medium text-zinc-600">GitHub:</span> <a href={f.github} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{f.github}</a></div>
                          )}
                          {f.portfolio && (
                            <div><span className="font-medium text-zinc-600">Portfolio:</span> <a href={f.portfolio} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{f.portfolio}</a></div>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 mt-2">Joined: {new Date(f.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div className="flex gap-2 items-start">
                        <button
                          onClick={() => handleVerify(f._id, 'approved')}
                          disabled={actionLoading[f._id]}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleVerify(f._id, 'rejected')}
                          disabled={actionLoading[f._id]}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Disputes (unchanged from your original) */}
        {activeTab === 'disputes' && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-600 mb-3">Open Disputes</h2>
            {loading ? (
              <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" /></div>
            ) : disputes.filter(d => d.status === 'open').length === 0 ? (
              <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center text-zinc-400 text-sm">No open disputes</div>
            ) : (
              disputes.filter(d => d.status === 'open').map(d => (
                <div key={d._id} className="bg-white rounded-xl border border-red-200 p-5 mb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-zinc-900 flex items-center gap-2">
                        {d.type === 'milestone' ? 'Milestone Dispute' : 'Manual Dispute'}
                        {d.contract?.hashId && <span className="text-xs text-zinc-400 font-mono">#{d.contract.hashId}</span>}
                      </div>
                      {d.milestone && <div className="text-sm text-zinc-500 mt-0.5">{d.milestone.title} · ₹{d.milestone.amount?.toLocaleString()}</div>}
                      <div className="text-sm text-zinc-500">Raised by: {d.raisedBy?.name} ({d.raisedBy?.role})</div>
                    </div>
                    <span className="bg-red-50 text-red-600 text-xs px-2 py-1 rounded-md font-medium">Open</span>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-3 text-sm text-red-700">
                    <strong>Reason:</strong> {d.reason}
                  </div>
                  {d.evidence?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-zinc-500 mb-1">Evidence:</p>
                      {d.evidence.map((e, i) => <p key={i} className="text-sm text-zinc-600 bg-zinc-50 rounded-lg p-2 mb-1">{e.description}</p>)}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap items-center">
                    <button onClick={() => resolveDispute(d._id, 'release_to_freelancer')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Release to Freelancer</button>
                    <button onClick={() => resolveDispute(d._id, 'refund_to_client')}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Refund to Client</button>
                    <div className="flex items-center gap-2 border-l border-zinc-200 pl-3">
                      <input type="number" min="0" max="100" placeholder="Freelancer %" value={splits[d._id] || ''}
                        onChange={e => setSplits({ ...splits, [d._id]: e.target.value })}
                        className="border border-zinc-200 rounded-lg px-2 py-2 text-sm w-28" />
                      <button onClick={() => resolveDispute(d._id, 'split', Number(splits[d._id]))}
                        disabled={!splits[d._id]} className="bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                        Split
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Stats (detailed) */}
        {activeTab === 'stats' && stats && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-600 mb-4">Platform Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><span className="font-medium">Total Users:</span> {stats.users.total}</div>
              <div><span className="font-medium">Freelancers:</span> {stats.users.freelancers}</div>
              <div><span className="font-medium">Clients:</span> {stats.users.clients}</div>
              <div><span className="font-medium">Total Jobs:</span> {stats.jobs.total}</div>
              <div><span className="font-medium">Open Jobs:</span> {stats.jobs.open}</div>
              <div><span className="font-medium">In Progress:</span> {stats.jobs.inProgress}</div>
              <div><span className="font-medium">Completed Jobs:</span> {stats.jobs.completed}</div>
              <div><span className="font-medium">Total Contracts:</span> {stats.contracts.total}</div>
              <div><span className="font-medium">Total Disputes:</span> {stats.disputes.total}</div>
              <div><span className="font-medium">Open Disputes:</span> {stats.disputes.open}</div>
              <div><span className="font-medium">Pending Verifications:</span> {stats.pendingVerifications}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}