import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import SkillSelector from '../components/SkillSelector'
import toast, { Toaster } from 'react-hot-toast'
import {
  FREELANCER_BADGES, CLIENT_BADGES, BADGE_COLORS,
  computeBadges, storeBadgeSummary
} from '../utils/badges'

// Upload files are served by the Express server (port 5001), not Vite (5173).
// All /uploads/... URLs must be prefixed with the backend base URL.
const FILE_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const INDUSTRIES = [
  'Technology', 'Finance & Fintech', 'Healthcare', 'E-commerce', 'Education',
  'Media & Entertainment', 'Real Estate', 'Manufacturing', 'Consulting', 'Other'
]

const YEARS_HIRING_OPTIONS = [
  { value: 'first-time', label: 'First time', sub: "Haven't hired a freelancer before" },
  { value: '1-2', label: '1–2 years', sub: 'Some experience hiring' },
  { value: '3-5', label: '3–5 years', sub: 'Comfortable with the process' },
  { value: '5+', label: '5+ years', sub: 'Experienced client' },
]

const COMM_OPTIONS = [
  { value: 'async', label: 'Async', sub: 'Messages & docs, respond in your own time' },
  { value: 'sync', label: 'Sync', sub: 'Regular calls and real-time check-ins' },
  { value: 'flexible', label: 'Flexible', sub: 'Mix of both depending on the project' },
]

const COMPANY_SIZES = ['solo', '2–10', '11–50', '51–200', '200+']
// stored values map to display labels
const COMPANY_SIZE_VALUES = ['solo', '2-10', '11-50', '51-200', '200+']

function isValidUrl(url) {
  if (!url) return true
  try { new URL(url); return true } catch { return false }
}

