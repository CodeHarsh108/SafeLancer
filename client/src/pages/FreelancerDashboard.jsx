import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'
import { calcCompletion } from '../utils/profileCompletion'

const FILE_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const PIPELINE = [
  { key: 'applied', label: 'Applied' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'hired', label: 'Hired' },
]

const STATUS_COLOR = {
  applied: 'bg-zinc-100 text-zinc-600',
  shortlisted: 'bg-zinc-800 text-white',
  hired: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-zinc-200 text-zinc-600',
}

const TX_LABEL = {
  phase_payment: 'Phase Payment',
  advance_payment: 'Advance Payment',
  dispute_release: 'Dispute Release',
  split_payment: 'Split Payment',
  auto_release: 'Auto Release',
}

export default function FreelancerDashboard() {
  const [contracts, setContracts] = useState([])
  const [applications, setApplications] = useState([])
  const [portfolio, setPortfolio] = useState(null)
  const [walletBalance, setWalletBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

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
      setWalletBalance(tx.data.walletBalance)
      setTransactions(tx.data.transactions)
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const activeContracts = contracts.filter(c => ['active', 'pending_advance'].includes(c.status))
  const totalEarned = contracts
    .filter(c => c.status === 'completed')
    .reduce((sum, c) => sum + c.amount, 0)

  if (loading) return (
    <div className="min-h-screen bg-zinc-100"><Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Welcome, {user.name}</h1>
            <p className="text-zinc-500 text-sm">Manage your work and earnings</p>
          </div>
          <Link to="/jobs" className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">
            Browse Jobs
          </Link>
        </div>

        {/* My Profile */}
        {portfolio !== null && (
          <div className="bg-white rounded-xl border border-zinc-200 p-4 mb-6 flex items-center gap-4">
            {portfolio?.avatarUrl
              ? <img src={portfolio.avatarUrl.startsWith('http') ? portfolio.avatarUrl : `${FILE_BASE}${portfolio.avatarUrl}`}
                  alt="avatar" className="w-12 h-12 rounded-full object-cover border border-zinc-200 flex-shrink-0" />
              : <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  {user.name?.[0]?.toUpperCase()}
                </div>
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-zinc-900">{user.name}</span>
                {portfolio?.availability && (
                  <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md font-medium capitalize border border-zinc-200">
                    {portfolio.availability}
                  </span>
                )}
                {user.rating > 0 && (
                  <span className="text-[10px] text-zinc-500 font-medium">★ {Number(user.rating).toFixed(1)}</span>
                )}
              </div>
              {portfolio?.bio
                ? <p className="text-xs text-zinc-500 line-clamp-1">{portfolio.bio}</p>
                : <p className="text-xs text-zinc-400 italic">No bio yet — complete your profile</p>
              }
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 bg-zinc-100 rounded-full h-1 overflow-hidden">
                  <div className="bg-zinc-900 h-1 rounded-full transition-all" style={{ width: `${calcCompletion('freelancer', portfolio)}%` }} />
                </div>
                <span className="text-[10px] text-zinc-400 font-medium flex-shrink-0">{calcCompletion('freelancer', portfolio)}% complete</span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link to="/profile/setup" className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                Edit Profile
              </Link>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Wallet Balance', value: `₹${walletBalance.toLocaleString()}`, highlight: true },
            { label: 'Total Earned', value: `₹${totalEarned.toLocaleString()}` },
            { label: 'Active Contracts', value: activeContracts.length },
            { label: 'All Contracts', value: contracts.length },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.highlight ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-200'}`}>
              <div className={`text-2xl font-bold ${s.highlight ? 'text-white' : 'text-zinc-900'}`}>{s.value}</div>
              <div className={`text-sm ${s.highlight ? 'text-zinc-400' : 'text-zinc-500'}`}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Earnings / Transactions */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Earnings History</h2>
          {transactions.length === 0
            ? <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center text-zinc-400 text-sm">
                No earnings yet. Complete a phase to receive payment.
              </div>
            : (
              <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
                {transactions.map(tx => (
                  <div key={tx._id} className="flex items-center gap-4 px-4 py-3">
                    {/* Icon */}
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-900 truncate">
                        {tx.milestone?.title || tx.description || 'Payment'}
                        {tx.milestone?.isAdvance && (
                          <span className="ml-2 text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">Advance</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 flex items-center gap-2">
                        <span>{TX_LABEL[tx.type] || tx.type}</span>
                        {tx.contract?.hashId && (
                          <>
                            <span>·</span>
                            <Link to={`/contracts/${tx.contract._id}`} className="hover:text-zinc-600 underline underline-offset-2">
                              #{tx.contract.hashId}
                            </Link>
                          </>
                        )}
                        <span>·</span>
                        <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-emerald-700">+₹{tx.amount.toLocaleString()}</div>
                      <div className={`text-[10px] font-medium capitalize ${
                        tx.status === 'completed' ? 'text-emerald-600' :
                        tx.status === 'pending' ? 'text-amber-600' : 'text-red-600'
                      }`}>{tx.status}</div>
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
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">My Applications</h2>
            {applications.map(({ job, bid, contractId }) => (
              <div key={bid._id} className="bg-white rounded-xl border border-zinc-200 p-4 mb-2 flex items-start gap-4">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-zinc-900 truncate">{job.title}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0 ${STATUS_COLOR[bid.status] || 'bg-zinc-100 text-zinc-600'}`}>
                      {bid.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-500">{job.client?.name} · ₹{job.budget?.toLocaleString()}</div>
                  <div className="flex gap-1 mt-2">
                    {PIPELINE.map((step) => {
                      const stepIndex = PIPELINE.findIndex(p => p.key === step.key)
                      const currentIndex = PIPELINE.findIndex(p => p.key === bid.status)
                      const isActive = step.key === bid.status
                      const isPast = currentIndex > stepIndex
                      return (
                        <div key={step.key}
                          className={`h-1 flex-1 rounded-full ${isActive ? 'bg-zinc-900' : isPast ? 'bg-zinc-300' : 'bg-zinc-100'}`}
                        />
                      )
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bid.status === 'rejected' && bid.rejectionReason && (
                      <p className="text-sm text-zinc-500">Reason: {bid.rejectionReason}</p>
                    )}
                    {bid.status === 'hired' && contractId && (
                      <Link to={`/contracts/${contractId}`}
                        className="inline-block border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                        View Contract
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Contracts */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">My Contracts</h2>
          {contracts.length === 0
            ? <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center text-zinc-400 text-sm">
                No contracts yet.{' '}
                <Link to="/jobs" className="text-zinc-900 font-medium underline underline-offset-2">Browse jobs</Link>
              </div>
            : contracts.map(c => (
              <div key={c._id} className="bg-white rounded-xl border border-zinc-200 p-4 mb-2 flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-zinc-900">{c.job?.title || 'Contract'}</div>
                  <div className="text-sm text-zinc-500">with {c.client?.name} · ₹{c.amount?.toLocaleString()} · <span className="capitalize">{c.status}</span></div>
                </div>
                <Link to={`/contracts/${c._id}`} className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-1.5 rounded-lg text-sm font-medium flex-shrink-0">
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
