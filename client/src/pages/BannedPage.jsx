import { useState, useEffect } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

export default function BannedPage() {
  const [banInfo, setBanInfo] = useState({ reason: '', penaltyDue: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('banInfo')
    if (stored) {
      try { setBanInfo(JSON.parse(stored)) } catch {}
    }
  }, [])

  const payPenalty = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/pay-penalty')
      if (data.isBanned === false) {
        toast.success(data.message || 'Penalty cleared! Account restored.')
        localStorage.removeItem('banInfo')
        setTimeout(() => { window.location.href = '/' }, 1500)
        return
      }
      // Live mode: open Razorpay
      const options = {
        key: data.razorpayKeyId,
        amount: Math.round(data.amount * 100),
        currency: 'INR',
        name: 'SafeLancer Penalty Payment',
        description: 'Account reinstatement fee',
        order_id: data.orderId,
        handler: async (response) => {
          try {
            await api.post('/api/auth/pay-penalty/confirm', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            toast.success('Penalty paid. Account restored!')
            localStorage.removeItem('banInfo')
            setTimeout(() => { window.location.href = '/' }, 1500)
          } catch { toast.error('Payment confirmation failed. Contact support.') }
        },
        theme: { color: '#09090b' }
      }
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process penalty payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-zinc-900 mb-2">Account Suspended</h1>
        <p className="text-sm text-zinc-500 mb-5">Your account has been temporarily suspended due to a policy violation.</p>

        {banInfo.reason && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-5 text-left">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Reason</p>
            <p className="text-sm text-red-800">{banInfo.reason}</p>
          </div>
        )}

        {banInfo.penaltyDue > 0 && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-5">
            <p className="text-xs text-zinc-400 mb-1">Penalty Due</p>
            <p className="text-2xl font-bold text-zinc-900">₹{banInfo.penaltyDue?.toLocaleString()}</p>
          </div>
        )}

        <button
          onClick={payPenalty}
          disabled={loading}
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 transition-colors mb-3"
        >
          {loading ? 'Processing...' : banInfo.penaltyDue > 0 ? `Pay Penalty — ₹${banInfo.penaltyDue?.toLocaleString()}` : 'Clear Penalty & Restore Access'}
        </button>
        <p className="text-xs text-zinc-400">
          Need help?{' '}
          <a href="mailto:support@safelancer.in" className="text-zinc-600 hover:underline">Contact support</a>
        </p>
      </div>
    </div>
  )
}
