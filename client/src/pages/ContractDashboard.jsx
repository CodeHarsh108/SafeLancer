import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'

const statusColors = {
  pending_deposit: 'bg-zinc-100 text-zinc-500',
  funded: 'bg-zinc-800 text-white',
  in_progress: 'bg-zinc-900 text-white',
  submitted: 'bg-zinc-100 text-zinc-700',
  review: 'bg-zinc-900 text-white',
  approved: 'bg-emerald-100 text-emerald-800',
  inaccurate_1: 'bg-amber-100 text-amber-800',
  inaccurate_2: 'bg-red-100 text-red-700',
  disputed: 'bg-red-900 text-white',
  released: 'bg-zinc-100 text-zinc-500',
  refunded: 'bg-zinc-100 text-zinc-500',
}

const statusLabels = {
  pending_deposit: 'Awaiting Funding',
  funded: 'Funded — Upload Required',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  review: 'Under Review',
  approved: 'Approved & Released',
  inaccurate_1: 'Rescheduled',
  inaccurate_2: 'Rescheduled',
  disputed: 'Disputed',
  released: 'Payment Released',
  refunded: 'Refunded',
}

export default function ContractDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [contract, setContract] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [reviewForms, setReviewForms] = useState({})
  const [submitForms, setSubmitForms] = useState({})
  const [evidenceForms, setEvidenceForms] = useState({})
  const [expandedDispute, setExpandedDispute] = useState(null)

  const load = async () => {
    try {
      const [contractRes, disputeRes] = await Promise.all([
        api.get(`/api/contracts/${id}`),
        api.get(`/api/disputes/contract/${id}`)
      ])
      setContract(contractRes.data.contract)
      setMilestones(contractRes.data.milestones)
      setDisputes(disputeRes.data)
    } catch { toast.error('Failed to load contract') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const doAction = async (milestoneId, action, body = {}) => {
    setActionLoading(milestoneId + action)
    try {
      await api.post(`/api/milestones/${milestoneId}/${action}`, body)
      if (action === 'review' && body.approved) {
        toast.success('Phase approved — payment released and files unlocked.')
      } else {
        toast.success('Done!')
      }
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
        name: 'SafeLancer Escrow',
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
    if (!form.file) return toast.error('Code/deliverable file is required')
    if (!form.video) return toast.error('Demo video is required')
    const fd = new FormData()
    fd.append('file', form.file)
    fd.append('video', form.video)
    fd.append('submissionNote', form.note || '')
    setActionLoading(milestoneId + 'submit')
    try {
      await api.post(`/api/milestones/${milestoneId}/submit`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Deliverables submitted! SHA-256 hashes recorded.')
      setSubmitForms(prev => ({ ...prev, [milestoneId]: {} }))
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submit failed')
    } finally { setActionLoading(null) }
  }


  const handleRaiseDispute = async (milestoneId, contractId, reason) => {
    if (!reason) return toast.error('Enter a reason for the dispute')
    setActionLoading(milestoneId + 'dispute')
    try {
      await api.post('/api/disputes/raise', { contractId, milestoneId, reason, type: 'manual' })
      toast.success('Dispute raised. Admin will review.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to raise dispute')
    } finally { setActionLoading(null) }
  }

  const handleSubmitEvidence = async (disputeId) => {
    const form = evidenceForms[disputeId] || {}
    if (!form.description && !form.file) return toast.error('Add a description or attach a file')
    setActionLoading(disputeId + 'evidence')
    try {
      if (form.file) {
        const fd = new FormData()
        fd.append('file', form.file)
        fd.append('description', form.description || form.file.name)
        await api.post(`/api/disputes/${disputeId}/evidence-file`, fd)
      } else {
        await api.post(`/api/disputes/${disputeId}/evidence`, { description: form.description })
      }
      toast.success('Evidence submitted')
      setEvidenceForms({ ...evidenceForms, [disputeId]: {} })
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit evidence')
    } finally { setActionLoading(null) }
  }

  const releasedCount = milestones.filter(m => m.status === 'released' && !m.isAdvance).length
  const totalPhases = milestones.filter(m => !m.isAdvance).length
  const progress = totalPhases > 0 ? Math.round((releasedCount / totalPhases) * 100) : 0

  const getDisputeForMilestone = (milestoneId) =>
    disputes.find(d => d.milestone?._id === milestoneId || d.milestone === milestoneId)

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

  const advanceMilestone = milestones.find(m => m.isAdvance)
  const phaseMilestones = milestones.filter(m => !m.isAdvance)

  // Returns { id, lockReason } — id is the fundable phase or null; lockReason explains why next phase is blocked
  const { fundablePhaseId, phaseLockReason } = (() => {
    const sorted = [...phaseMilestones].sort((a, b) => a.milestoneNumber - b.milestoneNumber)
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i]
      if (m.status !== 'pending_deposit') continue
      if (i === 0) return { fundablePhaseId: m._id, phaseLockReason: null }
      const prev = sorted[i - 1]
      if (['approved', 'released'].includes(prev.status)) return { fundablePhaseId: m._id, phaseLockReason: null }
      const statusMessages = {
        review: `Phase ${prev.milestoneNumber} is under client review`,
        disputed: `Phase ${prev.milestoneNumber} is in dispute`,
        inaccurate_1: `Phase ${prev.milestoneNumber} was disapproved and awaiting resubmission`,
        submitted: `Phase ${prev.milestoneNumber} is submitted and pending review`,
        in_progress: `Phase ${prev.milestoneNumber} is in progress`,
        funded: `Phase ${prev.milestoneNumber} is funded and awaiting freelancer submission`,
        pending_deposit: `Phase ${prev.milestoneNumber} has not been funded yet`,
      }
      return { fundablePhaseId: null, phaseLockReason: statusMessages[prev.status] || `Phase ${prev.milestoneNumber} is not yet complete` }
    }
    return { fundablePhaseId: null, phaseLockReason: null }
  })()

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 font-medium mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>

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
                {' · '}{totalPhases} phases
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                contract.status === 'active' ? 'bg-zinc-900 text-white' :
                contract.status === 'pending_advance' ? 'bg-amber-100 text-amber-700' :
                'bg-zinc-100 text-zinc-500'
              }`}>
                {contract.status === 'pending_advance' ? 'Awaiting Advance' : contract.status}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>{releasedCount} of {totalPhases} phases complete</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-1.5">
              <div className="bg-zinc-900 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Pending advance payment banner */}
        {contract.status === 'pending_advance' && user.role === 'client' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">Advance payment required</p>
              <p className="text-xs text-amber-700 mt-0.5">The project will not begin until the advance payment is secured in escrow. Pay below to activate the contract.</p>
            </div>
          </div>
        )}
        {contract.status === 'pending_advance' && user.role === 'freelancer' && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-700">Waiting for client's advance payment</p>
              <p className="text-xs text-zinc-500 mt-0.5">Work cannot begin until the client secures the advance payment in escrow.</p>
            </div>
          </div>
        )}

        {/* Advance Payment Card */}
        {advanceMilestone && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 font-bold text-sm flex-shrink-0">A</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-900">{advanceMilestone.title}</span>
                    <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-md border border-blue-100">Advance</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusColors[advanceMilestone.status] || 'bg-zinc-100 text-zinc-500'}`}>
                      {advanceMilestone.status === 'funded' ? 'Funded' : (statusLabels[advanceMilestone.status] || advanceMilestone.status)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">Held in escrow — released to freelancer when all phases are complete</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-zinc-900">₹{advanceMilestone.amount?.toLocaleString()}</div>
                {user.role === 'client' && advanceMilestone.status === 'pending_deposit' && (
                  <button onClick={() => handleFund(advanceMilestone)} disabled={actionLoading === advanceMilestone._id + 'fund'}
                    className="mt-1 bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors">
                    {actionLoading === advanceMilestone._id + 'fund' ? '...' : 'Fund Advance'}
                  </button>
                )}
              </div>
            </div>
            {user.role === 'freelancer' && advanceMilestone.status === 'released' && (
              <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                <span className="text-emerald-700 font-medium">Advance payment sent to your account</span>
                <span className="text-emerald-600 ml-2">— ₹{advanceMilestone.amount?.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Phase Milestones */}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Project Phases</h2>
        {phaseMilestones.map(m => {
          const rf = reviewForms[m._id] || {}
          const sf = submitForms[m._id] || {}
          const evf = evidenceForms[m._id] || {}
          const isL = (act) => actionLoading === m._id + act
          const dispute = getDisputeForMilestone(m._id)

          return (
            <div key={m._id} className={`bg-white rounded-xl border p-5 mb-3 ${m.status === 'disputed' ? 'border-red-300' : 'border-zinc-200'}`}>
              {/* Phase Header */}
              <div className="flex items-start gap-4 mb-3">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {m.milestoneNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-zinc-900">{m.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusColors[m.status] || 'bg-zinc-100 text-zinc-500'}`}>
                      {statusLabels[m.status] || m.status}
                    </span>
                    {m.maxRevisions && (
                      <span className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-md">
                        Revisions: {m.inaccuracyCount}/{m.maxRevisions}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-zinc-900">₹{m.amount?.toLocaleString()}</div>
                  <div className="text-xs text-zinc-400">Due {new Date(m.deadline).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Phase Requirements */}
              {m.description && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 mb-3 text-sm text-zinc-700 whitespace-pre-line">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Requirements</p>
                  {m.description}
                </div>
              )}

              {/* Deadline Extensions History */}
              {m.deadlineExtensions?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Deadline Extensions ({m.deadlineExtensions.length})</p>
                  <div className="space-y-1">
                    {m.deadlineExtensions.map((ext, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-zinc-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <span className="text-amber-600 font-medium">#{i + 1}</span>
                        <span>Extended to <strong>{new Date(ext.newDeadline).toLocaleDateString()}</strong></span>
                        {ext.reason && <span className="text-zinc-400">— {ext.reason}</span>}
                        <span className="ml-auto text-zinc-400">{new Date(ext.extendedAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submission hashes + file access */}
              {(m.submissionFileHash || m.submissionVideoHash) && (
                <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3 mb-3 space-y-2">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Submitted Deliverables</p>
                  {m.submissionFileHash && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">Code Hash: <a href={`/verify/${m.submissionFileHash}`} target="_blank" rel="noreferrer"
                        className="text-zinc-900 hover:underline underline-offset-2 font-mono">{m.submissionFileHash.substring(0, 16)}...</a></span>
                      {(user.role === 'freelancer' || ['approved', 'released'].includes(m.status)) && (
                        <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/milestones/file/${m._id}/code`}
                          target="_blank" rel="noreferrer"
                          className="text-xs text-zinc-700 hover:underline font-medium flex-shrink-0">Download File</a>
                      )}
                      {user.role === 'client' && !['approved', 'released'].includes(m.status) && (
                        <span className="text-xs text-zinc-400 italic flex-shrink-0">Locked until approved</span>
                      )}
                    </div>
                  )}
                  {m.submissionVideoHash && m.submissionVideoUrl && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500">
                          Video Hash: <span className="text-zinc-700 font-mono">{m.submissionVideoHash.substring(0, 16)}...</span>
                        </span>
                        <a href={`/verify/${m.submissionVideoHash}`} target="_blank" rel="noreferrer"
                          className="text-xs text-zinc-400 hover:underline flex-shrink-0">Verify</a>
                      </div>
                      {(user.role === 'freelancer' || ['review', 'approved', 'released', 'inaccurate_1', 'disputed'].includes(m.status)) && (
                        <video
                          src={`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${m.submissionVideoUrl}`}
                          controls
                          className="w-full rounded-lg border border-zinc-200 max-h-64 bg-black"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Client review note */}
              {m.inaccuracyNote && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-800">
                  <span className="font-medium">Client feedback: </span>{m.inaccuracyNote}
                </div>
              )}


              {/* Exchange confirmation — shown on release */}
              {['released', 'approved'].includes(m.status) && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-3 space-y-2">
                  <p className="text-sm font-semibold text-emerald-800">Exchange Complete</p>
                  {/* Deliverable → Client */}
                  <div className="flex items-center gap-2 text-sm text-emerald-700">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {user.role === 'client'
                      ? 'Deliverable files unlocked — you can download the code below.'
                      : 'Client has been granted access to your deliverable files.'}
                  </div>
                  {/* Money → Freelancer */}
                  <div className={`flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2 ${
                    m.payoutStatus === 'processed' ? 'bg-emerald-100 text-emerald-800' :
                    m.payoutStatus === 'processing' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                    m.payoutStatus === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' :
                    'bg-white border border-emerald-200 text-zinc-600'
                  }`}>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d={m.payoutStatus === 'processed'
                            ? 'M5 13l4 4L19 7'
                            : 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'} />
                      </svg>
                      <span className="font-medium">
                        {m.payoutStatus === 'processed'
                          ? (user.role === 'freelancer' ? 'Payment transferred to your account.' : 'Payment sent to freelancer.')
                          : m.payoutStatus === 'processing' ? 'Bank transfer in progress...'
                          : m.payoutStatus === 'failed' ? 'Payout failed — contact support'
                          : (user.role === 'freelancer' ? 'Payout pending — add bank/UPI details in your profile.' : 'Awaiting freelancer payout setup.')}
                      </span>
                    </div>
                    <span className="font-bold text-zinc-900 flex-shrink-0">₹{m.amount?.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* DISPUTE PANEL */}
              {m.status === 'disputed' && dispute && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-red-800">Dispute Active — Admin Review</p>
                    <button onClick={() => setExpandedDispute(expandedDispute === dispute._id ? null : dispute._id)}
                      className="text-xs text-red-600 hover:underline">
                      {expandedDispute === dispute._id ? 'Hide' : 'View details'}
                    </button>
                  </div>
                  <p className="text-sm text-red-700">{dispute.reason}</p>

                  {expandedDispute === dispute._id && (
                    <div className="mt-3 space-y-3">
                      {dispute.evidenceSummary?.submissionHashes?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-red-600 mb-1">Submitted File Hashes (Proof of Work)</p>
                          {dispute.evidenceSummary.submissionHashes.map((h, i) => (
                            <a key={i} href={`/verify/${h}`} target="_blank" rel="noreferrer"
                              className="block text-xs font-mono text-red-800 hover:underline">{h}</a>
                          ))}
                        </div>
                      )}
                      {dispute.evidenceSummary?.deadlineExtensionCount > 0 && (
                        <p className="text-xs text-red-600">{dispute.evidenceSummary.deadlineExtensionCount} deadline extension(s) on record</p>
                      )}
                      {dispute.evidence?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-red-600 mb-1">Evidence Submitted ({dispute.evidence.length})</p>
                          {dispute.evidence.map((e, i) => (
                            <div key={i} className="text-xs bg-white border border-red-100 rounded-lg p-2 mb-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="font-medium text-zinc-700">{e.submittedBy?.name || 'User'}</span>
                                <span className="text-zinc-400 capitalize">({e.submittedBy?.role})</span>
                              </div>
                              <p className="text-red-800">{e.description}</p>
                              {e.fileUrl && (
                                <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${e.fileUrl}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-blue-600 underline underline-offset-1 mt-0.5 inline-block">
                                  View attachment
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {dispute.status === 'open' && (
                        <div className="space-y-2">
                          <textarea
                            value={evidenceForms[dispute._id]?.description || ''}
                            onChange={e => setEvidenceForms({ ...evidenceForms, [dispute._id]: { ...evidenceForms[dispute._id], description: e.target.value } })}
                            rows={2} placeholder="Add evidence description or context for admin..."
                            className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 bg-white"
                          />
                          <label className="flex items-center gap-2 cursor-pointer">
                            <div className="flex-1 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-400 bg-white truncate">
                              {evidenceForms[dispute._id]?.file?.name || 'Attach file (optional)'}
                            </div>
                            <input type="file" className="hidden"
                              onChange={e => setEvidenceForms({ ...evidenceForms, [dispute._id]: { ...evidenceForms[dispute._id], file: e.target.files[0] } })} />
                            <span className="border border-red-200 bg-white text-red-600 text-xs font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                              Browse
                            </span>
                          </label>
                          <button onClick={() => handleSubmitEvidence(dispute._id)}
                            disabled={actionLoading === dispute._id + 'evidence'}
                            className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                            {actionLoading === dispute._id + 'evidence' ? '...' : 'Submit Evidence'}
                          </button>
                        </div>
                      )}
                      {dispute.status === 'resolved' && (
                        <div className="bg-white border border-red-100 rounded-lg p-3 text-sm">
                          <span className="font-medium text-zinc-700">Resolution: </span>
                          <span className="capitalize text-zinc-600">{dispute.resolution?.replace(/_/g, ' ')}</span>
                          {dispute.splitPercent && <span className="text-zinc-500"> ({dispute.splitPercent}% to freelancer)</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CLIENT ACTIONS */}
              {user.role === 'client' && (
                <div className="space-y-3">
                  {m.status === 'pending_deposit' && m._id === fundablePhaseId && (
                    <button onClick={() => handleFund(m)} disabled={isL('fund')}
                      className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                      {isL('fund') ? 'Processing...' : `Fund Phase — ₹${m.amount?.toLocaleString()}`}
                    </button>
                  )}
                  {m.status === 'pending_deposit' && m._id !== fundablePhaseId && (
                    <div className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                      Locked — {phaseLockReason ? `${phaseLockReason}. Funding will unlock once it is fully resolved.` : `complete Phase ${m.milestoneNumber - 1} first to unlock funding for this phase.`}
                    </div>
                  )}

                  {m.status === 'funded' && (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-sm text-zinc-500">
                      Waiting for freelancer to upload deliverables and demo video.
                    </div>
                  )}

                  {/* Review section — visible only when both funded and files uploaded */}
                  {m.status === 'review' && (
                    <div className="space-y-3">
                      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs text-zinc-500">
                        Review the demo video and deliverables above before approving. Approving will unlock files for download.
                      </div>
                      <textarea value={rf.note || ''} rows={2} placeholder="Review notes (optional)"
                        onChange={e => setReviewForms({ ...reviewForms, [m._id]: { ...rf, note: e.target.value } })}
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 transition-colors" />
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => doAction(m._id, 'review', { approved: true, note: rf.note })} disabled={isL('review')}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                          {isL('review') ? '...' : 'Approve Phase'}
                        </button>
                        <div className="flex-1 space-y-1 min-w-48">
                          <p className="text-xs text-zinc-400">
                            Reschedule attempts: {m.inaccuracyCount}/{m.maxRevisions} used
                            {m.inaccuracyCount + 1 >= m.maxRevisions ? ' — next disapproval triggers a dispute' : ''}
                          </p>
                          <input value={rf.inaccuracyNote || ''} placeholder="What doesn't match the requirements? (required)"
                            onChange={e => setReviewForms({ ...reviewForms, [m._id]: { ...rf, inaccuracyNote: e.target.value } })}
                            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 transition-colors" />
                          <button
                            onClick={() => doAction(m._id, 'review', { approved: false, inaccuracyNote: rf.inaccuracyNote })}
                            disabled={isL('review') || !rf.inaccuracyNote}
                            className={`w-full border px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${m.inaccuracyCount + 1 >= m.maxRevisions ? 'border-red-300 bg-red-50 hover:bg-red-100 text-red-700' : 'border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700'}`}>
                            {m.inaccuracyCount + 1 >= m.maxRevisions
                              ? 'Disapprove (triggers dispute)'
                              : `Disapprove & Reschedule (attempt ${m.inaccuracyCount + 1}/${m.maxRevisions})`}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}


                  {/* Manual dispute raise */}
                  {['funded', 'in_progress', 'review', 'inaccurate_1'].includes(m.status) && !dispute && (
                    <div className="pt-1">
                      <details className="text-xs">
                        <summary className="text-zinc-400 cursor-pointer hover:text-zinc-600">Raise a dispute</summary>
                        <div className="mt-2 flex gap-2">
                          <input value={evf.reason || ''} placeholder="Reason for dispute"
                            onChange={e => setEvidenceForms({ ...evidenceForms, [m._id]: { ...evf, reason: e.target.value } })}
                            className="flex-1 border border-red-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-red-400 transition-colors" />
                          <button onClick={() => handleRaiseDispute(m._id, id, evf.reason)}
                            disabled={isL('dispute')}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                            {isL('dispute') ? '...' : 'Raise'}
                          </button>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              )}

              {/* FREELANCER ACTIONS */}
              {user.role === 'freelancer' && (
                <div className="space-y-2">
                  {m.status === 'pending_deposit' && m._id === fundablePhaseId && (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-sm text-zinc-500">
                      Waiting for client to fund this phase. Upload will be available once funded.
                    </div>
                  )}
                  {m.status === 'pending_deposit' && m._id !== fundablePhaseId && (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-sm text-zinc-400">
                      Locked — {phaseLockReason ? `${phaseLockReason}. This phase will unlock once it is fully resolved.` : `Phase ${m.milestoneNumber - 1} must be approved before this phase begins.`}
                    </div>
                  )}
                  {m.status === 'review' && (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-sm text-zinc-500">
                      Your deliverables are under client review. You'll be notified of the decision.
                    </div>
                  )}
                  {['funded', 'in_progress', 'inaccurate_1'].includes(m.status) && (
                    <div className="space-y-3">
                      {m.status === 'inaccurate_1' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                          <span className="font-medium">Phase rescheduled.</span> Client feedback: {m.inaccuracyNote}
                          <span className="block text-xs mt-1 text-amber-600">New deadline: {new Date(m.deadline).toLocaleDateString()} — upload corrected files below.</span>
                        </div>
                      )}
                      <textarea value={sf.note || ''} rows={2} placeholder="Describe what you built in this phase"
                        onChange={e => setSubmitForms({ ...submitForms, [m._id]: { ...sf, note: e.target.value } })}
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 transition-colors" />
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-700 font-semibold">Code / Deliverable File <span className="text-red-500">*</span></label>
                        <input type="file" onChange={e => setSubmitForms({ ...submitForms, [m._id]: { ...sf, file: e.target.files[0] } })}
                          className="block w-full text-sm text-zinc-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:text-zinc-700 file:font-medium hover:file:bg-zinc-200 transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-700 font-semibold">Demo Video <span className="text-red-500">*</span></label>
                        <p className="text-xs text-zinc-400">Must show all features described in the phase requirements. Client reviews this before approving.</p>
                        <input type="file" accept="video/*" onChange={e => setSubmitForms({ ...submitForms, [m._id]: { ...sf, video: e.target.files[0] } })}
                          className="block w-full text-sm text-zinc-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100 transition-colors" />
                        <p className="text-xs text-zinc-400">SHA-256 hash recorded on submission. Client cannot access files until phase is approved.</p>
                      </div>
                      <button onClick={() => handleSubmitFile(m._id)} disabled={isL('submit')}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                        {isL('submit') ? 'Submitting...' : 'Submit Deliverables'}
                      </button>
                    </div>
                  )}

                  {/* Freelancer manual dispute */}
                  {['review', 'in_progress'].includes(m.status) && !dispute && (
                    <div className="pt-1">
                      <details className="text-xs">
                        <summary className="text-zinc-400 cursor-pointer hover:text-zinc-600">Raise a dispute</summary>
                        <div className="mt-2 flex gap-2">
                          <input value={evf.reason || ''} placeholder="Reason for dispute"
                            onChange={e => setEvidenceForms({ ...evidenceForms, [m._id]: { ...evf, reason: e.target.value } })}
                            className="flex-1 border border-red-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-red-400 transition-colors" />
                          <button onClick={() => handleRaiseDispute(m._id, id, evf.reason)}
                            disabled={isL('dispute')}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                            {isL('dispute') ? '...' : 'Raise'}
                          </button>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Contract Withdrawal */}
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
