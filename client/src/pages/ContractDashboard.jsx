import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

const statusColors = {
  pending_deposit: 'bg-gray-100 text-gray-600',
  funded: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  submitted: 'bg-orange-100 text-orange-700',
  review: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  inaccurate_1: 'bg-red-100 text-red-600',
  inaccurate_2: 'bg-red-200 text-red-800',
  disputed: 'bg-red-100 text-red-800',
  released: 'bg-emerald-100 text-emerald-700',
  refunded: 'bg-gray-100 text-gray-500',
}

export default function ContractDashboard() {
  const { id } = useParams()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [contract, setContract] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [reviewForms, setReviewForms] = useState({})
  const [submitForms, setSubmitForms] = useState({})

  const load = async () => {
    try {
      const { data } = await api.get(`/api/contracts/${id}`)
      setContract(data.contract)
      setMilestones(data.milestones)
    } catch { toast.error('Failed to load contract') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const doAction = async (milestoneId, action, body = {}) => {
    setActionLoading(milestoneId + action)
    try {
      await api.post(`/api/milestones/${milestoneId}/${action}`, body)
      toast.success('Done!')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || `Action failed`)
    } finally { setActionLoading(null) }
  }

  const handleSubmitFile = async (milestoneId) => {
    const form = submitForms[milestoneId] || {}
    const fd = new FormData()
    if (form.file) fd.append('file', form.file)
    fd.append('submissionNote', form.note || '')
    setActionLoading(milestoneId + 'submit')
    try {
      await api.post(`/api/milestones/${milestoneId}/submit`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Work submitted!')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submit failed')
    } finally { setActionLoading(null) }
  }

  const releasedCount = milestones.filter(m => m.status === 'released').length
  const progress = milestones.length > 0 ? Math.round((releasedCount / milestones.length) * 100) : 0

  if (loading) return <div className="min-h-screen bg-slate-50"><Navbar /><div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div></div>
  if (!contract) return <div className="min-h-screen bg-slate-50"><Navbar /><p className="text-center py-12 text-slate-500">Contract not found</p></div>

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-slate-400 font-mono mb-1">CONTRACT #{contract.hashId}</div>
              <h1 className="text-2xl font-bold text-slate-800">{contract.job?.title}</h1>
              <div className="text-slate-500 text-sm mt-1">
                {user.role === 'client' ? `Freelancer: ${contract.freelancer?.name}` : `Client: ${contract.client?.name}`}
                {' • '}Total: <strong className="text-slate-700">₹{contract.amount?.toLocaleString()}</strong>
                {' • '}{contract.milestoneCount} phases
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${contract.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {contract.status}
              </span>
              <Link to={`/chat/${contract._id}`} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                Open Chat & Video
              </Link>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{releasedCount} of {milestones.length} phases complete</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Milestones */}
        {milestones.map(m => {
          const rf = reviewForms[m._id] || {}
          const sf = submitForms[m._id] || {}
          const isL = (act) => actionLoading === m._id + act

          return (
            <div key={m._id} className={`bg-white rounded-2xl border p-5 mb-4 ${m.status === 'disputed' ? 'border-red-300' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{m.title}</h3>
                    {m.isAdvance && <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">Advance</span>}
                  </div>
                  <p className="text-sm text-slate-500">{m.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-800">₹{m.amount?.toLocaleString()}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[m.status] || 'bg-gray-100 text-gray-600'}`}>
                    {m.status?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-400 mb-3 flex flex-wrap gap-3">
                <span>Deadline: {new Date(m.deadline).toLocaleDateString()}</span>
                {m.inaccuracyCount > 0 && <span className="text-red-500">Rejections: {m.inaccuracyCount}/2</span>}
                {m.submissionFileHash && (
                  <span>Hash: <a href={`/verify/${m.submissionFileHash}`} target="_blank" rel="noreferrer"
                    className="text-indigo-500 hover:underline font-mono">{m.submissionFileHash.substring(0, 12)}...</a></span>
                )}
              </div>

              {m.inaccuracyNote && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-sm text-red-700">
                  Client note: "{m.inaccuracyNote}"
                </div>
              )}

              {/* CLIENT ACTIONS */}
              {user.role === 'client' && (
                <div className="space-y-2">
                  {m.status === 'pending_deposit' && (
                    <button onClick={() => doAction(m._id, 'fund', { paymentMethodId: 'pm_card_visa' })} disabled={isL('fund')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {isL('fund') ? 'Processing...' : `Fund Phase — ₹${m.amount?.toLocaleString()}`}
                    </button>
                  )}
                  {m.status === 'review' && (
                    <div className="space-y-2">
                      <textarea value={rf.note || ''} rows={2} placeholder="Review notes (optional)"
                        onChange={e => setReviewForms({ ...reviewForms, [m._id]: { ...rf, note: e.target.value } })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <div className="flex gap-2">
                        <button onClick={() => doAction(m._id, 'review', { approved: true, note: rf.note })} disabled={isL('review')}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                          {isL('review') ? '...' : 'Approve Phase'}
                        </button>
                        <div className="flex-1 space-y-1">
                          <input value={rf.inaccuracyNote || ''} placeholder="What is wrong? (required to reject)"
                            onChange={e => setReviewForms({ ...reviewForms, [m._id]: { ...rf, inaccuracyNote: e.target.value } })}
                            className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                          <button onClick={() => doAction(m._id, 'review', { approved: false, inaccuracyNote: rf.inaccuracyNote })}
                            disabled={isL('review') || !rf.inaccuracyNote}
                            className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
                            Mark Inaccurate {m.inaccuracyCount === 1 ? '(triggers dispute)' : ''}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {m.status === 'approved' && (
                    <button onClick={() => doAction(m._id, 'release')} disabled={isL('release')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {isL('release') ? 'Releasing...' : `Release Payment — ₹${m.amount?.toLocaleString()}`}
                    </button>
                  )}
                </div>
              )}

              {/* FREELANCER ACTIONS */}
              {user.role === 'freelancer' && (
                <div className="space-y-2">
                  {m.status === 'funded' && (
                    <button onClick={() => doAction(m._id, 'start')} disabled={isL('start')}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {isL('start') ? '...' : 'Start Working'}
                    </button>
                  )}
                  {(m.status === 'in_progress' || m.status === 'inaccurate_1') && (
                    <div className="space-y-2">
                      <textarea value={sf.note || ''} rows={2} placeholder="Describe what you built in this phase"
                        onChange={e => setSubmitForms({ ...submitForms, [m._id]: { ...sf, note: e.target.value } })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <input type="file" onChange={e => setSubmitForms({ ...submitForms, [m._id]: { ...sf, file: e.target.files[0] } })}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-medium hover:file:bg-indigo-100" />
                      <button onClick={() => handleSubmitFile(m._id)} disabled={isL('submit')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                        {isL('submit') ? 'Submitting...' : 'Submit Work'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Withdrawal */}
        {contract.status === 'active' && user.role === 'client' && (
          <div className="text-center mt-4">
            <button onClick={async () => {
              try {
                const { data } = await api.post(`/api/contracts/${id}/withdraw`)
                if (data.allowed) { toast.success('Contract withdrawn. Funds refunded.'); await load() }
                else toast.error(data.message)
              } catch { toast.error('Withdrawal failed') }
            }} className="text-sm text-red-500 hover:text-red-600 underline">
              Close Contract Early
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
