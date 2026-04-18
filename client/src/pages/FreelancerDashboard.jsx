import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'
import { calcCompletion } from '../utils/profileCompletion'
import { useCountUp } from '../utils/useCountUp'

const FILE_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const PIPELINE = [
  { key: 'applied', label: 'Applied' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'hired', label: 'Hired' },
]

const TX_LABEL = {
  phase_payment: 'Phase Payment',
  advance_payment: 'Advance Payment',
  dispute_release: 'Dispute Release',
  split_payment: 'Split Payment',
  auto_release: 'Auto Release',
  withdrawal_penalty: 'Withdrawal Penalty',
  withdrawal_advance: 'Advance on Withdrawal',
  withdrawal_phase: 'Phase on Withdrawal',
}

function StatCard({ label, value, accent }) {
  const numeric = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0
  const prefix = typeof value === 'string' && value.startsWith('₹') ? '₹' : ''
  const animated = useCountUp(numeric, 1200, prefix)

  return (
    <div
      className="card-lift p-4 rounded-2xl"
      style={{
        background: accent
          ? 'linear-gradient(135deg, rgba(255,104,3,0.18) 0%, rgba(174,58,2,0.12) 100%)'
          : 'rgba(18,10,2,0.60)',
        border: accent ? '1px solid rgba(255,104,3,0.35)' : '1px solid rgba(255,104,3,0.10)',
        backdropFilter: 'blur(16px)',
        boxShadow: accent ? '0 0 24px rgba(255,104,3,0.15), inset 0 1px 0 rgba(255,255,255,0.06)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="text-2xl font-bold stat-number mb-0.5"
        style={{ color: accent ? '#FF6803' : '#F5EDE4', textShadow: accent ? '0 0 20px rgba(255,104,3,0.4)' : 'none' }}>
        {animated}
      </div>
      <div className="text-xs font-medium" style={{ color: '#6b5445' }}>{label}</div>
    </div>
  )
}

const sectionLabel = (text) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="h-px flex-1" style={{ background: 'rgba(255,104,3,0.12)' }} />
    <h2 className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#BFBFBF' }}>{text}</h2>
    <div className="h-px flex-1" style={{ background: 'rgba(255,104,3,0.12)' }} />
  </div>
)

export default function FreelancerDashboard() {
  const [contracts, setContracts] = useState([])
  const [applications, setApplications] = useState([])
  const [portfolio, setPortfolio] = useState(null)
  const [verificationStatus, setVerificationStatus] = useState('pending')
  const [walletBalance, setWalletBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const navigate = useNavigate()

  const refreshEarnings = () => {
    api.get('/api/transactions/my').then(({ data }) => {
      setWalletBalance(data.walletBalance)
      setTransactions(data.transactions)
    }).catch(() => {})
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/contracts/my-work'),
      api.get('/api/jobs/my-applications'),
      api.get('/api/auth/me'),
      api.get('/api/transactions/my'),
    ]).then(([c, a, me, tx]) => {
      setContracts(c.data)
      setApplications(a.data)
      setPortfolio(me.data.portfolio)
      setVerificationStatus(me.data.user?.verificationStatus || 'pending')
      setWalletBalance(tx.data.walletBalance)
      setTransactions(tx.data.transactions)
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    window.addEventListener('payoutsProcessed', refreshEarnings)
    return () => window.removeEventListener('payoutsProcessed', refreshEarnings)
  }, [])

  const activeContracts = contracts.filter(c => ['active', 'pending_advance'].includes(c.status))
  const totalEarned = transactions.reduce((sum, tx) => sum + tx.amount, 0)

  if (loading) return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <Navbar />
      <div className="flex items-center justify-center h-64 flex-col gap-4">
        <div className="w-48 h-4 shimmer-skeleton" />
        <div className="w-32 h-3 shimmer-skeleton" />
        <div className="grid grid-cols-4 gap-3 mt-4 w-full max-w-xl px-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 shimmer-skeleton rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">

        {/* Dashboard header */}
        <div style={{ marginBottom: '32px', padding: '28px 32px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(18,10,2,0.90) 0%, rgba(28,16,8,0.85) 100%)', border: '1px solid rgba(255,104,3,0.18)', backdropFilter: 'blur(24px)', boxShadow: '0 0 60px rgba(255,104,3,0.08), inset 0 1px 0 rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, background: 'radial-gradient(circle, rgba(174,58,2,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#AE3A02', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '8px', opacity: 0.9 }}>Freelancer Portal</p>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#F5EDE4', marginBottom: '6px', lineHeight: 1.2 }}>
            Welcome back, <span style={{ background: 'linear-gradient(135deg,#AE3A02,#BFBFBF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: "transparent" }}>{user.name}</span>
          </h1>
          <p style={{ fontSize: '13px', color: '#6b5445' }}>Track your work, earnings, and applications</p>
          <button onClick={() => navigate('/jobs')} className="btn-purple" style={{ marginTop: '18px', padding: '10px 24px', fontSize: '13px', boxShadow: '0 4px 20px rgba(174,58,2,0.30)' }}>Browse Jobs</button>
        </div>

        {/* Profile card */}
        {portfolio !== null && (
          <div className="dark-card p-4 mb-6 flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
            {portfolio?.avatarUrl
              ? <img
                  src={portfolio.avatarUrl.startsWith('http') ? portfolio.avatarUrl : `${FILE_BASE}${portfolio.avatarUrl}`}
                  alt="avatar"
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                  style={{ border: '1px solid rgba(255,104,3,0.10)' }}
                />
              : <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #FF6803, #AE3A02)' }}>
                  {user.name?.[0]?.toUpperCase()}
                </div>
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-sm font-semibold text-white">{user.name}</span>
                {verificationStatus === 'approved' && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Verified
                  </span>
                )}
                {verificationStatus === 'rejected' && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.20)' }}>
                    Verification Rejected
                  </span>
                )}
                {verificationStatus === 'pending' && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.18)' }}>
                    Pending Verification
                  </span>
                )}
                {portfolio?.availability && (
                  <span className="badge badge-purple capitalize">{portfolio.availability}</span>
                )}
                {user.rating > 0 && (
                  <span className="text-[10px] font-medium" style={{ color: '#FF6803' }}>★ {Number(user.rating).toFixed(1)}</span>
                )}
              </div>
              {portfolio?.bio
                ? <p className="text-xs line-clamp-1" style={{ color: '#BFBFBF' }}>{portfolio.bio}</p>
                : <p className="text-xs italic" style={{ color: '#6b5445' }}>No bio yet — complete your profile</p>
              }
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 rounded-full h-1 overflow-hidden" style={{ background: 'rgba(255,104,3,0.06)' }}>
                  <div
                    className="h-1 rounded-full transition-all"
                    style={{ width: `${calcCompletion('freelancer', portfolio)}%`, background: 'linear-gradient(90deg, #FF6803, #AE3A02)' }}
                  />
                </div>
                <span className="text-[10px] font-medium flex-shrink-0" style={{ color: '#6b5445' }}>
                  {calcCompletion('freelancer', portfolio)}% complete
                </span>
              </div>
            </div>
            <Link to="/profile/setup" className="btn-purple text-xs font-medium px-3 py-1.5 flex-shrink-0">
              Edit Profile
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Wallet Balance" value={`₹${walletBalance}`} accent />
          <StatCard label="Total Earned" value={`₹${totalEarned}`} />
          <StatCard label="Active Contracts" value={activeContracts.length} />
          <StatCard label="All Contracts" value={contracts.length} />
        </div>

        {/* Earnings */}
        <section className="mb-6">
          {sectionLabel('Earnings History')}
          {transactions.length === 0
            ? <div className="dark-card p-6 text-center text-sm" style={{ color: '#6b5445' }}>
                No earnings yet. Complete a phase to receive payment.
              </div>
            : (
              <div className="dark-card overflow-hidden">
                {transactions.map((tx, i) => (
                  <div
                    key={tx._id}
                    className="flex items-center gap-4 px-4 py-3"
                    style={{ borderBottom: i < transactions.length - 1 ? '1px solid rgba(255,104,3,0.06)' : 'none' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)' }}>
                      <svg className="w-4 h-4" fill="none" stroke="#4ade80" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {tx.milestone?.title || tx.description || 'Payment'}
                        {tx.milestone?.isAdvance && (
                          <span className="ml-2 badge badge-gray">Advance</span>
                        )}
                      </div>
                      <div className="text-xs flex items-center gap-2 mt-0.5" style={{ color: '#6b5445' }}>
                        <span>{TX_LABEL[tx.type] || tx.type}</span>
                        {tx.contract?.hashId && (
                          <>
                            <span>·</span>
                            <Link to={`/contracts/${tx.contract._id}`} className="hover:underline" style={{ color: '#BFBFBF' }}>
                              #{tx.contract.hashId}
                            </Link>
                          </>
                        )}
                        <span>·</span>
                        <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold" style={{ color: '#4ade80' }}>+₹{tx.amount.toLocaleString()}</div>
                      <div className="text-[10px]" style={{ color: '#6b5445' }}>after 2% fee</div>
                      <div className={`text-[10px] font-medium capitalize`} style={{
                        color: tx.status === 'completed' ? '#4ade80' :
                               tx.status === 'pending' ? '#FF6803' : '#f87171'
                      }}>{tx.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </section>

        {/* Applications */}
        {applications.filter(({ bid }) => bid.status !== 'rejected' || bid.rejectionReason).length > 0 && (
          <section className="mb-6">
            {sectionLabel('My Applications')}
            {applications.map(({ job, bid, contractId }) => (
              <div key={bid._id} className="dark-card card-lift p-4 mb-2 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 mt-0.5"
                  style={{ background: '#120a02', border: '1px solid rgba(255,104,3,0.10)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="#BFBFBF" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-white truncate">{job.title}</span>
                    <span className="badge flex-shrink-0"
                      style={{
                        background: bid.status === 'hired' ? 'rgba(34,197,94,0.15)' :
                                    bid.status === 'shortlisted' ? 'rgba(255,104,3,0.12)' : 'rgba(255,104,3,0.06)',
                        color: bid.status === 'hired' ? '#4ade80' :
                               bid.status === 'shortlisted' ? '#BFBFBF' : '#BFBFBF',
                        border: bid.status === 'hired' ? '1px solid rgba(34,197,94,0.25)' :
                                bid.status === 'shortlisted' ? '1px solid rgba(255,104,3,0.25)' : '1px solid rgba(255,104,3,0.10)',
                      }}
                    >
                      {bid.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  <div className="text-sm" style={{ color: '#BFBFBF' }}>{job.client?.name} · ₹{job.budget?.toLocaleString()}</div>
                  <div className="flex gap-1 mt-2">
                    {PIPELINE.map((step) => {
                      const stepIndex = PIPELINE.findIndex(p => p.key === step.key)
                      const currentIndex = PIPELINE.findIndex(p => p.key === bid.status)
                      const isActive = step.key === bid.status
                      const isPast = currentIndex > stepIndex
                      return (
                        <div key={step.key} className="h-1 flex-1 rounded-full" style={{
                          background: isActive ? '#FF6803' : isPast ? 'rgba(174,58,2,0.40)' : 'rgba(255,104,3,0.06)'
                        }} />
                      )
                    })}
                  </div>
                  {bid.status === 'rejected' && bid.rejectionReason && (
                    <p className="text-sm mt-2" style={{ color: '#BFBFBF' }}>Reason: {bid.rejectionReason}</p>
                  )}
                  {bid.status === 'hired' && contractId && (
                    <Link
                      to={`/contracts/${contractId}`}
                      className="inline-block mt-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                      style={{ background: 'rgba(255,104,3,0.12)', border: '1px solid rgba(255,104,3,0.20)', color: '#BFBFBF' }}
                    >
                      View Contract
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Contracts */}
        <section>
          {sectionLabel('My Contracts')}
          {contracts.length === 0
            ? <div className="dark-card p-6 text-center text-sm" style={{ color: '#6b5445' }}>
                No contracts yet.{' '}
                <Link to="/jobs" className="font-medium" style={{ color: '#BFBFBF' }}>Browse jobs</Link>
              </div>
            : contracts.map(c => (
              <div key={c._id} className="dark-card card-lift p-4 mb-2 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,104,3,0.12)', border: '1px solid rgba(255,104,3,0.20)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="#FF6803" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-white">{c.job?.title || 'Contract'}</div>
                  <div className="text-sm mt-0.5" style={{ color: '#BFBFBF' }}>
                    with {c.client?.name} · ₹{c.amount?.toLocaleString()} · <span className="capitalize">{c.status}</span>
                  </div>
                </div>
                <Link
                  to={`/contracts/${c._id}`} data-cursor="contract"
                  className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0"
                  style={{ background: 'rgba(255,104,3,0.12)', border: '1px solid rgba(255,104,3,0.20)', color: '#BFBFBF' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,104,3,0.20)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,104,3,0.12)' }}
                >
                  View Work
                </Link>
              </div>
            ))
          }
        </section>
      </div>
    </div>
  )
}