import { useState } from 'react'
import api from '../api'

function loadRazorpayScript() {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

const TEST_METHODS = [
  { id: 'upi', label: 'UPI', icon: '📱', sub: 'Google Pay, PhonePe, Paytm' },
  { id: 'card', label: 'Credit / Debit Card', icon: '💳', sub: 'Visa, Mastercard, Rupay' },
  { id: 'netbanking', label: 'Net Banking', icon: '🏦', sub: 'All major banks supported' },
]

export default function PaymentVerifyModal({ onClose, onVerified }) {
  // steps: info | method_select | processing | success | failed
  const [step, setStep] = useState('info')
  const [errorMsg, setErrorMsg] = useState('')
  const [testOrder, setTestOrder] = useState(null)
  const [selectedMethod, setSelectedMethod] = useState(null)

  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const handleStartVerification = async () => {
    setStep('processing')
    setErrorMsg('')
    try {
      const { data: order } = await api.post('/api/portfolio/create-verification-order')

      if (order.isTestMode || order.orderId?.startsWith('order_test_')) {
        setTestOrder(order)
        setStep('method_select')
        return
      }

      const loaded = await loadRazorpayScript()
      if (!loaded) throw new Error('Failed to load Razorpay SDK. Check your internet connection.')

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.key,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: 'SafeLancer',
          description: '₹1 refundable — payment method verification',
          prefill: { name: user.name || '', email: user.email || '' },
          theme: { color: '#18181b' },
          handler: async (response) => {
            try {
              await api.post('/api/portfolio/confirm-verification', {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              })
              setStep('success')
              resolve()
            } catch (err) {
              reject(new Error(err.response?.data?.message || 'Signature verification failed'))
            }
          },
          modal: { ondismiss: () => reject(new Error('DISMISSED')) },
        })
        rzp.on('payment.failed', (resp) => {
          reject(new Error(resp.error?.description || 'Payment failed'))
        })
        rzp.open()
      })
    } catch (err) {
      if (err.message === 'DISMISSED') {
        setStep('info')
      } else {
        setErrorMsg(err.message)
        setStep('failed')
      }
    }
  }

  const handleTestPay = async () => {
    if (!selectedMethod) return
    setStep('processing')
    try {
      await api.post('/api/portfolio/confirm-verification', {
        razorpay_payment_id: 'pay_test_' + Date.now(),
        razorpay_order_id: testOrder.orderId,
        razorpay_signature: 'test_sig',
      })
      setStep('success')
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Verification failed')
      setStep('failed')
    }
  }

  const isBlocking = step === 'processing'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={isBlocking ? undefined : onClose} />
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
          {!isBlocking && (
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-6">

          {/* Step: info */}
          {step === 'info' && (
            <div className="space-y-5">
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-zinc-900">How it works</p>
                {[
                  { step: '1', title: 'Choose payment method', desc: 'UPI, debit/credit card, or net banking' },
                  { step: '2', title: '₹1 refundable charge', desc: 'A small charge confirms your method is active' },
                  { step: '3', title: 'Instant refund', desc: 'The ₹1 is refunded to your account immediately' },
                  { step: '4', title: 'Verified badge applied', desc: 'Payment Verified badge shows on your profile' },
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
              <p className="text-xs text-zinc-400 text-center">No recurring charges. One-time verification only.</p>
              <button onClick={handleStartVerification}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                Pay ₹1 to verify
              </button>
            </div>
          )}

          {/* Step: method_select (test mode only) */}
          {step === 'method_select' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-zinc-900 mb-0.5">Choose payment method</p>
                <p className="text-xs text-zinc-400">Select how you'd like to pay ₹1 for verification</p>
              </div>
              <div className="space-y-2">
                {TEST_METHODS.map(m => (
                  <button key={m.id} onClick={() => setSelectedMethod(m.id)}
                    className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 transition-colors text-left ${
                      selectedMethod === m.id
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800'
                    }`}>
                    <span className="text-xl leading-none">{m.icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${selectedMethod === m.id ? 'text-white' : 'text-zinc-900'}`}>{m.label}</p>
                      <p className={`text-xs mt-0.5 ${selectedMethod === m.id ? 'text-zinc-300' : 'text-zinc-400'}`}>{m.sub}</p>
                    </div>
                    {selectedMethod === m.id && (
                      <svg className="w-4 h-4 text-white ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
              <div className="pt-1 flex gap-2">
                <button onClick={() => setStep('info')}
                  className="border border-zinc-200 text-zinc-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-zinc-50 transition-colors">
                  Back
                </button>
                <button onClick={handleTestPay} disabled={!selectedMethod}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  Pay ₹1
                </button>
              </div>
            </div>
          )}

          {/* Step: processing */}
          {step === 'processing' && (
            <div className="py-10 text-center space-y-4">
              <div className="relative mx-auto w-16 h-16">
                <div className="w-16 h-16 border-4 border-zinc-100 rounded-full" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-t-zinc-900 rounded-full animate-spin" />
              </div>
              <p className="text-sm font-semibold text-zinc-900">Processing payment…</p>
              <p className="text-xs text-zinc-400">Please wait while we verify your payment</p>
            </div>
          )}

          {/* Step: success */}
          {step === 'success' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-900">Payment method verified!</p>
                <p className="text-xs text-zinc-500 mt-1">The ₹1 has been refunded to your account</p>
              </div>
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 text-left space-y-1.5">
                {[
                  'Payment Verified badge is now live on your profile',
                  'Freelancers can see you are a verified client',
                  'Higher quality bids incoming',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs text-zinc-600">{item}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => { onVerified(); onClose() }}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                Done
              </button>
            </div>
          )}

          {/* Step: failed */}
          {step === 'failed' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">Verification failed</p>
                <p className="text-xs text-red-500 mt-1">{errorMsg}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setStep('info'); setErrorMsg('') }}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  Try again
                </button>
                <button onClick={onClose}
                  className="flex-1 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium py-2.5 rounded-xl text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
