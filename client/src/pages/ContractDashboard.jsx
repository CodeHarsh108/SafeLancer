import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'
import AiDetectionBadge from '../components/AiDetectionBadge'

/** Build a full URL for a file stored either locally (/uploads/...) or on a CDN (https://...). */
const fileUrl = (path) => {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${path}`
}

/** Build an authenticated download URL by appending the auth token as a query param. */
const authFileUrl = (milestoneId, type) => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:5001'
  const token = localStorage.getItem('token')
  return `${base}/api/milestones/file/${milestoneId}/${type}?token=${encodeURIComponent(token)}`
}

const CONFETTI_COLORS = ['#FF6803', '#AE3A02', '#f59e0b', '#10b981', '#BFBFBF', '#F5EDE4', '#fbbf24']

function Confetti({ active }) {
  if (!active) return null
  return (
    <>
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}vw`,
            top: 0,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            width: `${6 + Math.random() * 8}px`,
            height: `${6 + Math.random() * 8}px`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${0.8 + Math.random() * 0.6}s`,
          }}
        />
      ))}
    </>
  )
}

const statusColors = {
  pending_deposit: { background: '#120a02', color: '#6b5445', border: '1px solid rgba(255,104,3,0.08)' },
  funded:          { background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' },
  in_progress:     { background: 'rgba(255,104,3,0.10)', color: '#FF6803', border: '1px solid rgba(255,104,3,0.22)' },
  submitted:       { background: 'rgba(255,104,3,0.06)', color: '#BFBFBF', border: '1px solid rgba(255,104,3,0.12)' },
  review:          { background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' },
  approved:        { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' },
  inaccurate_1:    { background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' },
  inaccurate_2:    { background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' },
  disputed:        { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' },
  released:        { background: '#120a02', color: '#6b5445', border: '1px solid rgba(255,104,3,0.08)' },
  refunded:        { background: '#120a02', color: '#6b5445', border: '1px solid rgba(255,104,3,0.08)' },
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

const SectionLabel = ({ text }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="h-px flex-1" style={{ background: 'rgba(255,104,3,0.12)' }} />
    <h2 className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#BFBFBF' }}>{text}</h2>
    <div className="h-px flex-1" style={{ background: 'rgba(255,104,3,0.12)' }} />
  </div>
)

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
  const [showConfetti, setShowConfetti] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawPreview, setWithdrawPreview] = useState(null)
  const [withdrawPreviewLoading, setWithdrawPreviewLoading] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

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

  useEffect(() => {
    const handler = () => load()
    window.addEventListener('payoutsProcessed', handler)
    return () => window.removeEventListener('payoutsProcessed', handler)
  }, [])

  const doAction = async (milestoneId, action, body = {}) => {
    setActionLoading(milestoneId + action)
    try {
      await api.post(`/api/milestones/${milestoneId}/${action}`, body)
      if (action === 'review' && body.approved) {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 1500)
        toast.success('Phase approved — payment released and files unlocked.')
        window.dispatchEvent(new Event('payoutsProcessed'))
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
      if (!data.razorpayKeyId || data.razorpayOrderId?.startsWith('order_test_')) {
        toast.success(`Funded! ₹${milestone.amount.toLocaleString()} + ₹${data.clientFee?.toLocaleString() ?? Math.round(milestone.amount * 0.02)} platform fee (no-key mode)`)
        await load()
        setActionLoading(null)
        return
      }
      if (!window.Razorpay) {
        toast.error('Payment gateway failed to load. Please refresh and try again.')
        setActionLoading(null)
        return
      }
      const clientTotal = data.clientTotal || Math.round(milestone.amount * 1.02)
      const isTestKey = data.razorpayKeyId?.startsWith('rzp_test_')
      const options = {
        key: data.razorpayKeyId,
        amount: Math.round(clientTotal * 100),
        currency: 'INR',
        name: 'SafeLancer Escrow',
        description: `${milestone.title} · ₹${milestone.amount.toLocaleString()} + ₹${data.clientFee?.toLocaleString()} fee`,
        order_id: data.razorpayOrderId,
        handler: async (response) => {
          try {
            await api.post(`/api/milestones/${milestone._id}/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            toast.success('Payment verified! Milestone funded.')
            await load()
          } catch { toast.error('Payment verification failed. Contact support if amount was deducted.') }
        },
        prefill: { name: user.name, email: user.email },
        theme: { color: '#FF6803' },
        notes: { milestoneId: milestone._id, platformFee: data.clientFee },
        modal: {
          ondismiss: () => { toast('Payment cancelled.'); setActionLoading(null) },
          confirm_close: true,
          escape: false,
        }
      }
      if (isTestKey) {
        options.description += ' [Test Mode — use test card: 4111 1111 1111 1111]'
      }
      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (response) => {
        toast.error(`Payment failed: ${response.error?.description || 'Unknown error'}`)
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

  const openWithdrawModal = async () => {
    setWithdrawPreviewLoading(true)
    setShowWithdrawModal(true)
    try {
      const { data } = await api.get(`/api/contracts/${id}/withdraw-preview`)
      setWithdrawPreview(data)
    } catch (err) {
      toast.error('Could not load withdrawal details')
      setShowWithdrawModal(false)
    } finally {
      setWithdrawPreviewLoading(false)
    }
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    try {
      await api.post(`/api/contracts/${id}/withdraw`)
      setShowWithdrawModal(false)
      toast.success('Contract withdrawn successfully.')
      window.dispatchEvent(new Event('payoutsProcessed'))
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Withdrawal failed')
    } finally {
      setWithdrawing(false)
    }
  }

  const releasedCount = milestones.filter(m => m.status === 'released' && !m.isAdvance).length
  const totalPhases = milestones.filter(m => !m.isAdvance).length
  const progress = totalPhases > 0 ? Math.round((releasedCount / totalPhases) * 100) : 0

  const getDisputeForMilestone = (milestoneId) =>
    disputes.find(d => d.milestone?._id === milestoneId || d.milestone === milestoneId)

  if (loading) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex justify-center py-20">
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 border-2 rounded-full" style={{ borderColor: 'rgba(255,104,3,0.12)' }} />
          <div className="absolute inset-0 border-2 border-t-[#FF6803] rounded-full animate-spin" style={{ borderColor: 'transparent', borderTopColor: '#FF6803' }} />
        </div>
      </div>
    </div>
  )

  if (!contract) return (
    <div className="min-h-screen">
      <Navbar />
      <p className="text-center py-12" style={{ color: '#6b5445' }}>Contract not found</p>
    </div>
  )

  const advanceMilestone = milestones.find(m => m.isAdvance)
  const phaseMilestones = milestones.filter(m => !m.isAdvance)

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
    <>
    <div className="min-h-screen">
      <Confetti active={showConfetti} />
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">

        {/* Back */}
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium mb-5 transition-colors"
          style={{ color: '#6b5445' }}
          onMouseEnter={e => e.currentTarget.style.color = '#F5EDE4'}
          onMouseLeave={e => e.currentTarget.style.color = '#6b5445'}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Header Card */}
        <div className="rounded-2xl p-6 mb-5" style={{ background: 'linear-gradient(135deg, rgba(18,10,2,0.90) 0%, rgba(28,16,8,0.85) 100%)', border: '1px solid rgba(255,104,3,0.18)', backdropFilter: 'blur(24px)', boxShadow: '0 0 60px rgba(255,104,3,0.06), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono font-semibold uppercase tracking-wider mb-1" style={{ color: '#6b5445' }}>
                Contract #{contract.hashId}
              </div>
              <h1 className="text-xl font-bold" style={{ color: '#F5EDE4' }}>{contract.job?.title}</h1>
              <div className="text-sm mt-1 flex flex-wrap items-center gap-x-1" style={{ color: '#BFBFBF' }}>
                {user.role === 'client'
                  ? <><span style={{ color: '#6b5445' }}>Freelancer: </span>
                      <Link to={`/freelancers/${contract.freelancer?._id}`}
                        className="font-semibold hover:underline underline-offset-2 transition-colors"
                        style={{ color: '#FF6803' }}>{contract.freelancer?.name}</Link></>
                  : <><span style={{ color: '#6b5445' }}>Client: </span>
                      <Link to={`/clients/${contract.client?._id}`}
                        className="font-semibold hover:underline underline-offset-2 transition-colors"
                        style={{ color: '#FF6803' }}>{contract.client?.name}</Link></>
                }
                <span style={{ color: '#6b5445' }}> · </span>
                <span style={{ color: '#6b5445' }}>Total: </span>
                <strong style={{ color: '#F5EDE4' }}>₹{contract.amount?.toLocaleString()}</strong>
                <span style={{ color: '#6b5445' }}> · {totalPhases} phases</span>
              </div>
            </div>
            <div className="flex-shrink-0">
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={
                contract.status === 'active'
                  ? { background: 'rgba(255,104,3,0.12)', color: '#FF6803', border: '1px solid rgba(255,104,3,0.25)' }
                  : contract.status === 'pending_advance'
                  ? { background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }
                  : { background: '#120a02', color: '#6b5445', border: '1px solid rgba(255,104,3,0.08)' }
              }>
                {contract.status === 'pending_advance' ? 'Awaiting Advance' : contract.status}
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-5">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: '#6b5445' }}>
              <span>{releasedCount} of {totalPhases} phases complete</span>
              <span style={{ color: progress === 100 ? '#10b981' : '#BFBFBF' }}>{progress}%</span>
            </div>
            <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,104,3,0.08)' }}>
              <div className="h-1.5 rounded-full transition-all" style={{
                width: `${progress}%`,
                background: progress === 100
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, #FF6803, #AE3A02)'
              }} />
            </div>
          </div>
        </div>

        {/* Pending advance payment banners */}
        {contract.status === 'pending_advance' && user.role === 'client' && (
          <div className="rounded-xl p-4 mb-5 flex items-start gap-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#f59e0b' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>Advance payment required</p>
              <p className="text-xs mt-0.5" style={{ color: '#d97706' }}>The project will not begin until the advance payment is secured in escrow. Pay below to activate the contract.</p>
            </div>
          </div>
        )}
        {contract.status === 'pending_advance' && user.role === 'freelancer' && (
          <div className="rounded-xl p-4 mb-5 flex items-start gap-3" style={{ background: '#120a02', border: '1px solid rgba(255,104,3,0.10)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,104,3,0.06)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#6b5445' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#BFBFBF' }}>Waiting for client's advance payment</p>
              <p className="text-xs mt-0.5" style={{ color: '#6b5445' }}>Work cannot begin until the client secures the advance payment in escrow.</p>
            </div>
          </div>
        )}

        {/* Advance Payment Card */}
        {advanceMilestone && (
          <div className="dark-card p-5 mb-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 text-white"
                  style={{ background: 'linear-gradient(135deg, #FF6803, #AE3A02)', boxShadow: '0 0 14px rgba(255,104,3,0.35)' }}>A</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: '#F5EDE4' }}>{advanceMilestone.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>Advance</span>
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={statusColors[advanceMilestone.status] || statusColors.pending_deposit}>
                      {advanceMilestone.status === 'funded' ? 'Funded' : (statusLabels[advanceMilestone.status] || advanceMilestone.status)}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#6b5445' }}>Held in escrow — released to freelancer when all phases are complete</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold" style={{ color: '#F5EDE4' }}>
                  ₹{(user.role === 'freelancer' && advanceMilestone.freelancerPayout > 0 ? advanceMilestone.freelancerPayout : advanceMilestone.amount)?.toLocaleString()}
                </div>
                {user.role === 'freelancer' && advanceMilestone.freelancerPayout > 0 && (
                  <p className="text-[10px] mt-0.5" style={{ color: '#6b5445' }}>after 2% fee</p>
                )}
                {user.role === 'client' && advanceMilestone.status === 'pending_deposit' && (
                  <>
                    <p className="text-[10px] mt-0.5" style={{ color: '#6b5445' }}>+₹{Math.round(advanceMilestone.amount * 0.02).toLocaleString()} fee = ₹{Math.round(advanceMilestone.amount * 1.02).toLocaleString()} total</p>
                    <button onClick={() => handleFund(advanceMilestone)} disabled={actionLoading === advanceMilestone._id + 'fund'}
                      className="btn-purple mt-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors">
                      {actionLoading === advanceMilestone._id + 'fund' ? '...' : 'Fund Advance'}
                    </button>
                  </>
                )}
              </div>
            </div>
            {user.role === 'freelancer' && advanceMilestone.status === 'released' && (
              <div className="mt-3 rounded-lg p-3 text-sm" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <span className="font-semibold" style={{ color: '#10b981' }}>Advance payment sent to your account</span>
                <span className="ml-2" style={{ color: '#059669' }}>
                  — ₹{(advanceMilestone.freelancerPayout > 0 ? advanceMilestone.freelancerPayout : advanceMilestone.amount)?.toLocaleString()}
                  {advanceMilestone.freelancerPayout > 0 && (
                    <span className="text-[10px] font-normal ml-1" style={{ color: '#6b5445' }}>(after 2% fee)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Phase Milestones */}
        <SectionLabel text="Project Phases" />

        {phaseMilestones.map(m => {
          const rf = reviewForms[m._id] || {}
          const sf = submitForms[m._id] || {}
          const evf = evidenceForms[m._id] || {}
          const isL = (act) => actionLoading === m._id + act
          const dispute = getDisputeForMilestone(m._id)

          return (
            <div key={m._id} className="rounded-2xl p-5 mb-3" style={{
              background: 'rgba(18,10,2,0.85)',
              border: m.status === 'disputed' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,104,3,0.12)',
              backdropFilter: 'blur(16px)',
            }}>
              {/* Phase Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #FF6803, #AE3A02)', boxShadow: '0 0 12px rgba(255,104,3,0.30)' }}>
                  {m.milestoneNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm" style={{ color: '#F5EDE4' }}>{m.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={statusColors[m.status] || statusColors.pending_deposit}>
                      {statusLabels[m.status] || m.status}
                    </span>
                    {m.maxRevisions && (
                      <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: '#120a02', color: '#6b5445', border: '1px solid rgba(255,104,3,0.08)' }}>
                        Revisions: {m.inaccuracyCount}/{m.maxRevisions}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold" style={{ color: '#F5EDE4' }}>
                    ₹{(user.role === 'freelancer' && m.freelancerPayout > 0 ? m.freelancerPayout : m.amount)?.toLocaleString()}
                  </div>
                  {user.role === 'freelancer' && m.freelancerPayout > 0 && (
                    <div className="text-[10px]" style={{ color: '#6b5445' }}>after 2% fee</div>
                  )}
                  <div className="text-xs" style={{ color: '#6b5445' }}>Due {new Date(m.deadline).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Phase Requirements */}
              {m.description && (
                <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,104,3,0.04)', border: '1px solid rgba(255,104,3,0.10)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6b5445' }}>Requirements</p>
                  <p className="text-sm whitespace-pre-line" style={{ color: '#BFBFBF' }}>{m.description}</p>
                </div>
              )}

              {/* Deadline Extensions */}
              {m.deadlineExtensions?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#6b5445' }}>Deadline Extensions ({m.deadlineExtensions.length})</p>
                  <div className="space-y-1">
                    {m.deadlineExtensions.map((ext, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', color: '#BFBFBF' }}>
                        <span className="font-semibold" style={{ color: '#f59e0b' }}>#{i + 1}</span>
                        <span>Extended to <strong style={{ color: '#F5EDE4' }}>{new Date(ext.newDeadline).toLocaleDateString()}</strong></span>
                        {ext.reason && <span style={{ color: '#6b5445' }}>— {ext.reason}</span>}
                        <span className="ml-auto" style={{ color: '#6b5445' }}>{new Date(ext.extendedAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submission hashes + file access */}
              {(m.submissionFileHash || m.submissionVideoHash) && (
                <div className="rounded-xl p-3 mb-3 space-y-2" style={{ background: '#120a02', border: '1px solid rgba(255,104,3,0.10)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b5445' }}>Submitted Deliverables</p>
                  {m.submissionFileHash && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs" style={{ color: '#BFBFBF' }}>
                        Code Hash:{' '}
                        <a href={`/verify/${m.submissionFileHash}`} target="_blank" rel="noreferrer"
                          className="hover:underline underline-offset-2 font-mono transition-colors" style={{ color: '#FF6803' }}>
                          {m.submissionFileHash.substring(0, 16)}...
                        </a>
                      </span>
                      {(user.role === 'freelancer' || ['approved', 'released'].includes(m.status)) && (
                        <a href={authFileUrl(m._id, 'code')} target="_blank" rel="noreferrer" download
                          className="text-xs hover:underline font-semibold flex-shrink-0 transition-colors" style={{ color: '#FF6803' }}>
                          Download File
                        </a>
                      )}
                      {user.role === 'client' && !['approved', 'released'].includes(m.status) && (
                        <span className="text-xs italic flex-shrink-0" style={{ color: '#6b5445' }}>Locked until approved</span>
                      )}
                    </div>
                  )}
                  {m.submissionVideoHash && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs" style={{ color: '#BFBFBF' }}>
                          Video Hash:{' '}
                          <span className="font-mono" style={{ color: '#FF6803' }}>{m.submissionVideoHash.substring(0, 16)}...</span>
                        </span>
                        <a href={`/verify/${m.submissionVideoHash}`} target="_blank" rel="noreferrer"
                          className="text-xs hover:underline flex-shrink-0 transition-colors" style={{ color: '#6b5445' }}>Verify</a>
                      </div>
                      {(user.role === 'freelancer' || ['review', 'approved', 'released', 'inaccurate_1', 'disputed'].includes(m.status)) && (
                        <>
                          {(m.submissionVideoUrl || m.submissionVideoHash) && (
                            <video
                              src={m.submissionVideoUrl ? fileUrl(m.submissionVideoUrl) : authFileUrl(m._id, 'video')}
                              controls
                              className="w-full rounded-xl max-h-64 bg-black"
                              style={{ border: '1px solid rgba(255,104,3,0.12)' }}
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'block') }}
                            />
                          )}
                          {!m.submissionVideoUrl && m.submissionVideoHash && (
                            <div className="rounded-xl p-3 text-center text-xs" style={{ display: 'none', background: '#120a02', border: '1px solid rgba(255,104,3,0.08)', color: '#6b5445' }}>
                              Video file not available — freelancer may need to re-submit deliverables.
                            </div>
                          )}
                          <AiDetectionBadge
                            milestoneId={m._id}
                            initialStatus={m.rdStatus}
                            initialScore={m.rdScore}
                            initialAnalyzedAt={m.rdAnalyzedAt}
                            initialSimulated={m.rdSimulated}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Client review note */}
              {m.inaccuracyNote && (
                <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <span className="text-sm font-semibold" style={{ color: '#f59e0b' }}>Client feedback: </span>
                  <span className="text-sm" style={{ color: '#d97706' }}>{m.inaccuracyNote}</span>
                </div>
              )}

              {/* Exchange confirmation */}
              {['released', 'approved'].includes(m.status) && (
                <div className="rounded-xl p-4 mb-3 space-y-2" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p className="text-sm font-semibold" style={{ color: '#10b981' }}>Exchange Complete</p>
                  <div className="flex items-center gap-2 text-sm" style={{ color: '#10b981' }}>
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {user.role === 'client'
                      ? 'Deliverable files unlocked — you can download the code below.'
                      : 'Client has been granted access to your deliverable files.'}
                  </div>
                  {m.payoutStatus === 'processed' ? (
                    <div className="flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-medium">
                          {user.role === 'freelancer' ? 'Payment transferred to your account.' : 'Payment sent to freelancer.'}
                        </span>
                      </div>
                      <span className="font-bold flex-shrink-0" style={{ color: '#F5EDE4' }}>
                        ₹{(user.role === 'freelancer' && m.freelancerPayout > 0 ? m.freelancerPayout : m.amount)?.toLocaleString()}
                        {user.role === 'freelancer' && m.freelancerPayout > 0 && (
                          <span className="text-[10px] font-normal ml-1" style={{ color: '#6b5445' }}>(after 2% fee)</span>
                        )}
                      </span>
                    </div>
                  ) : m.payoutStatus === 'processing' ? (
                    <div className="flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2"
                      style={{ background: 'rgba(59,130,246,0.08)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Bank transfer in progress...</span>
                      </div>
                      <span className="font-bold flex-shrink-0" style={{ color: '#F5EDE4' }}>
                        ₹{(user.role === 'freelancer' && m.freelancerPayout > 0 ? m.freelancerPayout : m.amount)?.toLocaleString()}
                      </span>
                    </div>
                  ) : null}
                </div>
              )}

              {/* DISPUTE PANEL */}
              {m.status === 'disputed' && dispute && (
                <div className="rounded-xl p-4 mb-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold" style={{ color: '#f87171' }}>Dispute Active — Admin Review</p>
                    <button onClick={() => setExpandedDispute(expandedDispute === dispute._id ? null : dispute._id)}
                      className="text-xs hover:underline underline-offset-2 transition-colors" style={{ color: '#f87171' }}>
                      {expandedDispute === dispute._id ? 'Hide' : 'View details'}
                    </button>
                  </div>
                  <p className="text-sm" style={{ color: '#fca5a5' }}>{dispute.reason}</p>

                  {expandedDispute === dispute._id && (
                    <div className="mt-3 space-y-3">
                      {dispute.evidenceSummary?.submissionHashes?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1" style={{ color: '#f87171' }}>Submitted File Hashes (Proof of Work)</p>
                          {dispute.evidenceSummary.submissionHashes.map((h, i) => (
                            <a key={i} href={`/verify/${h}`} target="_blank" rel="noreferrer"
                              className="block text-xs font-mono hover:underline" style={{ color: '#fca5a5' }}>{h}</a>
                          ))}
                        </div>
                      )}
                      {dispute.evidenceSummary?.deadlineExtensionCount > 0 && (
                        <p className="text-xs" style={{ color: '#f87171' }}>{dispute.evidenceSummary.deadlineExtensionCount} deadline extension(s) on record</p>
                      )}
                      {dispute.evidence?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1" style={{ color: '#f87171' }}>Evidence Submitted ({dispute.evidence.length})</p>
                          {dispute.evidence.map((e, i) => (
                            <div key={i} className="text-xs rounded-lg p-2 mb-1" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(239,68,68,0.15)' }}>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="font-semibold" style={{ color: '#F5EDE4' }}>{e.submittedBy?.name || 'User'}</span>
                                <span className="capitalize" style={{ color: '#6b5445' }}>({e.submittedBy?.role})</span>
                              </div>
                              <p style={{ color: '#fca5a5' }}>{e.description}</p>
                              {e.fileUrl && (
                                <a href={fileUrl(e.fileUrl)} target="_blank" rel="noopener noreferrer"
                                  className="underline underline-offset-1 mt-0.5 inline-block" style={{ color: '#60a5fa' }}>
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
                            className="dark-input w-full"
                          />
                          <label className="flex items-center gap-2 cursor-pointer">
                            <div className="flex-1 rounded-lg px-3 py-2 text-sm truncate" style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)', color: '#f87171' }}>
                              {evidenceForms[dispute._id]?.file?.name || 'Attach file (optional)'}
                            </div>
                            <input type="file" className="hidden"
                              onChange={e => setEvidenceForms({ ...evidenceForms, [dispute._id]: { ...evidenceForms[dispute._id], file: e.target.files[0] } })} />
                            <span className="text-xs font-medium px-3 py-2 rounded-lg flex-shrink-0 cursor-pointer transition-colors"
                              style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#f87171' }}>
                              Browse
                            </span>
                          </label>
                          <button onClick={() => handleSubmitEvidence(dispute._id)}
                            disabled={actionLoading === dispute._id + 'evidence'}
                            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors text-white"
                            style={{ background: '#dc2626' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'}
                            onMouseLeave={e => e.currentTarget.style.background = '#dc2626'}>
                            {actionLoading === dispute._id + 'evidence' ? '...' : 'Submit Evidence'}
                          </button>
                        </div>
                      )}
                      {dispute.status === 'resolved' && (
                        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(239,68,68,0.1)' }}>
                          <span className="font-semibold" style={{ color: '#F5EDE4' }}>Resolution: </span>
                          <span className="capitalize" style={{ color: '#BFBFBF' }}>{dispute.resolution?.replace(/_/g, ' ')}</span>
                          {dispute.splitPercent && <span style={{ color: '#6b5445' }}> ({dispute.splitPercent}% to freelancer)</span>}
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
                    <div>
                      <p className="text-[10px] mb-1.5" style={{ color: '#6b5445' }}>
                        ₹{m.amount?.toLocaleString()} + ₹{Math.round(m.amount * 0.02).toLocaleString()} platform fee = <span className="font-bold" style={{ color: '#F5EDE4' }}>₹{Math.round(m.amount * 1.02).toLocaleString()} total</span>
                      </p>
                      <button onClick={() => handleFund(m)} disabled={isL('fund')}
                        className="btn-purple px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                        {isL('fund') ? 'Processing...' : `Fund Phase — ₹${Math.round(m.amount * 1.02).toLocaleString()}`}
                      </button>
                    </div>
                  )}
                  {m.status === 'pending_deposit' && m._id !== fundablePhaseId && (
                    <div className="text-xs rounded-xl px-3 py-2.5" style={{ background: '#120a02', border: '1px solid rgba(255,104,3,0.08)', color: '#6b5445' }}>
                      Locked — {phaseLockReason ? `${phaseLockReason}. Funding will unlock once it is fully resolved.` : `complete Phase ${m.milestoneNumber - 1} first to unlock funding for this phase.`}
                    </div>
                  )}

                  {m.status === 'funded' && (
                    <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: '#120a02', border: '1px solid rgba(255,104,3,0.08)', color: '#6b5445' }}>
                      Waiting for freelancer to upload deliverables and demo video.
                    </div>
                  )}

                  {m.status === 'review' && (
                    <div className="space-y-3">
                      <div className="rounded-xl p-3 text-xs" style={{ background: '#120a02', border: '1px solid rgba(255,104,3,0.08)', color: '#6b5445' }}>
                        Review the demo video and deliverables above before approving. Approving will unlock files for download.
                      </div>
                      <textarea value={rf.note || ''} rows={2} placeholder="Review notes (optional)"
                        onChange={e => setReviewForms({ ...reviewForms, [m._id]: { ...rf, note: e.target.value } })}
                        className="dark-input w-full" />
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => doAction(m._id, 'review', { approved: true, note: rf.note })} disabled={isL('review')}
                          className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors text-white"
                          style={{ background: '#059669' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#047857'}
                          onMouseLeave={e => e.currentTarget.style.background = '#059669'}>
                          {isL('review') ? '...' : 'Approve Phase'}
                        </button>
                        <div className="flex-1 space-y-1.5 min-w-48">
                          <p className="text-xs" style={{ color: '#6b5445' }}>
                            Reschedule attempts: {m.inaccuracyCount}/{m.maxRevisions} used
                            {m.inaccuracyCount + 1 >= m.maxRevisions ? ' — next disapproval triggers a dispute' : ''}
                          </p>
                          <input value={rf.inaccuracyNote || ''} placeholder="What doesn't match the requirements? (required)"
                            onChange={e => setReviewForms({ ...reviewForms, [m._id]: { ...rf, inaccuracyNote: e.target.value } })}
                            className="dark-input w-full" />
                          <button
                            onClick={() => doAction(m._id, 'review', { approved: false, inaccuracyNote: rf.inaccuracyNote })}
                            disabled={isL('review') || !rf.inaccuracyNote}
                            className="w-full px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                            style={m.inaccuracyCount + 1 >= m.maxRevisions
                              ? { border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171' }
                              : { border: '1px solid rgba(255,104,3,0.12)', background: '#120a02', color: '#BFBFBF' }}>
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
                        <summary className="cursor-pointer transition-colors" style={{ color: '#6b5445' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#BFBFBF'}
                          onMouseLeave={e => e.currentTarget.style.color = '#6b5445'}>Raise a dispute</summary>
                        <div className="mt-2 flex gap-2">
                          <input value={evf.reason || ''} placeholder="Reason for dispute"
                            onChange={e => setEvidenceForms({ ...evidenceForms, [m._id]: { ...evf, reason: e.target.value } })}
                            className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none transition-colors"
                            style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)', color: '#F5EDE4' }} />
                          <button onClick={() => handleRaiseDispute(m._id, id, evf.reason)}
                            disabled={isL('dispute')}
                            className="px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors text-white"
                            style={{ background: '#dc2626' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'}
                            onMouseLeave={e => e.currentTarget.style.background = '#dc2626'}>
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
                    <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: '#120a02', border: '1px solid rgba(255,104,3,0.08)', color: '#6b5445' }}>
                      Waiting for client to fund this phase. Upload will be available once funded.
                    </div>
                  )}
                  {m.status === 'pending_deposit' && m._id !== fundablePhaseId && (
                    <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: '#120a02', border: '1px solid rgba(255,104,3,0.08)', color: '#6b5445' }}>
                      Locked — {phaseLockReason ? `${phaseLockReason}. This phase will unlock once it is fully resolved.` : `Phase ${m.milestoneNumber - 1} must be approved before this phase begins.`}
                    </div>
                  )}
                  {m.status === 'review' && (
                    <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: '#120a02', border: '1px solid rgba(255,104,3,0.08)', color: '#6b5445' }}>
                      Your deliverables are under client review. You'll be notified of the decision.
                    </div>
                  )}
                  {['funded', 'in_progress', 'inaccurate_1'].includes(m.status) && (
                    <div className="space-y-3">
                      {m.status === 'inaccurate_1' && (
                        <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <span className="text-sm font-semibold" style={{ color: '#f59e0b' }}>Phase rescheduled. </span>
                          <span className="text-sm" style={{ color: '#d97706' }}>Client feedback: {m.inaccuracyNote}</span>
                          <span className="block text-xs mt-1" style={{ color: '#92400e' }}>New deadline: {new Date(m.deadline).toLocaleDateString()} — upload corrected files below.</span>
                        </div>
                      )}
                      <textarea value={sf.note || ''} rows={2} placeholder="Describe what you built in this phase"
                        onChange={e => setSubmitForms({ ...submitForms, [m._id]: { ...sf, note: e.target.value } })}
                        className="dark-input w-full" />
                      <div className="space-y-1">
                        <label className="text-xs font-semibold" style={{ color: '#BFBFBF' }}>
                          Code / Deliverable File <span style={{ color: '#f87171' }}>*</span>
                        </label>
                        <input type="file" onChange={e => setSubmitForms({ ...submitForms, [m._id]: { ...sf, file: e.target.files[0] } })}
                          className="block w-full text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-semibold transition-colors"
                          style={{ color: '#6b5445' }} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold" style={{ color: '#BFBFBF' }}>
                          Demo Video <span style={{ color: '#f87171' }}>*</span>
                        </label>
                        <p className="text-xs" style={{ color: '#6b5445' }}>Must show all features described in the phase requirements. Client reviews this before approving.</p>
                        <input type="file" accept="video/*" onChange={e => setSubmitForms({ ...submitForms, [m._id]: { ...sf, video: e.target.files[0] } })}
                          className="block w-full text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-semibold transition-colors"
                          style={{ color: '#6b5445' }} />
                        <p className="text-xs" style={{ color: '#6b5445' }}>SHA-256 hash recorded on submission. Client cannot access files until phase is approved.</p>
                      </div>
                      <button onClick={() => handleSubmitFile(m._id)} disabled={isL('submit')}
                        className="btn-purple px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                        {isL('submit') ? 'Submitting...' : 'Submit Deliverables'}
                      </button>
                    </div>
                  )}

                  {/* Freelancer manual dispute */}
                  {['review', 'in_progress'].includes(m.status) && !dispute && (
                    <div className="pt-1">
                      <details className="text-xs">
                        <summary className="cursor-pointer transition-colors" style={{ color: '#6b5445' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#BFBFBF'}
                          onMouseLeave={e => e.currentTarget.style.color = '#6b5445'}>Raise a dispute</summary>
                        <div className="mt-2 flex gap-2">
                          <input value={evf.reason || ''} placeholder="Reason for dispute"
                            onChange={e => setEvidenceForms({ ...evidenceForms, [m._id]: { ...evf, reason: e.target.value } })}
                            className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none transition-colors"
                            style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)', color: '#F5EDE4' }} />
                          <button onClick={() => handleRaiseDispute(m._id, id, evf.reason)}
                            disabled={isL('dispute')}
                            className="px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors text-white"
                            style={{ background: '#dc2626' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#b91c1c'}
                            onMouseLeave={e => e.currentTarget.style.background = '#dc2626'}>
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
        {contract.status === 'active' && (
          <div className="text-center mt-6 pb-2">
            <button onClick={openWithdrawModal}
              className="text-sm underline underline-offset-2 transition-colors"
              style={{ color: '#6b5445' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = '#6b5445'}>
              Withdraw from Contract
            </button>
          </div>
        )}
      </div>
    </div>

    {/* ── Withdrawal Modal ─────────────────────────────────────────── */}
    {showWithdrawModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
        <div className="rounded-2xl w-full max-w-md"
          style={{ background: '#150d06', border: '1px solid rgba(239,68,68,0.25)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'rgba(239,68,68,0.12)' }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#f87171' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="text-base font-bold" style={{ color: '#F5EDE4' }}>Withdraw from Contract</h2>
            </div>
            <p className="text-xs" style={{ color: '#6b5445' }}>This action is irreversible. Review the terms carefully.</p>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {withdrawPreviewLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#FF6803', borderTopColor: 'transparent' }} />
              </div>
            ) : withdrawPreview ? (() => {
              const p = withdrawPreview
              const fmt = (n) => `₹${Math.round(n).toLocaleString()}`
              const isClient = user.role === 'client'
              return (
                <div className="space-y-4">
                  {/* Scenario badge */}
                  <div className="rounded-xl px-4 py-3"
                    style={{ background: p.past50 ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${p.past50 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                    {p.scenario === 1 ? (
                      <p className="text-sm font-medium" style={{ color: '#f5d76e' }}>
                        No phases have started yet
                      </p>
                    ) : p.allComplete ? (
                      <p className="text-sm font-medium" style={{ color: '#10b981' }}>
                        All active phases are complete
                      </p>
                    ) : (
                      <div>
                        <p className="text-sm font-medium" style={{ color: p.past50 ? '#10b981' : '#f59e0b' }}>
                          Phase {p.activePhaseNumber}: {p.elapsedPct}% of time elapsed
                          {p.past50 ? ' — past midpoint' : ' — before midpoint'}
                        </p>
                        <div className="mt-2 w-full rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${p.elapsedPct}%`, background: p.past50 ? '#10b981' : '#f59e0b' }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[10px]" style={{ color: '#6b5445' }}>Start</span>
                          <span className="text-[10px]" style={{ color: '#6b5445' }}>50%</span>
                          <span className="text-[10px]" style={{ color: '#6b5445' }}>Deadline</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Breakdown rows */}
                  <div className="space-y-2">
                    {/* Advance payment */}
                    {p.advanceFunded && (
                      <div className="flex items-center justify-between rounded-lg px-3 py-2.5"
                        style={{ background: 'rgba(18,10,2,0.6)', border: '1px solid rgba(255,104,3,0.1)' }}>
                        <div>
                          <p className="text-xs font-medium" style={{ color: '#F5EDE4' }}>Advance Payment</p>
                          <p className="text-[10px] mt-0.5" style={{ color: '#6b5445' }}>
                            → {p.advanceGoesTo === 'freelancer' ? 'Released to freelancer' : 'Refunded to client'}
                          </p>
                        </div>
                        <span className="text-sm font-bold" style={{ color: p.advanceGoesTo === 'freelancer' ? '#FF6803' : '#60a5fa' }}>{fmt(p.advanceAmount)}</span>
                      </div>
                    )}

                    {/* Phase payment breakdown */}
                    {p.scenario === 2 && !p.allComplete && p.phaseAmount > 0 && (
                      <>
                        {p.past50 ? (
                          <div className="flex items-center justify-between rounded-lg px-3 py-2.5"
                            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                            <div>
                              <p className="text-xs font-medium" style={{ color: '#10b981' }}>Phase {p.activePhaseNumber} — Full Payment</p>
                              <p className="text-[10px] mt-0.5" style={{ color: '#6b5445' }}>Work is past midpoint — freelancer receives full amount</p>
                            </div>
                            <span className="text-sm font-bold" style={{ color: '#10b981' }}>{fmt(p.phaseAmount)}</span>
                          </div>
                        ) : (
                          <>
                            {/* Penalty row */}
                            <div className="flex items-center justify-between rounded-lg px-3 py-2.5"
                              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                              <div>
                                <p className="text-xs font-medium" style={{ color: '#f87171' }}>
                                  15% Penalty {isClient ? '(you pay)' : '(deducted from your wallet)'}
                                </p>
                                <p className="text-[10px] mt-0.5" style={{ color: '#6b5445' }}>
                                  {isClient ? '→ Freelancer' : '→ Client'} as compensation
                                </p>
                              </div>
                              <span className="text-sm font-bold" style={{ color: '#f87171' }}>{fmt(p.penalty)}</span>
                            </div>

                            {/* Refund row */}
                            {p.phaseRefundToClient > 0 && (
                              <div className="flex items-center justify-between rounded-lg px-3 py-2.5"
                                style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                                <div>
                                  <p className="text-xs font-medium" style={{ color: '#60a5fa' }}>
                                    {isClient ? '85% Refund (you receive)' : 'Full Refund → Client'}
                                  </p>
                                  <p className="text-[10px] mt-0.5" style={{ color: '#6b5445' }}>Phase {p.activePhaseNumber} funds returned</p>
                                </div>
                                <span className="text-sm font-bold" style={{ color: '#60a5fa' }}>{fmt(p.phaseRefundToClient)}</span>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {/* No advance, no active phase */}
                    {!p.advanceFunded && p.phaseAmount === 0 && (
                      <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(18,10,2,0.6)', border: '1px solid rgba(255,104,3,0.08)' }}>
                        <p className="text-xs" style={{ color: '#6b5445' }}>No funds are currently held. The contract will be closed.</p>
                      </div>
                    )}
                  </div>

                  {/* Remaining phases note */}
                  <p className="text-[10px]" style={{ color: '#6b5445' }}>
                    All unfunded phases will be closed. Previously released payments are unaffected.
                  </p>
                </div>
              )
            })() : null}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={() => setShowWithdrawModal(false)} disabled={withdrawing}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#BFBFBF', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancel
            </button>
            <button onClick={handleWithdraw} disabled={withdrawing || withdrawPreviewLoading || !withdrawPreview}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              {withdrawing ? (
                <><div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" /> Processing…</>
              ) : 'Confirm Withdrawal'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
