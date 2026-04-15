import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import api from '../api'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    const userRaw = searchParams.get('user')
    const error = searchParams.get('error')
    const roleMismatch = searchParams.get('role_mismatch') // 'client' | 'freelancer'

    if (error || !token || !userRaw) {
      navigate('/login?error=google_failed')
      return
    }

    try {
      const user = JSON.parse(decodeURIComponent(userRaw))
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))

      const proceed = () => {
        window.dispatchEvent(new Event('profileUpdated'))
        if (user.role === 'client') navigate('/dashboard/client')
        else if (user.role === 'freelancer') navigate('/dashboard/freelancer')
        else navigate('/admin')
      }

      api.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(({ data }) => {
          const pct = data.portfolio?.completionPercent ?? 20
          localStorage.setItem('profileCompletion', String(pct))
        })
        .catch(() => localStorage.setItem('profileCompletion', '20'))
        .finally(() => {
          if (roleMismatch) {
            const label = roleMismatch === 'client' ? 'Client' : 'Freelancer'
            const msg = `This email is already registered as a ${label}. Signing you in as ${label}.`
            setMessage(msg)
            toast(msg, {
              icon: 'ℹ️',
              duration: 3500,
              style: { fontSize: '13px', maxWidth: '340px' },
            })
            setTimeout(proceed, 3600)
          } else {
            proceed()
          }
        })
    } catch {
      navigate('/login?error=google_failed')
    }
  }, [])

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
      <Toaster position="top-center" />
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" />
        <p className="text-sm text-zinc-500">
          {message ? 'Redirecting you...' : 'Signing you in...'}
        </p>
      </div>
    </div>
  )
}
