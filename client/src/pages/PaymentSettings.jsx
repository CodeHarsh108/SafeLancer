import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import PaymentVerifyModal from '../components/PaymentVerifyModal'
import toast from 'react-hot-toast'
import { calcCompletion } from '../utils/profileCompletion'

export default function PaymentSettings() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const navigate = useNavigate()
  const isClient = user.role === 'client'
  const isFreelancer = user.role === 'freelancer'

  const [portfolio, setPortfolio] = useState(null)
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [payoutForm, setPayoutForm] = useState({ payoutMethod: 'upi', upiId: '', bankAccountNumber: '', ifscCode: '', accountHolderName: '' })
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [editingPayout, setEditingPayout] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/api/auth/me'),
      isClient ? api.get('/api/contracts/my-contracts') : api.get('/api/contracts/my-work'),
    ]).then(([me, c]) => {
      const p = me.data.portfolio
      setPortfolio(p)
      setContracts(c.data)
      if (isFreelancer && p) {
        setPayoutForm({
          payoutMethod: p.payoutMethod || 'upi',
          upiId: p.upiId || '',
          bankAccountNumber: p.bankAccountNumber || '',
          ifscCode: p.ifscCode || '',
          accountHolderName: p.accountHolderName || '',
        })
      }
    }).catch(() => toast.error('Failed to load payment data'))
      .finally(() => setLoading(false))
  }, [])

  const handleVerified = () => {
    setPortfolio(prev => {
      const updated = { ...prev, paymentVerified: true }
      const pct = calcCompletion(user.role, updated)
      localStorage.setItem('profileCompletion', String(pct))
      window.dispatchEvent(new Event('profileUpdated'))
      return updated
    })
    toast.success('Payment method verified!')
  }

  const savePayoutDetails = async () => {
    setPayoutLoading(true)
    try {
      await api.post('/api/portfolio/payout-details', payoutForm)
      setPortfolio(prev => ({ ...prev, payoutDetailsAdded: true, paymentVerified: false, payoutMethod: payoutForm.payoutMethod, upiId: payoutForm.upiId, bankAccountNumber: payoutForm.bankAccountNumber, ifscCode: payoutForm.ifscCode, accountHolderName: payoutForm.accountHolderName }))
      setEditingPayout(false)
      toast.success('Details saved! Click Verify to confirm your payout account.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save payout details')
    } finally {
      setPayoutLoading(false)
    }
  }

  const verifyPayoutDetails = async () => {
    setVerifyLoading(true)
    try {
      const { data } = await api.post('/api/portfolio/verify-payout')
      setPortfolio(prev => ({ ...prev, paymentVerified: true }))
      const pct = data.completionPercent
      localStorage.setItem('profileCompletion', String(pct))
      window.dispatchEvent(new Event('profileUpdated'))
      toast.success('Payout account verified!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed')
    } finally {
      setVerifyLoading(false)
    }
  }

  const isVerified = portfolio?.paymentVerified || false
  const activeContracts = contracts.filter(c => c.status === 'active')
  const completedContracts = contracts.filter(c => c.status === 'completed')
  const totalEscrow = activeContracts.reduce((sum, c) => sum + (c.amount || 0), 0)
  const totalTransacted = completedContracts.reduce((sum, c) => sum + (c.amount || 0), 0)

  const dashboardPath = isFreelancer ? '/dashboard/freelancer' : '/dashboard/client'

  if (loading) return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar />
      {showVerifyModal && (
        <PaymentVerifyModal onClose={() => setShowVerifyModal(false)} onVerified={handleVerified} />
      )}

      <div className="max-w-3xl mx-auto p-6 pb-16">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 font-medium mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Payment Settings</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Manage your payment method and view transaction history</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Active Contracts', value: activeContracts.length },
            { label: isFreelancer ? 'Total Earned' : 'Total Spent', value: `₹${totalTransacted.toLocaleString()}` },
            { label: 'In Escrow', value: `₹${totalEscrow.toLocaleString()}` },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-2xl font-bold text-zinc-900">{s.value}</div>
              <div className="text-zinc-500 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Payment verification — clients only */}
        {isClient && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900">Payment Verification</h2>
              {isVerified && (
                <span className="text-xs bg-zinc-100 text-zinc-700 border border-zinc-200 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Verified
                </span>
              )}
            </div>

            <div className={`flex items-start gap-4 p-4 rounded-xl border ${isVerified ? 'bg-zinc-50 border-zinc-200' : 'bg-white border-zinc-200'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isVerified ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
                <svg className={`w-5 h-5 ${isVerified ? 'text-white' : 'text-zinc-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900">
                  {isVerified ? 'Payment Method Verified' : 'Payment Method Not Verified'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  {isVerified
                    ? 'Your payment method is verified. Freelancers can see this badge on your profile, which improves bid quality.'
                    : 'Verify your payment method to build trust with freelancers. A ₹1 refundable charge confirms your method is active.'}
                </p>
                {!isVerified && (
                  <div className="mt-3 space-y-1.5">
                    {[
                      'Payment Verified badge on your public profile',
                      'Higher quality bids from freelancers',
                      'Faster contract creation and onboarding',
                    ].map(item => (
                      <div key={item} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-zinc-200 flex-shrink-0" />
                        <span className="text-xs text-zinc-500">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
                {isVerified && (
                  <div className="mt-3 space-y-1.5">
                    {[
                      'Payment Verified badge visible on your profile',
                      'Attracting higher-quality freelancer bids',
                      'Trust established for contract creation',
                    ].map(item => (
                      <div key={item} className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-xs text-zinc-600">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {!isVerified && (
                <button onClick={() => setShowVerifyModal(true)}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0">
                  Verify now
                </button>
              )}
            </div>

            {/* How it works */}
            {!isVerified && (
              <div className="mt-4 border-t border-zinc-100 pt-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">How it works</p>
                <div className="space-y-3">
                  {[
                    { step: '1', title: 'Choose payment method', desc: 'UPI, debit/credit card, or net banking' },
                    { step: '2', title: '₹1 refundable charge', desc: 'A small charge confirms your method is active' },
                    { step: '3', title: 'Instant refund', desc: 'The ₹1 is refunded to you within seconds via Razorpay' },
                    { step: '4', title: 'Badge applied', desc: 'Payment Verified badge shows on your public profile' },
                  ].map(item => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-zinc-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] text-white font-bold">{item.step}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-800">{item.title}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Freelancer payout details */}
        {isFreelancer && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900">Payout Details</h2>
              {portfolio?.paymentVerified ? (
                <span className="text-xs bg-zinc-900 text-white px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Verified
                </span>
              ) : (
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                  Not Verified
                </span>
              )}
            </div>

            {/* No details yet */}
            {!portfolio?.payoutDetailsAdded && !editingPayout && (
              <div className="text-center py-6 border border-dashed border-zinc-200 rounded-xl mb-3">
                <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-600 font-medium">No payout account added</p>
                <p className="text-xs text-zinc-400 mt-1 mb-4">Add your UPI ID or bank account to receive milestone payments</p>
                <button onClick={() => setEditingPayout(true)}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                  Add payout details
                </button>
              </div>
            )}

            {/* Saved details display */}
            {portfolio?.payoutDetailsAdded && !editingPayout && (
              <div className={`rounded-xl border p-4 mb-3 ${portfolio.paymentVerified ? 'bg-zinc-50 border-zinc-200' : 'bg-amber-50 border-amber-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${portfolio.paymentVerified ? 'bg-zinc-900' : 'bg-amber-100'}`}>
                    <svg className={`w-5 h-5 ${portfolio.paymentVerified ? 'text-white' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">{portfolio.payoutMethod === 'bank' ? 'Bank Transfer' : 'UPI'}</p>
                    {portfolio.payoutMethod === 'upi' ? (
                      <p className="text-xs text-zinc-500 mt-0.5">UPI ID: <span className="font-medium text-zinc-700">{portfolio.upiId}</span></p>
                    ) : (
                      <div className="text-xs text-zinc-500 mt-0.5 space-y-0.5">
                        <p>Account: <span className="font-medium text-zinc-700">****{portfolio.bankAccountNumber?.slice(-4)}</span></p>
                        <p>IFSC: <span className="font-medium text-zinc-700">{portfolio.ifscCode}</span> · Name: <span className="font-medium text-zinc-700">{portfolio.accountHolderName}</span></p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setEditingPayout(true) }}
                    className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
                    Edit
                  </button>
                </div>

                {/* Verify prompt */}
                {!portfolio.paymentVerified && (
                  <div className="mt-3 pt-3 border-t border-amber-100 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-amber-800">Account not yet verified</p>
                      <p className="text-xs text-amber-600 mt-0.5">Verify to confirm your account and unlock the Verified badge on your profile</p>
                    </div>
                    <button onClick={verifyPayoutDetails} disabled={verifyLoading}
                      className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex-shrink-0 flex items-center gap-1.5">
                      {verifyLoading ? (
                        <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Verifying…</>
                      ) : (
                        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> Verify now</>
                      )}
                    </button>
                  </div>
                )}

                {/* Already verified confirmation */}
                {portfolio.paymentVerified && (
                  <div className="mt-3 pt-3 border-t border-zinc-200 flex items-center gap-2">
                    <svg className="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    <p className="text-xs text-zinc-600">Account verified — you will receive payouts at this address when milestones are released</p>
                  </div>
                )}
              </div>
            )}

            {/* Add / Edit form */}
            {editingPayout && (
              <div className="border border-zinc-200 rounded-xl p-4 space-y-4 mb-3">
                <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">Select payout method</p>
                <div className="flex gap-2">
                  {['upi', 'bank'].map(m => (
                    <button key={m} onClick={() => setPayoutForm(f => ({ ...f, payoutMethod: m }))}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${payoutForm.payoutMethod === m ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'}`}>
                      {m === 'upi' ? 'UPI' : 'Bank Transfer'}
                    </button>
                  ))}
                </div>

                {payoutForm.payoutMethod === 'upi' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">UPI ID</label>
                    <input type="text" value={payoutForm.upiId} placeholder="yourname@upi or phone@okaxis"
                      onChange={e => setPayoutForm(f => ({ ...f, upiId: e.target.value }))}
                      className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300" />
                    <p className="text-xs text-zinc-400 mt-1">Must contain @ — e.g. name@upi, number@paytm</p>
                  </div>
                )}

                {payoutForm.payoutMethod === 'bank' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">Account Holder Name</label>
                      <input type="text" value={payoutForm.accountHolderName} placeholder="Full name as on bank records"
                        onChange={e => setPayoutForm(f => ({ ...f, accountHolderName: e.target.value }))}
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">Account Number</label>
                      <input type="text" value={payoutForm.bankAccountNumber} placeholder="9–18 digit account number"
                        onChange={e => setPayoutForm(f => ({ ...f, bankAccountNumber: e.target.value.replace(/\D/g, '') }))}
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">IFSC Code</label>
                      <input type="text" value={payoutForm.ifscCode} placeholder="e.g. HDFC0001234"
                        maxLength={11}
                        onChange={e => setPayoutForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300 uppercase" />
                      <p className="text-xs text-zinc-400 mt-1">4 letters + 0 + 6 alphanumeric — e.g. HDFC0001234</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={savePayoutDetails} disabled={payoutLoading || !payoutForm.payoutMethod}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                    {payoutLoading ? 'Saving...' : 'Save details'}
                  </button>
                  {portfolio?.payoutDetailsAdded && (
                    <button onClick={() => setEditingPayout(false)}
                      className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-zinc-400">Payouts are processed via Razorpay after each milestone is released.</p>
          </div>
        )}

        {/* Escrow & Active Contracts */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Active Escrow</h2>
          {activeContracts.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-sm text-zinc-500">No active escrow</p>
              <p className="text-xs text-zinc-400 mt-1">Funds will appear here once a contract is funded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeContracts.map(c => (
                <div key={c._id} className="flex items-center gap-3 border border-zinc-100 rounded-xl px-4 py-3 bg-zinc-50">
                  <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{c.job?.title || 'Contract'}</p>
                    <p className="text-xs text-zinc-500">
                      {isFreelancer ? `with ${c.client?.name}` : `with ${c.freelancer?.name}`} · {c.milestoneCount} phases
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-zinc-900">₹{c.amount?.toLocaleString()}</p>
                    <p className="text-xs text-zinc-400">in escrow</p>
                  </div>
                  <Link to={`/contracts/${c._id}`}
                    className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
                    View
                  </Link>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 mt-2 px-1">
                <span className="text-xs text-zinc-500 font-medium">Total in escrow</span>
                <span className="text-sm font-bold text-zinc-900">₹{totalEscrow.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Transaction History</h2>
          {completedContracts.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm text-zinc-500">No completed transactions yet</p>
              <p className="text-xs text-zinc-400 mt-1">Completed contracts will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {completedContracts.map(c => (
                <div key={c._id} className="flex items-center gap-3 border border-zinc-100 rounded-xl px-4 py-3">
                  <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{c.job?.title || 'Contract'}</p>
                    <p className="text-xs text-zinc-500">
                      {isFreelancer ? `from ${c.client?.name}` : `to ${c.freelancer?.name}`} · Completed
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${isFreelancer ? 'text-zinc-900' : 'text-zinc-900'}`}>
                      {isFreelancer ? '+' : '-'}₹{c.amount?.toLocaleString()}
                    </p>
                    <p className="text-xs text-zinc-400">released</p>
                  </div>
                  <Link to={`/contracts/${c._id}`}
                    className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
                    View
                  </Link>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 mt-2 px-1">
                <span className="text-xs text-zinc-500 font-medium">Total {isFreelancer ? 'earned' : 'spent'}</span>
                <span className="text-sm font-bold text-zinc-900">₹{totalTransacted.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
