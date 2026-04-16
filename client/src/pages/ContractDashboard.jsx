import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

const statusColors = {
  pending_deposit: 'bg-zinc-100 text-zinc-500',
  funded: 'bg-zinc-800 text-white',
  in_progress: 'bg-zinc-900 text-white',
  submitted: 'bg-zinc-100 text-zinc-700',
  review: 'bg-zinc-900 text-white',
  approved: 'bg-zinc-900 text-white',
  inaccurate_1: 'bg-zinc-200 text-zinc-700',
  inaccurate_2: 'bg-zinc-300 text-zinc-800',
  disputed: 'bg-zinc-900 text-white',
  released: 'bg-zinc-100 text-zinc-500',
  refunded: 'bg-zinc-100 text-zinc-500',
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
      toast.error(err.response?.data?.message || 'Action failed')
    } finally { setActionLoading(null) }
  }

  const handleFund = async (milestone) => {
    setActionLoading(milestone._id + 'fund')
    try {
      const { data } = await api.post(`/api/milestones/${milestone._id}/fund`)
      if (!data.razorpayKeyId || data.razorpayKeyId.includes('placeholder') || data.razorpayOrderId?.startsWith('order_test_')) {
        toast.success('Funded! (test mode)')
        await load()
        setActionLoading(null)
        return
      }
      const options = {
        key: data.razorpayKeyId,
        amount: Math.round(milestone.amount * 100),
        currency: 'INR',
        name: 'FreeLock Escrow',
        description: milestone.title,
        order_id: data.razorpayOrderId,
        handler: async (response) => {
          try {
            await api.post(`/api/milestones/${milestone._id}/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            toast.success('Payment successful! Milestone funded.')
            await load()
          } catch { toast.error('Payment verification failed.') }
        },
        prefill: { name: user.name, email: user.email },
        theme: { color: '#09090b' },
        modal: { ondismiss: () => { toast('Payment cancelled.'); setActionLoading(null) } }
      }
      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (response) => {
        toast.error(`Payment failed: ${response.error.description}`)
        setActionLoading(null)
      })
      rzp.open()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate payment')
      setActionLoading(null)
    }
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

  if (loading) return (
    <div className="min-h-screen bg-zinc-100"><Navbar />
      <div className="flex justify-center py-20">
        <div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" />
      </div>
    </div>
  )
  if (!contract) return (
    <div className="min-h-screen bg-zinc-100"><Navbar />
      <p className="text-center py-12 text-zinc-500">Contract not found</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-100">
      <Toaster />
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-zinc-400 font-mono mb-1">CONTRACT #{contract.hashId}</div>
              <h1 className="text-xl font-semibold text-zinc-900">{contract.job?.title}</h1>
              <div className="text-zinc-500 text-sm mt-1">
                {user.role === 'client'
                  ? <><span className="text-zinc-400">Freelancer: </span><Link to={`/freelancers/${contract.freelancer?._id}`} className="text-zinc-700 hover:text-zinc-900 hover:underline underline-offset-2 font-medium transition-colors">{contract.freelancer?.name}</Link></>
                  : <><span className="text-zinc-400">Client: </span><Link to={`/clients/${contract.client?._id}`} className="text-zinc-700 hover:text-zinc-900 hover:underline underline-offset-2 font-medium transition-colors">{contract.client?.name}</Link></>
                }
                {' · '}Total: <strong className="text-zinc-700">₹{contract.amount?.toLocaleString()}</strong>
                {' · '}{contract.milestoneCount} phases
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize ${contract.status === 'active' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                {contract.status}
              </span>
              <Link to={`/chat/${contract._id}`} className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                Open Chat & Video
              </Link>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>{releasedCount} of {milestones.length} phases complete</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-1.5">
              <div className="bg-zinc-900 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Milestones */}
        {milestones.map(m => {
          const rf = reviewForms[m._id] || {}
          const sf = submitForms[m._id] || {}
          const isL = (act) => actionLoading === m._id + act

          return (
            <div key={m._id} className="bg-white rounded-xl border border-zinc-200 p-5 mb-3">
              <div className="flex items-start gap-4 mb-3">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {m.isAdvance ? '0' : m.milestoneNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-zinc-900">{m.title}</h3>
                    {m.isAdvance && <span className="bg-zinc-100 text-zinc-600 text-xs px-2 py-0.5 rounded-md font-medium border border-zinc-200">Advance</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusColors[m.status] || 'bg-zinc-100 text-zinc-500'}`}>
                      {m.status?.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 mt-0.5">{m.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-zinc-900">₹{m.amount?.toLocaleString()}</div>
                </div>
              </div>

              <div className="text-xs text-zinc-400 mb-3 flex flex-wrap gap-3">
                <span>Deadline: {new Date(m.deadline).toLocaleDateString()}</span>
                {m.inaccuracyCount > 0 && <span className="text-zinc-600 font-medium">Rejections: {m.inaccuracyCount}/2</span>}
                {m.submissionFileHash && (
                  <span>Hash: <a href={`/verify/${m.submissionFileHash}`} target="_blank" rel="noreferrer"
                    className="text-zinc-900 hover:underline underline-offset-2 font-mono">{m.submissionFileHash.substring(0, 12)}...</a></span>
                )}
              </div>

              {m.inaccuracyNote && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 mb-3 text-sm text-zinc-700">
                  Client note: "{m.inaccuracyNote}"
                </div>
              )}

              {/* CLIENT ACTIONS */}
              {user.role === 'client' && (
                <div className="space-y-2">
                  {m.status === 'pending_deposit' && (
                    <button onClick={() => handleFund(m)} disabled={isL('fund')}
                      className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                      {isL('fund') ? 'Processing...' : `Fund Phase — ₹${m.amount?.toLocaleString()}`}
                    </button>
                  )}
                  {m.status === 'review' && (
                    <div className="space-y-2">
                      <textarea value={rf.note || ''} rows={2} placeholder="Review notes (optional)"
                        onChange={e => setReviewForms({ ...reviewForms, [m._id]: { ...rf, note: e.target.value } })}
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 transition-colors" />
                      <div className="flex gap-2">
                        <button onClick={() => doAction(m._id, 'review', { approved: true, note: rf.note })} disabled={isL('review')}
                          className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                          {isL('review') ? '...' : 'Approve Phase'}
                        </button>
                        <div className="flex-1 space-y-1">
                          <input value={rf.inaccuracyNote || ''} placeholder="What is wrong? (required to reject)"
                            onChange={e => setReviewForms({ ...reviewForms, [m._id]: { ...rf, inaccuracyNote: e.target.value } })}
                            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 transition-colors" />
                          <button onClick={() => doAction(m._id, 'review', { approved: false, inaccuracyNote: rf.inaccuracyNote })}
                            disabled={isL('review') || !rf.inaccuracyNote}
                            className="w-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                            Mark Inaccurate {m.inaccuracyCount === 1 ? '(triggers dispute)' : ''}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {m.status === 'approved' && (
                    <button onClick={() => doAction(m._id, 'release')} disabled={isL('release')}
                      className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
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
                      className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                      {isL('start') ? '...' : 'Start Working'}
                    </button>
                  )}
                  {(m.status === 'in_progress' || m.status === 'inaccurate_1') && (
                    <div className="space-y-2">
                      <textarea value={sf.note || ''} rows={2} placeholder="Describe what you built in this phase"
                        onChange={e => setSubmitForms({ ...submitForms, [m._id]: { ...sf, note: e.target.value } })}
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 transition-colors" />
                      <input type="file" onChange={e => setSubmitForms({ ...submitForms, [m._id]: { ...sf, file: e.target.files[0] } })}
                        className="block w-full text-sm text-zinc-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:text-zinc-700 file:font-medium hover:file:bg-zinc-200 transition-colors" />
                      <button onClick={() => handleSubmitFile(m._id)} disabled={isL('submit')}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
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
            }} className="text-sm text-zinc-400 hover:text-zinc-600 underline underline-offset-2">
              Close Contract Early
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
