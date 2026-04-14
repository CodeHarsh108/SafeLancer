import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

export default function ClientDashboard() {
  const [contracts, setContracts] = useState([])
  const [jobs, setJobs] = useState([])
  const [demos, setDemos] = useState([])
  const [negotiations, setNegotiations] = useState([])
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    Promise.all([
      api.get('/api/contracts/my-contracts'),
      api.get('/api/jobs/my-jobs'),
      api.get('/api/demos/my-requests'),
      api.get('/api/negotiations/my-negotiations')
    ]).then(([c, j, d, n]) => {
      setContracts(c.data)
      setJobs(j.data)
      setDemos(d.data.filter(d => d.status === 'accepted'))
      setNegotiations(n.data.filter(n => n.status === 'active'))
    }).catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  const activeContracts = contracts.filter(c => c.status === 'active')
  const totalValue = contracts.reduce((sum, c) => sum + (c.amount || 0), 0)

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
            <p className="text-slate-500 text-sm">Manage your contracts and jobs</p>
          </div>
          <div className="flex gap-2">
            <Link to="/browse" className="border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg font-medium text-sm transition-colors">Find Talent</Link>
            <Link to="/post-job" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">+ Post Job</Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Active Contracts', value: activeContracts.length, color: 'text-indigo-600' },
            { label: 'Total Value', value: `₹${totalValue.toLocaleString()}`, color: 'text-emerald-600' },
            { label: 'Jobs Posted', value: jobs.length, color: 'text-orange-600' }
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-500 text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        <section className="mb-6">
          <h2 className="text-lg font-bold text-slate-800 mb-3">Active Contracts</h2>
          {activeContracts.length === 0
            ? <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400">No active contracts yet</div>
            : activeContracts.map(c => (
              <div key={c._id} className="bg-white rounded-xl border border-slate-200 p-4 mb-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{c.job?.title || 'Contract'}</div>
                  <div className="text-sm text-slate-500">with {c.freelancer?.name} • ₹{c.amount?.toLocaleString()} • {c.milestoneCount} phases</div>
                </div>
                <Link to={`/contracts/${c._id}`} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  View Contract
                </Link>
              </div>
            ))
          }
        </section>

        {negotiations.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3">Open Negotiations</h2>
            {negotiations.map(n => (
              <div key={n._id} className="bg-white rounded-xl border border-orange-200 p-4 mb-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{n.job?.title}</div>
                  <div className="text-sm text-slate-500">Round {n.currentRound}/{n.maxRounds} • with {n.freelancer?.name}</div>
                </div>
                <Link to={`/negotiations/${n._id}`} className="bg-orange-50 text-orange-700 hover:bg-orange-100 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  View
                </Link>
              </div>
            ))}
          </section>
        )}

        {demos.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3">Upcoming Demo Meetings</h2>
            {demos.map(d => (
              <div key={d._id} className="bg-green-50 rounded-xl border border-green-200 p-4 mb-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">Demo with {d.freelancer?.name}</div>
                  <div className="text-sm text-slate-500">{d.meetingAt ? new Date(d.meetingAt).toLocaleString() : 'Time TBD'}</div>
                </div>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">Accepted</span>
              </div>
            ))}
          </section>
        )}

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-3">My Posted Jobs</h2>
          {jobs.length === 0
            ? <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400">
                No jobs yet. <Link to="/post-job" className="text-indigo-600">Post your first job</Link>
              </div>
            : jobs.map(j => (
              <div key={j._id} className="bg-white rounded-xl border border-slate-200 p-4 mb-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{j.title}</div>
                  <div className="text-sm text-slate-500">₹{j.budget?.toLocaleString()} • {j.bids?.length || 0} bids • <span className="capitalize">{j.status}</span></div>
                </div>
                <Link to={`/jobs/${j._id}`} className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
                  View Bids
                </Link>
              </div>
            ))
          }
        </section>
      </div>
    </div>
  )
}
