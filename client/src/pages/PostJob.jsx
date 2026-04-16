import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import SkillSelector from '../components/SkillSelector'
import toast, { Toaster } from 'react-hot-toast'

export default function PostJob() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', description: '', budget: '', deadline: '' })
  const [skills, setSkills] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [completion, setCompletion] = useState(parseInt(localStorage.getItem('profileCompletion') || '0', 10))

  useEffect(() => {
    // Always verify completion from server on mount
    api.get('/api/auth/me').then(({ data }) => {
      const pct = data.portfolio?.completionPercent || 0
      setCompletion(pct)
      localStorage.setItem('profileCompletion', String(pct))
    }).catch(() => {})
  }, [])

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = 'Job title is required'
    if (!form.description.trim()) e.description = 'Description is required'
    if (!form.budget || Number(form.budget) <= 0) e.budget = 'Enter a valid budget'
    if (!form.deadline) e.deadline = 'Deadline is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await api.post('/api/jobs', { ...form, budget: Number(form.budget), skills })
      toast.success('Job posted!')
      setTimeout(() => navigate('/dashboard/client'), 1000)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post job')
    } finally { setLoading(false) }
  }

  const inputClass = (field) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none transition-colors ${
      errors[field] ? 'border-red-300 bg-red-50' : 'border-zinc-200 focus:border-zinc-400'
    }`

  const isBlocked = completion < 100

  return (
    <div className="min-h-screen bg-zinc-100">
      <Toaster />
      <Navbar />
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-zinc-900">Post a New Job</h1>
          <p className="text-sm text-zinc-500 mt-1">Fill in the details to attract the best talent</p>
        </div>

        {/* Profile completion gate */}
        {isBlocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">Complete your profile first</p>
                <p className="text-xs text-amber-700 mt-0.5">Your profile is {completion}% complete. You need 100% to post jobs.</p>
                <div className="w-full bg-amber-200 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div className="h-1.5 rounded-full bg-amber-500 transition-all" style={{ width: `${completion}%` }} />
                </div>
              </div>
              <Link to="/profile/setup"
                className="flex-shrink-0 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
                Complete Profile
              </Link>
            </div>
          </div>
        )}

        <div className={`bg-white rounded-xl border border-zinc-200 p-6 ${isBlocked ? 'opacity-50 pointer-events-none select-none' : ''}`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Job Title</label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className={inputClass('title')}
                placeholder="e.g. Build React E-Commerce Website"
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Description</label>
              <textarea
                rows={5}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className={inputClass('description')}
                placeholder="Describe what needs to be built, requirements, and deliverables..."
              />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Budget (₹)</label>
                <input
                  type="number"
                  value={form.budget}
                  onChange={e => setForm({ ...form, budget: e.target.value })}
                  className={inputClass('budget')}
                  placeholder="10000"
                />
                {errors.budget && <p className="text-red-500 text-xs mt-1">{errors.budget}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Deadline</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm({ ...form, deadline: e.target.value })}
                  className={inputClass('deadline')}
                />
                {errors.deadline && <p className="text-red-500 text-xs mt-1">{errors.deadline}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Required Skills</label>
              <SkillSelector value={skills} onChange={setSkills} />
            </div>

            <button type="submit" disabled={loading || isBlocked}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              {loading ? 'Posting...' : 'Post Job'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
