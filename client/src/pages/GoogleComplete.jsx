import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import toast, { Toaster } from 'react-hot-toast'

export default function GoogleComplete() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const pending = searchParams.get('pending') || ''
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!role) { toast.error('Please select your role'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/google/complete', { pendingToken: pending, role })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('profileCompletion', '20')
      window.dispatchEvent(new Event('profileUpdated'))
      toast.success("Account created! Let's set up your profile.")
      setTimeout(() => navigate('/profile/setup'), 600)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!pending) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 text-sm mb-4">Invalid session. Please try signing in again.</p>
          <a href="/login" className="text-zinc-900 font-medium underline underline-offset-2 text-sm">Back to login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-4">
      <Toaster />

      <div className="mb-8 text-center">
        <div className="text-xl font-bold text-zinc-900 tracking-tight">FreeLock</div>
        <div className="text-sm text-zinc-500 mt-1">One last step</div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-base font-semibold text-zinc-900 mb-1">How will you use FreeLock?</h1>
        <p className="text-sm text-zinc-500 mb-6">Choose your role to complete your account setup.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {['client', 'freelancer'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`py-3 px-3 rounded-lg border text-left transition-all ${
                  role === r
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-400 bg-white'
                }`}
              >
                <div className="text-sm font-semibold capitalize">{r === 'client' ? 'Client' : 'Freelancer'}</div>
                <div className={`text-xs mt-0.5 ${role === r ? 'text-zinc-300' : 'text-zinc-400'}`}>
                  {r === 'client' ? 'I hire talent' : 'I do the work'}
                </div>
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || !role}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
