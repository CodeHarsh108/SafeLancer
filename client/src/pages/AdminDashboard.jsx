import { useState, useEffect } from 'react'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

export default function AdminDashboard() {
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [splits, setSplits] = useState({})

  const load = async () => {
    try {
      const { data } = await api.get('/api/disputes/admin/all')
      setDisputes(data)
    } catch { toast.error('Failed to load disputes') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const resolve = async (id, resolution, splitPercent) => {
    try {
      await api.patch(`/api/disputes/${id}/resolve`, { resolution, splitPercent })
      toast.success('Dispute resolved!')
      await load()
    } catch { toast.error('Failed to resolve') }
  }

  const openDisputes = disputes.filter(d => d.status === 'open')
  const resolved = disputes.filter(d => d.status === 'resolved')

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Admin Dashboard</h1>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Open Disputes', value: openDisputes.length, color: 'text-red-600' },
            { label: 'Resolved', value: resolved.length, color: 'text-green-600' },
            { label: 'Total', value: disputes.length, color: 'text-indigo-600' }
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-500 text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        <h2 className="text-lg font-bold text-slate-800 mb-3">Open Disputes</h2>
        {loading
          ? <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>
          : openDisputes.length === 0
          ? <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400">No open disputes</div>
          : openDisputes.map(d => (
            <div key={d._id} className="bg-white rounded-xl border border-red-200 p-5 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-2">
                    {d.type === 'milestone' ? 'Milestone Dispute (Auto)' : 'Manual Dispute'}
                    {d.contract?.hashId && <span className="text-xs text-slate-400 font-mono">#{d.contract.hashId}</span>}
                  </div>
                  {d.milestone && <div className="text-sm text-slate-500">{d.milestone.title} • ₹{d.milestone.amount?.toLocaleString()}</div>}
                  <div className="text-sm text-slate-500 mt-0.5">Raised by: {d.raisedBy?.name} ({d.raisedBy?.role})</div>
                </div>
                <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium">Open</span>
              </div>
              <div className="bg-red-50 rounded-lg p-3 mb-3 text-sm text-red-700">
                <strong>Reason:</strong> {d.reason}
              </div>
              {d.evidence?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">Evidence submitted:</p>
                  {d.evidence.map((e, i) => <p key={i} className="text-sm text-slate-600 bg-slate-50 rounded p-2 mb-1">{e.description}</p>)}
                </div>
              )}
              <div className="flex gap-2 flex-wrap items-center">
                <button onClick={() => resolve(d._id, 'release_to_freelancer')}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Release to Freelancer
                </button>
                <button onClick={() => resolve(d._id, 'refund_to_client')}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Refund to Client
                </button>
                <div className="flex items-center gap-2 border-l pl-2">
                  <input type="number" min="0" max="100" placeholder="Freelancer %" value={splits[d._id] || ''}
                    onChange={e => setSplits({ ...splits, [d._id]: e.target.value })}
                    className="border border-slate-300 rounded-lg px-2 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button onClick={() => resolve(d._id, 'split', Number(splits[d._id]))}
                    disabled={!splits[d._id]}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                    Apply Split
                  </button>
                </div>
              </div>
            </div>
          ))
        }

        {resolved.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-slate-800 mb-3 mt-6">Resolved</h2>
            {resolved.map(d => (
              <div key={d._id} className="bg-white rounded-xl border border-slate-200 p-4 mb-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-700">{d.contract?.hashId && `#${d.contract.hashId}`} — {d.reason?.substring(0, 70)}</div>
                  <div className="text-sm text-slate-400 capitalize">Resolution: {d.resolution?.replace(/_/g, ' ')}</div>
                </div>
                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Resolved</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
