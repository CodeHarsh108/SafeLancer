import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001'

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z\d]/.test(password)) score++
  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' }
  if (score === 3) return { score, label: 'Fair', color: 'bg-amber-500' }
  if (score === 4) return { score, label: 'Good', color: 'bg-blue-500' }
  return { score, label: 'Strong', color: 'bg-emerald-500' }
}

const ROLES = [
  {
    value: 'client',
    label: 'Client',
    sub: 'I hire talent',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/>
      </svg>
    ),
  },
  {
    value: 'freelancer',
    label: 'Freelancer',
    sub: 'I do the work',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2"/>
      </svg>
    ),
  },
]

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState('role')
  const [role, setRole] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    linkedin: '', github: '', portfolio: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exiting, setExiting] = useState(false)

  const goTo = (path) => {
    setExiting(true)
    setTimeout(() => navigate(path), 220)
  }

  const strength = getPasswordStrength(form.password)

  const handleContinue = () => {
    if (!role) { toast.error('Please select your role to continue'); return }
    setExiting(true)
    setTimeout(() => { setStep('form'); setExiting(false) }, 220)
  }

  const validate = () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error('Name must be at least 2 characters'); return false
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      toast.error('Please enter a valid email address'); return false
    }
    if (strength.score < 5) {
      toast.error('Password must have 8+ chars, uppercase, lowercase, number, and special character'); return false
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match'); return false
    }
    if (role === 'freelancer') {
      if (form.linkedin && !form.linkedin.startsWith('https://')) {
        toast.error('LinkedIn URL must start with https://'); return false
      }
      if (form.github && !form.github.startsWith('https://')) {
        toast.error('GitHub URL must start with https://'); return false
      }
      if (form.portfolio && !form.portfolio.startsWith('https://')) {
        toast.error('Portfolio URL must start with https://'); return false
      }
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
      }
      if (role === 'freelancer') {
        payload.portfolio = form.portfolio || ''
        payload.github = form.github || ''
        payload.linkedin = form.linkedin || ''
      }
      const { data } = await api.post('/api/auth/register', payload)

      if (role === 'freelancer') {
        // Freelancer registration - redirect to login with pending approval message
        toast.success('Request sent! Waiting for admin approval.')
        setTimeout(() => navigate('/login'), 600)
      } else {
        // Client registration - proceed to profile setup
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        localStorage.setItem('profileCompletion', '20')
        toast.success("Account created! Let's set up your profile.")
        setTimeout(() => navigate('/profile/setup'), 600)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const cx = exiting ? 'auth-card-exit' : 'auth-card-enter'
  const hx = exiting ? 'auth-head-exit' : 'auth-head-enter'

  if (step === 'role') {
    return (
      <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-4">
        <div className={`mb-8 text-center ${hx}`}>
          <div className="text-xl font-bold text-zinc-900 tracking-tight">Safelancer</div>
          <div className="text-sm text-zinc-500 mt-1">Escrow-protected freelancing</div>
        </div>
        <div className={`bg-white rounded-xl border border-zinc-200 p-8 w-full max-w-md shadow-sm ${cx}`}>
          <h1 className="text-base font-semibold text-zinc-900 mb-1">Join Safelancer</h1>
          <p className="text-sm text-zinc-500 mb-6">How do you want to use Safelancer?</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {ROLES.map(({ value, label, sub, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  role === value
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 bg-white'
                }`}
              >
                <div className={`mb-2.5 ${role === value ? 'text-white' : 'text-zinc-400'}`}>
                  {icon}
                </div>
                <div className="text-sm font-semibold">{label}</div>
                <div className={`text-xs mt-0.5 ${role === value ? 'text-zinc-300' : 'text-zinc-400'}`}>
                  {sub}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={handleContinue}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            Continue
          </button>
          <p className="mt-5 text-center text-zinc-500 text-sm">
            Already have an account?{' '}
            <button type="button" onClick={() => goTo('/login')} className="text-zinc-900 font-semibold hover:underline underline-offset-2">Sign in</button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-4 py-10">
      <div className={`mb-8 text-center ${hx}`}>
        <div className="text-xl font-bold text-zinc-900 tracking-tight">Safelancer</div>
        <div className="text-sm text-zinc-500 mt-1">Create your account</div>
      </div>
      <div className={`bg-white rounded-xl border border-zinc-200 p-8 w-full max-w-md shadow-sm ${cx}`}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-base font-semibold text-zinc-900">Create an account</h1>
          <button
            type="button"
            onClick={() => setStep('role')}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Change
          </button>
        </div>
        <p className="text-sm text-zinc-500 mb-6">
          Signing up as a{' '}
          <span className="font-medium text-zinc-900 capitalize">{role}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 pr-12 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
                placeholder="Min 8 characters"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xs font-medium">
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {form.password && (
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-zinc-100'}`} />
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={form.confirmPassword}
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                className={`w-full border rounded-lg px-3 py-2.5 pr-12 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none transition-colors ${
                  form.confirmPassword && form.password !== form.confirmPassword
                    ? 'border-red-300 bg-red-50'
                    : form.confirmPassword && form.password === form.confirmPassword
                    ? 'border-emerald-300'
                    : 'border-zinc-200 focus:border-zinc-400'
                }`}
                placeholder="Repeat password"
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xs font-medium">
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          {/* Freelancer verification fields */}
          {role === 'freelancer' && (
            <div className="space-y-3 border-t border-zinc-100 pt-4 mt-2">
              <p className="text-xs font-medium text-zinc-500">Verification (optional but recommended)</p>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">LinkedIn Profile URL</label>
                <input
                  type="url"
                  value={form.linkedin}
                  onChange={e => setForm({ ...form, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">GitHub Profile URL</label>
                <input
                  type="url"
                  value={form.github}
                  onChange={e => setForm({ ...form, github: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">Portfolio / Website URL</label>
                <input
                  type="url"
                  value={form.portfolio}
                  onChange={e => setForm({ ...form, portfolio: e.target.value })}
                  placeholder="https://yourportfolio.com"
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        {/* Google Signup - Only for Clients */}
        {role === 'client' && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-zinc-100" />
              <span className="text-xs text-zinc-400">or sign up with Google</span>
              <div className="flex-1 h-px bg-zinc-100" />
            </div>

            <a
              href={`${API_URL}/api/auth/google?role=client`}
              className="w-full flex items-center justify-center gap-2.5 border border-zinc-200 rounded-lg py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign up with Google
            </a>
          </>
        )}

        <p className="mt-5 text-center text-zinc-500 text-sm">
          Already have an account?{' '}
          <button type="button" onClick={() => goTo('/login')} className="text-zinc-900 font-semibold hover:underline underline-offset-2">Sign in</button>
        </p>
      </div>
    </div>
  )
}