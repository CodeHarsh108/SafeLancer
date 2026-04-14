import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import toast, { Toaster } from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', form)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))

      // Fetch portfolio to store completion % for the navbar banner
      try {
        const { data: meData } = await api.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${data.token}` }
        })
        const pct = meData.portfolio?.completionPercent ?? 20
        localStorage.setItem('profileCompletion', String(pct))
      } catch {
        localStorage.setItem('profileCompletion', '20')
      }
      window.dispatchEvent(new Event('profileUpdated'))

      toast.success(`Welcome back, ${data.user.name}!`)
      setTimeout(() => {
        if (data.user.role === 'client') navigate('/dashboard/client')
        else if (data.user.role === 'freelancer') navigate('/dashboard/freelancer')
        else navigate('/admin')
      }, 500)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-4">
      <Toaster />
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">FreeLock</h1>
          <p className="text-slate-500 mt-1">Secure Freelancing Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-slate-500 text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="text-indigo-600 font-medium hover:underline">Register here</Link>
        </p>

        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
          <p className="font-medium mb-1">Demo accounts:</p>
          <p>client@test.com / Test@123</p>
          <p>freelancer@test.com / Test@123</p>
          <p>admin@test.com / Test@123</p>
        </div>
      </div>
    </div>
  )
}
