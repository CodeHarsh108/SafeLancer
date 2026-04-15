import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    const userRaw = searchParams.get('user')
    const error = searchParams.get('error')

    if (error || !token || !userRaw) {
      navigate('/login?error=google_failed')
      return
    }

    try {
      const user = JSON.parse(decodeURIComponent(userRaw))
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))

      api.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(({ data }) => {
          const pct = data.portfolio?.completionPercent ?? 20
          localStorage.setItem('profileCompletion', String(pct))
        })
        .catch(() => localStorage.setItem('profileCompletion', '20'))
        .finally(() => {
          window.dispatchEvent(new Event('profileUpdated'))
          if (user.role === 'client') navigate('/dashboard/client')
          else if (user.role === 'freelancer') navigate('/dashboard/freelancer')
          else navigate('/admin')
        })
    } catch {
      navigate('/login?error=google_failed')
    }
  }, [])

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" />
        <p className="text-sm text-zinc-500">Signing you in...</p>
      </div>
    </div>
  )
}