// ─── Completion calculator (mirrors server/utils/profileCompletion.js) ────────
function calcCompletion(role, p) {
  if (!p) return 20
  if (role === 'freelancer') {
    let pct = 20
    if (p.bio) pct += 15
    if (p.skills && p.skills.length > 0) pct += 15
    if (p.hourlyRate) pct += 10
    if (p.githubUrl) pct += 10
    if (p.linkedinUrl) pct += 5
    if (p.portfolioUrl) pct += 5
    if (p.projectSamples && p.projectSamples.length > 0) pct += 10
    if (p.resumeUrl) pct += 10
    return Math.min(100, pct)
  } else {
    if (p.clientType === 'individual') {
      let pct = 20
      if (p.bio) pct += 15
      if (p.avatarUrl) pct += 15
      if (p.location) pct += 15
      if (p.yearsHiring) pct += 15
      if (p.linkedinUrl) pct += 10
      if (p.preferredComm) pct += 10
      if (p.paymentVerified) pct += 10
      return Math.min(100, pct)
    } else if (p.clientType === 'business') {
      let pct = 5
      if (p.bio) pct += 10
      if (p.avatarUrl) pct += 10
      if (p.location) pct += 10
      if (p.yearsHiring) pct += 10
      if (p.companyName) pct += 10
      if (p.industry) pct += 10
      if (p.companySize) pct += 10
      if (p.websiteUrl) pct += 5
      if (p.linkedinUrl) pct += 5
      if (p.preferredComm) pct += 5
      if (p.paymentVerified) pct += 10
      return Math.min(100, pct)
    } else {
      let pct = 20
      if (p.bio) pct += 10
      return Math.min(30, pct)
    }
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function Field({ label, hint, required, bonus, error, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-sm font-medium text-zinc-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
          {bonus && <span className="ml-1.5 text-xs text-zinc-400 font-normal">+{bonus}%</span>}
        </label>
        {hint && <span className="text-xs text-zinc-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function inputClass(hasErr) {
  return `w-full border rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none transition-colors ${
    hasErr ? 'border-red-300 bg-red-50' : 'border-zinc-200 focus:border-zinc-400'
  }`
}

// ─── Badges card ──────────────────────────────────────────────────────────────
function BadgesCard({ user, portfolio }) {
  const { earned, locked, total } = computeBadges(user?.role, user, portfolio)

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Badges & Achievements</h3>
        <span className="text-xs text-zinc-400">{earned.length} / {total} earned</span>
      </div>

      {earned.length === 0 && locked.length === 0 && (
        <p className="text-sm text-zinc-400 italic">Complete your profile to start earning badges.</p>
      )}

      {/* Earned */}
      {earned.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {earned.map(badge => {
            const c = BADGE_COLORS[badge.color]
            return (
              <div key={badge.id} className={`flex items-center gap-2.5 border rounded-xl px-3 py-2.5 ${c.earned}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base ${c.icon}`}>
                  {badge.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight truncate">{badge.title}</p>
                  <p className="text-xs opacity-70 mt-0.5 leading-tight truncate">{badge.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <>
          {earned.length > 0 && (
            <p className="text-xs text-zinc-400 font-medium mb-2 mt-1">Still to unlock</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {locked.map(badge => (
              <div key={badge.id} className="flex items-center gap-2.5 border border-zinc-100 rounded-xl px-3 py-2.5 bg-zinc-50 opacity-60">
                <div className="w-8 h-8 rounded-lg bg-zinc-200 flex items-center justify-center flex-shrink-0 text-base grayscale">
                  {badge.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-500 leading-tight truncate">{badge.title}</p>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-tight truncate">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Payment Verify Modal ─────────────────────────────────────────────────────
// Multi-step UPI verification flow. Steps: method → upi → verifying → success
function PaymentVerifyModal({ onClose, onVerified }) {
  const [step, setStep] = useState('method')   // method | upi | verifying | success
  const [method, setMethod] = useState('')
  const [upiId, setUpiId] = useState('')
  const [upiError, setUpiError] = useState('')

  const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/

  const handleMethodSelect = (m) => {
    setMethod(m)
    setStep('upi')
  }

  const handleVerify = async () => {
    if (!UPI_REGEX.test(upiId.trim())) {
      setUpiError('Enter a valid UPI ID (e.g. yourname@upi or name@okaxis)')
      return
    }
    setUpiError('')
    setStep('verifying')
    // Simulate Razorpay UPI verification delay, then call the backend
    await new Promise(r => setTimeout(r, 2200))
    try {
      const { data } = await api.post('/api/portfolio/verify-payment')
      setStep('success')
      onVerified(data.completionPercent)
    } catch {
      toast.error('Verification failed. Please try again.')
      setStep('upi')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={step !== 'verifying' ? onClose : undefined} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Verify Payment Method</h2>
              <p className="text-xs text-zinc-400">Powered by Razorpay</p>
            </div>
          </div>
          {step !== 'verifying' && (
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Step: method selection */}
          {step === 'method' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-zinc-700 font-medium mb-1">Why verify?</p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  A verified payment badge shows freelancers you are a legitimate client and increases the quality of bids you receive. A small ₹1 charge is made and immediately refunded.
                </p>
              </div>
              <p className="text-sm font-medium text-zinc-700">Choose a payment method</p>
              <div className="space-y-2">
                {[
                  { id: 'upi', icon: '📲', title: 'UPI', sub: 'Pay via any UPI app — GPay, PhonePe, Paytm, BHIM' },
                  { id: 'card', icon: '💳', title: 'Debit / Credit Card', sub: 'Visa, Mastercard, RuPay' },
                  { id: 'netbanking', icon: '🏦', title: 'Net Banking', sub: 'All major Indian banks supported' },
                ].map(opt => (
                  <button key={opt.id} type="button" onClick={() => handleMethodSelect(opt.id)}
                    className="w-full text-left flex items-center gap-3 border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 rounded-xl px-4 py-3 transition-all group">
                    <span className="text-xl w-8 text-center">{opt.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-800">{opt.title}</p>
                      <p className="text-xs text-zinc-400">{opt.sub}</p>
                    </div>
                    <svg className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: UPI input (covers UPI, card, netbanking — all ask for UPI ID in demo) */}
          {step === 'upi' && (
            <div className="space-y-4">
              <button onClick={() => setStep('method')} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors mb-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3">
                <span className="text-base mt-0.5">ℹ️</span>
                <p className="text-xs text-amber-800 leading-relaxed">
                  A ₹1 refundable charge will be placed on your payment method to confirm it is valid. The amount is refunded within seconds.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700 block mb-1.5">
                  {method === 'upi' ? 'Your UPI ID' : method === 'card' ? 'UPI ID linked to your card' : 'UPI ID linked to your bank'}
                </label>
                <input
                  value={upiId}
                  onChange={e => { setUpiId(e.target.value); setUpiError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors ${
                    upiError ? 'border-red-300 bg-red-50' : 'border-zinc-200 focus:border-zinc-400'
                  }`}
                  placeholder="yourname@upi or name@okaxis"
                  autoFocus
                />
                {upiError
                  ? <p className="text-xs text-red-500 mt-1">{upiError}</p>
                  : <p className="text-xs text-zinc-400 mt-1">Format: handle@bank (e.g. rahul@okhdfc, priya@oksbi)</p>
                }
              </div>

              <button onClick={handleVerify}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                Verify ₹1 charge
              </button>
            </div>
          )}

          {/* Step: verifying */}
          {step === 'verifying' && (
            <div className="py-8 text-center space-y-4">
              <div className="relative mx-auto w-16 h-16">
                <div className="w-16 h-16 border-4 border-zinc-100 rounded-full" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-t-zinc-900 rounded-full animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">Verifying with Razorpay…</p>
                <p className="text-xs text-zinc-400 mt-1">Processing ₹1 charge on {upiId}</p>
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-zinc-400 pt-2">
                {['Initiating', 'Processing', 'Confirming'].map((label, i) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: success */}
          {step === 'success' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-900">Payment method verified!</p>
                <p className="text-xs text-zinc-500 mt-1">The ₹1 charge has been refunded to {upiId}</p>
              </div>
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-left space-y-1.5">
                {[
                  'Payment Verified badge on your profile',
                  'Higher quality bids from freelancers',
                  'Faster contract creation',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs text-zinc-600">{item}</span>
                  </div>
                ))}
              </div>
              <button onClick={onClose}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Avatar display ───────────────────────────────────────────────────────────
function Avatar({ url, name, size = 14, shape = 'circle' }) {
  const sizeClass = `w-${size} h-${size}`
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl'
  // url is a relative path like /uploads/... served by Express — must prefix with FILE_BASE
  const fullUrl = url ? (url.startsWith('http') ? url : `${FILE_BASE}${url}`) : null
  if (fullUrl) {
    return (
      <img src={fullUrl} alt={name}
        className={`${sizeClass} ${shapeClass} object-cover border border-zinc-200`} />
    )
  }
  return (
    <div className={`${sizeClass} ${shapeClass} bg-zinc-900 flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ fontSize: size > 10 ? '1.25rem' : '0.875rem' }}>
      {name?.[0]?.toUpperCase()}
    </div>
  )
}

// ─── Profile Card (view mode) ─────────────────────────────────────────────────
function ProfileCard({ portfolio, user, fullUser, completion, onEdit, onCompletionChange }) {
  const isFreelancer = user?.role === 'freelancer'
  const completionColor = completion < 40 ? 'bg-red-500' : completion < 70 ? 'bg-amber-500' : completion < 100 ? 'bg-blue-500' : 'bg-emerald-500'
  const completionText = completion < 40 ? 'text-red-600' : completion < 70 ? 'text-amber-600' : completion < 100 ? 'text-blue-600' : 'text-emerald-600'
  const isIndividual = portfolio?.clientType === 'individual'
  const isBusiness = portfolio?.clientType === 'business'
  const avatarShape = isBusiness ? 'square' : 'circle'
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [isVerified, setIsVerified] = useState(portfolio?.paymentVerified || false)

  const handleVerified = (newPct) => {
    setIsVerified(true)
    setShowVerifyModal(false)
    if (newPct) onCompletionChange?.(newPct)
    localStorage.setItem('profileCompletion', String(newPct || completion))
    window.dispatchEvent(new Event('profileUpdated'))
    toast.success('Payment method verified!')
  }

  return (
    <div className="space-y-4">
      {showVerifyModal && (
        <PaymentVerifyModal onClose={() => setShowVerifyModal(false)} onVerified={handleVerified} />
      )}
      {/* Header */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar url={portfolio?.avatarUrl} name={user?.name} size={14} shape={avatarShape} />
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{user?.name}</h2>
              {isBusiness && portfolio?.companyName && (
                <p className="text-sm text-zinc-500">{portfolio.companyName}</p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {isFreelancer ? (
                  <>
                    <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md font-medium capitalize">
                      {user?.role}
                    </span>
                    {portfolio?.availability && (
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                        portfolio.availability === 'full-time' ? 'bg-emerald-50 text-emerald-700' :
                        portfolio.availability === 'part-time' ? 'bg-amber-50 text-amber-700' :
                        'bg-zinc-100 text-zinc-500'
                      }`}>{portfolio.availability}</span>
                    )}
                    {portfolio?.hourlyRate > 0 && (
                      <span className="text-sm font-medium text-zinc-700">₹{portfolio.hourlyRate}/hr</span>
                    )}
                  </>
                ) : (
                  <>
                    {portfolio?.clientType && (
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                        isIndividual ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {isIndividual ? 'Individual' : 'Business'}
                      </span>
                    )}
                    {isBusiness && portfolio?.industry && (
                      <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md font-medium">
                        {portfolio.industry}
                      </span>
                    )}
                    {isVerified && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Payment Verified
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={onEdit}
            className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
            </svg>
            Edit
          </button>
        </div>
        {portfolio?.bio
          ? <p className="mt-4 text-zinc-600 text-sm leading-relaxed border-t border-zinc-100 pt-4">{portfolio.bio}</p>
          : <p className="mt-4 text-zinc-400 text-sm italic border-t border-zinc-100 pt-4">No bio added yet.</p>
        }
      </div>

      {/* Skills (freelancer) */}
      {isFreelancer && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Skills</h3>
          {portfolio?.skills?.length > 0
            ? <div className="flex flex-wrap gap-1.5">
                {portfolio.skills.map(skill => (
                  <span key={skill} className="bg-zinc-100 text-zinc-700 text-xs font-medium px-2.5 py-1 rounded-md">{skill}</span>
                ))}
              </div>
            : <p className="text-zinc-400 text-sm italic">No skills added yet.</p>
          }
        </div>
      )}

      {/* Details */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Details</h3>
        <div className="space-y-3">
          {/* Freelancer details */}
          {isFreelancer && portfolio?.githubUrl && (
            <DetailRow icon="💻" label="GitHub">
              <a href={portfolio.githubUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-zinc-700 hover:underline underline-offset-2 font-medium break-all">{portfolio.githubUrl}</a>
            </DetailRow>
          )}
          {portfolio?.linkedinUrl && (
            <DetailRow icon="🔗" label="LinkedIn">
              <a href={portfolio.linkedinUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-zinc-700 hover:underline underline-offset-2 font-medium break-all">{portfolio.linkedinUrl}</a>
            </DetailRow>
          )}
          {isFreelancer && portfolio?.portfolioUrl && (
            <DetailRow icon="🌐" label="Portfolio">
              <a href={portfolio.portfolioUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-zinc-700 hover:underline underline-offset-2 font-medium break-all">{portfolio.portfolioUrl}</a>
            </DetailRow>
          )}
          {isFreelancer && portfolio?.resumeUrl && (
            <DetailRow icon="📄" label="Resume">
              <span className="text-sm text-emerald-600 font-medium">Uploaded</span>
            </DetailRow>
          )}
          {isFreelancer && portfolio?.projectSamples?.length > 0 && (
            <DetailRow icon="📎" label="Portfolio Samples">
              <span className="text-sm text-zinc-700 font-medium">{portfolio.projectSamples.length} sample{portfolio.projectSamples.length > 1 ? 's' : ''}</span>
            </DetailRow>
          )}

          {/* Client details */}
          {!isFreelancer && isBusiness && portfolio?.companySize && (
            <DetailRow icon="👥" label="Company Size">
              <span className="text-sm text-zinc-700 font-medium">{portfolio.companySize} people</span>
            </DetailRow>
          )}
          {!isFreelancer && isBusiness && portfolio?.websiteUrl && (
            <DetailRow icon="🌐" label="Website">
              <a href={portfolio.websiteUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-zinc-700 hover:underline underline-offset-2 font-medium break-all">{portfolio.websiteUrl}</a>
            </DetailRow>
          )}
          {!isFreelancer && portfolio?.location && (
            <DetailRow icon="📍" label="Location">
              <span className="text-sm text-zinc-700 font-medium">{portfolio.location}</span>
            </DetailRow>
          )}
          {!isFreelancer && portfolio?.yearsHiring && (
            <DetailRow icon="🕐" label="Hiring Experience">
              <span className="text-sm text-zinc-700 font-medium">
                {YEARS_HIRING_OPTIONS.find(o => o.value === portfolio.yearsHiring)?.label || portfolio.yearsHiring}
              </span>
            </DetailRow>
          )}
          {!isFreelancer && portfolio?.preferredComm && (
            <DetailRow icon="💬" label="Communication">
              <span className="text-sm text-zinc-700 font-medium capitalize">{portfolio.preferredComm}</span>
            </DetailRow>
          )}

          {/* Empty state */}
          {!portfolio?.linkedinUrl && !portfolio?.githubUrl && !portfolio?.location &&
           !portfolio?.companyName && !portfolio?.websiteUrl && (
            <p className="text-zinc-400 text-sm italic">No details added yet.</p>
          )}
        </div>
      </div>

      {/* Payment Verification — clients only, always visible in view mode */}
      {!isFreelancer && (
        <div className={`rounded-xl border p-5 ${isVerified ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isVerified ? 'bg-emerald-100' : 'bg-zinc-100'}`}>
                <svg className={`w-5 h-5 ${isVerified ? 'text-emerald-600' : 'text-zinc-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm font-semibold ${isVerified ? 'text-emerald-800' : 'text-zinc-800'}`}>
                  {isVerified ? 'Payment Verified' : 'Payment Not Verified'}
                </p>
                <p className={`text-xs mt-0.5 ${isVerified ? 'text-emerald-600' : 'text-zinc-400'}`}>
                  {isVerified
                    ? 'Freelancers can see your payment method is valid'
                    : 'Verify to get better quality bids · +10%'}
                </p>
              </div>
            </div>
            {!isVerified && (
              <button onClick={() => setShowVerifyModal(true)}
                className="text-sm bg-zinc-900 hover:bg-zinc-800 text-white font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0">
                Verify now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Badges */}
      <BadgesCard user={fullUser || user} portfolio={portfolio} />

      {/* Completion */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-zinc-700">Profile Completion</h3>
          <span className={`text-lg font-bold ${completionText}`}>{completion}%</span>
        </div>
        <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
          <div className={`h-1.5 rounded-full transition-all duration-500 ${completionColor}`} style={{ width: `${completion}%` }} />
        </div>
        {completion < 100 && (
          <p className="text-xs text-zinc-400 mt-2">
            {completion < 40 ? 'Add more details to make your profile visible to others.' :
             completion < 70 ? 'A few more details will make your profile stand out.' :
             'Almost there — one last push to reach 100%!'}
          </p>
        )}
      </div>
    </div>
  )
}

function DetailRow({ icon, label, children }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-base w-5 text-center flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-zinc-400">{label}</p>
        {children}
      </div>
    </div>
  )
}

// ─── Profile Edit Form ────────────────────────────────────────────────────────
function ProfileEditForm({ portfolio, user, onSave, onCancel }) {
  const isFreelancer = user?.role === 'freelancer'
  const [form, setForm] = useState({
    bio: portfolio?.bio || '',
    skills: portfolio?.skills || [],
    githubUrl: portfolio?.githubUrl || '',
    linkedinUrl: portfolio?.linkedinUrl || '',
    portfolioUrl: portfolio?.portfolioUrl || '',
    hourlyRate: portfolio?.hourlyRate || '',
    availability: portfolio?.availability || 'full-time',
    companyName: portfolio?.companyName || '',
    industry: portfolio?.industry || '',
    // new client fields
    clientType: portfolio?.clientType || '',
    location: portfolio?.location || '',
    yearsHiring: portfolio?.yearsHiring || '',
    preferredComm: portfolio?.preferredComm || '',
    companySize: portfolio?.companySize || '',
    websiteUrl: portfolio?.websiteUrl || '',
  })
  const [errors, setErrors] = useState({})
  const [uploading, setUploading] = useState(false)
  const [resumeUploading, setResumeUploading] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [sampleTitle, setSampleTitle] = useState('')
  const [localPortfolio, setLocalPortfolio] = useState(portfolio)
  const [saving, setSaving] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)

  const isIndividual = form.clientType === 'individual'
  const isBusiness = form.clientType === 'business'

  const validate = () => {
    const e = {}
    if (!form.bio.trim()) e.bio = 'Bio is required'
    else if (form.bio.trim().length < 20) e.bio = 'Bio must be at least 20 characters'
    else if (form.bio.trim().length > 1000) e.bio = 'Bio cannot exceed 1000 characters'
    if (isFreelancer) {
      if (form.skills.length === 0) e.skills = 'Add at least one skill'
      if (!form.hourlyRate || Number(form.hourlyRate) <= 0) e.hourlyRate = 'Hourly rate is required'
      if (form.githubUrl && !isValidUrl(form.githubUrl)) e.githubUrl = 'Enter a valid URL'
      if (form.portfolioUrl && !isValidUrl(form.portfolioUrl)) e.portfolioUrl = 'Enter a valid URL'
    } else {
      if (!form.clientType) e.clientType = 'Please select your client type'
      if (isBusiness && !form.industry) e.industry = 'Please select your industry'
      if (form.websiteUrl && !isValidUrl(form.websiteUrl)) e.websiteUrl = 'Enter a valid URL'
    }
    if (form.linkedinUrl && !isValidUrl(form.linkedinUrl)) e.linkedinUrl = 'Enter a valid URL'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) { toast.error('Please fix the errors before saving'); return }
    setSaving(true)
    try {
      const { data } = await api.post('/api/portfolio/update', { ...form, skills: form.skills })
      localStorage.setItem('profileCompletion', String(data.completionPercent || 20))
      window.dispatchEvent(new Event('profileUpdated'))
      onSave({ ...data, avatarUrl: localPortfolio?.avatarUrl || data.avatarUrl })
      toast.success('Profile saved!')
    } catch { toast.error('Failed to save profile') }
    finally { setSaving(false) }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAvatarUploading(true)
    const fd = new FormData()
    fd.append('avatar', file)
    try {
      const { data } = await api.post('/api/portfolio/upload-avatar', fd)
      setLocalPortfolio(prev => ({ ...prev, avatarUrl: data.avatarUrl }))
      localStorage.setItem('profileCompletion', String(data.completionPercent || 20))
      window.dispatchEvent(new Event('profileUpdated'))
      toast.success('Photo uploaded!')
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Upload failed'
      toast.error(msg)
      console.error('Avatar upload error:', err?.response?.data || err?.message)
    }
    finally { setAvatarUploading(false) }
  }

  const handleVerified = (newPct) => {
    setLocalPortfolio(prev => ({ ...prev, paymentVerified: true }))
    setShowVerifyModal(false)
    if (newPct) {
      localStorage.setItem('profileCompletion', String(newPct))
      window.dispatchEvent(new Event('profileUpdated'))
    }
    toast.success('Payment method verified!')
  }

  const handleSampleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', sampleTitle || file.name)
    try {
      const { data } = await api.post('/api/portfolio/upload-sample', fd)
      setLocalPortfolio(prev => ({ ...prev, projectSamples: [...(prev?.projectSamples || []), data.sample] }))
      localStorage.setItem('profileCompletion', String(data.completionPercent || 20))
      window.dispatchEvent(new Event('profileUpdated'))
      setSampleTitle('')
      toast.success('Portfolio sample uploaded!')
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setResumeUploading(true)
    const fd = new FormData()
    fd.append('resume', file)
    try {
      const { data } = await api.post('/api/portfolio/upload-resume', fd)
      setLocalPortfolio(prev => ({ ...prev, resumeUrl: data.resumeUrl }))
      localStorage.setItem('profileCompletion', String(data.completionPercent || 20))
      window.dispatchEvent(new Event('profileUpdated'))
      toast.success('Resume uploaded!')
    } catch { toast.error('Upload failed') }
    finally { setResumeUploading(false) }
  }

  const avatarShape = isBusiness ? 'rounded-xl' : 'rounded-full'

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <h3 className="text-base font-semibold text-zinc-900">
            {isFreelancer ? 'Freelancer Profile' : 'Client Profile'}
          </h3>
          <span className="text-xs text-zinc-400">Fields marked <span className="text-red-500">*</span> are required</span>
        </div>

        {/* ── Client Type Selector ── */}
        {!isFreelancer && (
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-2">
              Who are you? <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-zinc-400 mb-3">This helps freelancers understand your context before applying.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: 'individual',
                  icon: '👤',
                  title: 'Individual',
                  sub: 'Building something for yourself, a side project, or a personal idea',
                },
                {
                  value: 'business',
                  icon: '🏢',
                  title: 'Business',
                  sub: 'A startup, company, or agency hiring on behalf of an organisation',
                },
              ].map(opt => {
                const selected = form.clientType === opt.value
                return (
                  <button key={opt.value} type="button"
                    onClick={() => { setForm({ ...form, clientType: opt.value }); setErrors({ ...errors, clientType: '' }) }}
                    className={`text-left border-2 rounded-xl p-4 transition-all ${
                      selected
                        ? 'border-zinc-900 bg-zinc-50'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xl">{opt.icon}</span>
                      <span className={`text-sm font-semibold ${selected ? 'text-zinc-900' : 'text-zinc-700'}`}>{opt.title}</span>
                      {selected && (
                        <svg className="w-4 h-4 text-zinc-900 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{opt.sub}</p>
                  </button>
                )
              })}
            </div>
            {errors.clientType && <p className="text-xs text-red-500 mt-1">{errors.clientType}</p>}
          </div>
        )}

        {/* ── Avatar / Logo Upload ── */}
        {(!isFreelancer && form.clientType) || isFreelancer ? (
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-2">
              {isFreelancer ? 'Profile Photo' : isBusiness ? 'Company Logo' : 'Profile Photo'}
              <span className="ml-1.5 text-xs text-zinc-400 font-normal">
                {isFreelancer ? '' : '+' + (isIndividual ? '15' : '10') + '%'}
              </span>
            </label>
            <div className="flex items-center gap-4">
              {/* Preview */}
              {localPortfolio?.avatarUrl
                ? <img
                    src={localPortfolio.avatarUrl.startsWith('http') ? localPortfolio.avatarUrl : `${FILE_BASE}${localPortfolio.avatarUrl}`}
                    alt="avatar"
                    className={`w-16 h-16 object-cover border border-zinc-200 ${avatarShape}`} />
                : <div className={`w-16 h-16 bg-zinc-100 border-2 border-dashed border-zinc-300 flex items-center justify-center ${avatarShape}`}>
                    <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
              }
              <div>
                <label className="cursor-pointer inline-flex items-center gap-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {avatarUploading ? 'Uploading…' : localPortfolio?.avatarUrl ? 'Change photo' : 'Upload photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading} />
                </label>
                <p className="text-xs text-zinc-400 mt-1">JPG, PNG · Max 10 MB</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Business-only fields ── */}
        {!isFreelancer && isBusiness && (
          <>
            <Field label="Company Name" bonus={10} error={errors.companyName}>
              <input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })}
                className={inputClass(errors.companyName)} placeholder="e.g. TechStart Ltd" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Industry" required bonus={10} error={errors.industry}>
                <select value={form.industry}
                  onChange={e => { setForm({ ...form, industry: e.target.value }); setErrors({ ...errors, industry: '' }) }}
                  className={inputClass(errors.industry)}>
                  <option value="">Select industry</option>
                  {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </Field>
              <Field label="Company Size" bonus={10} error={errors.companySize}>
                <select value={form.companySize}
                  onChange={e => setForm({ ...form, companySize: e.target.value })}
                  className={inputClass(false)}>
                  <option value="">Select size</option>
                  {COMPANY_SIZE_VALUES.map((val, i) => (
                    <option key={val} value={val}>{COMPANY_SIZES[i]} people</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Company Website" bonus={5} error={errors.websiteUrl} hint="https://...">
              <input value={form.websiteUrl}
                onChange={e => { setForm({ ...form, websiteUrl: e.target.value }); setErrors({ ...errors, websiteUrl: '' }) }}
                className={inputClass(errors.websiteUrl)} placeholder="https://yourcompany.com" />
            </Field>
          </>
        )}

        {/* ── Bio ── */}
        {(isFreelancer || form.clientType) && (
          <Field label="Bio" required bonus={isFreelancer ? 15 : isIndividual ? 15 : 10} hint={`${form.bio.length}/1000`} error={errors.bio}>
            <textarea value={form.bio}
              onChange={e => { setForm({ ...form, bio: e.target.value }); setErrors({ ...errors, bio: '' }) }}
              rows={4} maxLength={1000} className={inputClass(errors.bio)}
              placeholder={
                isFreelancer
                  ? 'Describe your expertise, projects you work on, and what makes you stand out…'
                  : isIndividual
                  ? 'Describe what you are building, why it matters to you, and what kind of freelancer you are looking for…'
                  : 'Describe what your company does, the types of projects you hire for, and what you look for in a freelancer…'
              }
            />
          </Field>
        )}

        {/* ── Freelancer-specific fields ── */}
        {isFreelancer && (
          <>
            <Field label="Skills" required bonus={15} error={errors.skills}>
              <SkillSelector selected={form.skills}
                onChange={skills => { setForm({ ...form, skills }); setErrors({ ...errors, skills: '' }) }}
                error={errors.skills} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Hourly Rate (₹)" required bonus={10} error={errors.hourlyRate}>
                <input type="number" min="1" value={form.hourlyRate}
                  onChange={e => { setForm({ ...form, hourlyRate: e.target.value }); setErrors({ ...errors, hourlyRate: '' }) }}
                  className={inputClass(errors.hourlyRate)} placeholder="e.g. 500" />
              </Field>
              <Field label="Availability">
                <select value={form.availability} onChange={e => setForm({ ...form, availability: e.target.value })}
                  className={inputClass(false)}>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </Field>
            </div>
            <Field label="GitHub URL" bonus={10} error={errors.githubUrl} hint="https://...">
              <input value={form.githubUrl}
                onChange={e => { setForm({ ...form, githubUrl: e.target.value }); setErrors({ ...errors, githubUrl: '' }) }}
                className={inputClass(errors.githubUrl)} placeholder="https://github.com/username" />
            </Field>
          </>
        )}

        {/* ── Shared client fields (shown once clientType is chosen) ── */}
        {!isFreelancer && form.clientType && (
          <>
            <Field label="Location" bonus={isIndividual ? 15 : 10} error={errors.location}>
              <input value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                className={inputClass(false)} placeholder="e.g. Mumbai, India" />
            </Field>

            <Field label="Years hiring freelancers" bonus={isIndividual ? 15 : 10} error={errors.yearsHiring}>
              <div className="grid grid-cols-2 gap-2">
                {YEARS_HIRING_OPTIONS.map(opt => {
                  const selected = form.yearsHiring === opt.value
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => setForm({ ...form, yearsHiring: opt.value })}
                      className={`text-left border rounded-lg px-3 py-2.5 transition-all ${
                        selected ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
                      }`}>
                      <p className={`text-sm font-medium ${selected ? 'text-zinc-900' : 'text-zinc-700'}`}>{opt.label}</p>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-tight">{opt.sub}</p>
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="Preferred communication style" bonus={isIndividual ? 10 : 5} error={errors.preferredComm}>
              <div className="grid grid-cols-3 gap-2">
                {COMM_OPTIONS.map(opt => {
                  const selected = form.preferredComm === opt.value
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => setForm({ ...form, preferredComm: opt.value })}
                      className={`text-left border rounded-lg px-3 py-2.5 transition-all ${
                        selected ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
                      }`}>
                      <p className={`text-sm font-medium ${selected ? 'text-zinc-900' : 'text-zinc-700'}`}>{opt.label}</p>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-tight">{opt.sub}</p>
                    </button>
                  )
                })}
              </div>
            </Field>
          </>
        )}

        <Field label="LinkedIn URL" bonus={isFreelancer ? 5 : isIndividual ? 10 : 5} error={errors.linkedinUrl} hint="https://...">
          <input value={form.linkedinUrl}
            onChange={e => { setForm({ ...form, linkedinUrl: e.target.value }); setErrors({ ...errors, linkedinUrl: '' }) }}
            className={inputClass(errors.linkedinUrl)} placeholder="https://linkedin.com/in/username" />
        </Field>

        {isFreelancer && (
          <Field label="Portfolio Website" bonus={5} error={errors.portfolioUrl} hint="https://...">
            <input value={form.portfolioUrl}
              onChange={e => { setForm({ ...form, portfolioUrl: e.target.value }); setErrors({ ...errors, portfolioUrl: '' }) }}
              className={inputClass(errors.portfolioUrl)} placeholder="https://yourportfolio.com" />
          </Field>
        )}

        <div className="flex gap-3 pt-2 border-t border-zinc-100">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
          <button onClick={onCancel}
            className="flex-1 border border-zinc-200 text-zinc-600 font-medium py-2.5 rounded-lg text-sm hover:bg-zinc-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>

      {/* ── Payment Verification — all clients ── */}
      {!isFreelancer && form.clientType && (
        <>
          {showVerifyModal && (
            <PaymentVerifyModal onClose={() => setShowVerifyModal(false)} onVerified={handleVerified} />
          )}
          <div className={`rounded-xl border p-5 ${localPortfolio?.paymentVerified ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${localPortfolio?.paymentVerified ? 'bg-emerald-100' : 'bg-zinc-100'}`}>
                  <svg className={`w-5 h-5 ${localPortfolio?.paymentVerified ? 'text-emerald-600' : 'text-zinc-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${localPortfolio?.paymentVerified ? 'text-emerald-800' : 'text-zinc-800'}`}>
                    {localPortfolio?.paymentVerified ? 'Payment Verified' : 'Payment Not Verified'}
                  </p>
                  <p className={`text-xs mt-0.5 ${localPortfolio?.paymentVerified ? 'text-emerald-600' : 'text-zinc-400'}`}>
                    {localPortfolio?.paymentVerified
                      ? 'Freelancers can see your payment method is valid'
                      : 'Verify to get better quality bids · +10%'}
                  </p>
                </div>
              </div>
              {!localPortfolio?.paymentVerified && (
                <button onClick={() => setShowVerifyModal(true)}
                  className="text-sm bg-zinc-900 hover:bg-zinc-800 text-white font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0">
                  Verify now
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Portfolio samples & resume (freelancer only) ── */}
      {isFreelancer && (
        <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
          <h3 className="text-base font-semibold text-zinc-900 border-b border-zinc-100 pb-4">
            Portfolio Samples & Resume
          </h3>

          {localPortfolio?.projectSamples?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-zinc-700 mb-2">
                Uploaded samples ({localPortfolio.projectSamples.length})
              </p>
              <div className="space-y-2">
                {localPortfolio.projectSamples.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-lg px-4 py-2.5">
                    <span className="text-base">📎</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-700 truncate">{s.title}</p>
                      <p className="text-xs text-zinc-400 font-mono truncate">{s.fileHash?.slice(0, 24)}…</p>
                    </div>
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium whitespace-nowrap">
                      SHA-256 ✓
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Add Portfolio Sample
                {!(localPortfolio?.projectSamples?.length > 0) && (
                  <span className="ml-1.5 text-xs text-zinc-400 font-normal">+10%</span>
                )}
              </label>
            </div>
            <p className="text-xs text-zinc-400 mb-2">Each file is SHA-256 hashed for proof of authenticity.</p>
            <input value={sampleTitle} onChange={e => setSampleTitle(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400 transition-colors mb-2"
              placeholder="Sample title (e.g. E-Commerce App)" />
            <label className="block cursor-pointer bg-zinc-50 hover:bg-zinc-100 border-2 border-dashed border-zinc-200 hover:border-zinc-400 rounded-lg p-5 text-center transition-colors">
              <p className="text-sm text-zinc-600 font-medium">
                {uploading ? 'Uploading & generating hash…' : 'Click to upload portfolio sample'}
              </p>
              <p className="text-xs text-zinc-400 mt-1">Images, PDFs, zip files · Max 10 MB</p>
              <input type="file" className="hidden" onChange={handleSampleUpload} disabled={uploading} />
            </label>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Resume (PDF)
                {!localPortfolio?.resumeUrl && <span className="ml-1.5 text-xs text-zinc-400 font-normal">+10%</span>}
              </label>
            </div>
            {localPortfolio?.resumeUrl ? (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                <span className="text-lg">📄</span>
                <p className="text-sm text-emerald-700 font-medium flex-1">Resume uploaded</p>
                <label className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
                  Replace
                  <input type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} />
                </label>
              </div>
            ) : (
              <label className="block cursor-pointer bg-zinc-50 hover:bg-zinc-100 border-2 border-dashed border-zinc-200 hover:border-zinc-400 rounded-lg p-5 text-center transition-colors">
                <p className="text-sm text-zinc-600 font-medium">
                  {resumeUploading ? 'Uploading…' : 'Click to upload resume PDF'}
                </p>
                <p className="text-xs text-zinc-400 mt-1">PDF only · Max 10 MB</p>
                <input type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} disabled={resumeUploading} />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page root ────────────────────────────────────────────────────────────────
export default function ProfileSetup() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const [portfolio, setPortfolio] = useState(null)
  const [fullUser, setFullUser] = useState(null)   // full User doc — has rating, totalJobsCompleted, etc.
  const [completion, setCompletion] = useState(parseInt(localStorage.getItem('profileCompletion') || '20', 10))
  const [mode, setMode] = useState('loading')

  useEffect(() => {
    api.get('/api/auth/me').then(({ data }) => {
      const p = data.portfolio
      setPortfolio(p)
      setFullUser(data.user)
      const role = data.user?.role || user?.role
      const pct = calcCompletion(role, p)
      setCompletion(pct)
      localStorage.setItem('profileCompletion', String(pct))
      storeBadgeSummary(role, data.user, p)
      window.dispatchEvent(new Event('profileUpdated'))
      setMode(!p?.bio ? 'edit' : 'view')
    }).catch(() => setMode('edit'))
  }, [])

  const handleSaved = (updatedPortfolio) => {
    setPortfolio(updatedPortfolio)
    const pct = calcCompletion(user?.role, updatedPortfolio)
    setCompletion(pct)
    localStorage.setItem('profileCompletion', String(pct))
    window.dispatchEvent(new Event('profileUpdated'))
    setMode('view')
  }

  const handleCancel = () => {
    if (!portfolio?.bio) navigate(user?.role === 'client' ? '/dashboard/client' : '/dashboard/freelancer')
    else setMode('view')
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <Toaster />
      <Navbar />
      <div className="max-w-2xl mx-auto p-6 pb-16">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">My Profile</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {mode === 'edit' ? 'Fill in your details and save' : 'How others see your profile'}
            </p>
          </div>
          {mode === 'view' && (
            <button onClick={() => navigate(user?.role === 'client' ? '/dashboard/client' : '/dashboard/freelancer')}
              className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
              ← Dashboard
            </button>
          )}
        </div>

        {mode === 'loading' && (
          <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center">
            <div className="w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Loading your profile…</p>
          </div>
        )}

        {mode === 'view' && portfolio && (
          <ProfileCard portfolio={portfolio} user={user} fullUser={fullUser} completion={completion}
            onEdit={() => setMode('edit')}
            onCompletionChange={pct => setCompletion(pct)} />
        )}

        {mode === 'edit' && (
          <ProfileEditForm portfolio={portfolio} user={user} onSave={handleSaved} onCancel={handleCancel} />
        )}
      </div>
    </div>
  )
}
