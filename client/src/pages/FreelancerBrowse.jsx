import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'

const FILE_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'
const EMPTY = { search: '', skills: '', minRating: '', availability: '' }

export default function FreelancerBrowse() {
  const navigate = useNavigate()
  const [freelancers, setFreelancers] = useState([])
  const [filters, setFilters] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef(null)

  const fetchFreelancers = async (f) => {
    setLoading(true)
    try {
      const params = {}
      if (f.search) params.search = f.search
      if (f.skills) params.skills = f.skills
      if (f.minRating) params.minRating = f.minRating
      if (f.availability) params.availability = f.availability
      const { data } = await api.get('/api/jobs/freelancers/browse', { params })
      setFreelancers(data)
    } catch { setFreelancers([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchFreelancers(EMPTY) }, [])

  const applyFilters = (f) => { setFilters(f); fetchFreelancers(f) }

  const handleTextChange = (field, value) => {
    const updated = { ...filters, [field]: value }
    setFilters(updated)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchFreelancers(updated), 400)
  }

  const handleSelectChange = (field, value) => applyFilters({ ...filters, [field]: value })

  const handleEnter = (e) => { if (e.key === 'Enter') { clearTimeout(debounceRef.current); fetchFreelancers(filters) } }

  const clearFilters = () => applyFilters(EMPTY)

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 font-medium mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <h1 className="text-xl font-semibold text-zinc-900 mb-5">Find Freelancers</h1>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input placeholder="Search by name..." value={filters.search}
              onChange={e => handleTextChange('search', e.target.value)}
              onKeyDown={handleEnter}
              className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors" />
            <input placeholder="Skills (e.g. React, Node.js)" value={filters.skills}
              onChange={e => handleTextChange('skills', e.target.value)}
              onKeyDown={handleEnter}
              className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Min Rating (1–5)" type="number" min="1" max="5" value={filters.minRating}
              onChange={e => handleTextChange('minRating', e.target.value)}
              onKeyDown={handleEnter}
              className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors" />
            <select value={filters.availability}
              onChange={e => handleSelectChange('availability', e.target.value)}
              className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-400 transition-colors">
              <option value="">Any Availability</option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => { clearTimeout(debounceRef.current); fetchFreelancers(filters) }}
              className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
              Search
            </button>
            <button onClick={clearFilters}
              className="border border-zinc-200 hover:bg-zinc-50 text-zinc-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Clear
            </button>
          </div>
        </div>

        {loading
          ? <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" />
            </div>
          : freelancers.length === 0
          ? <div className="text-center py-12 text-zinc-400 text-sm">No freelancers found. Try different filters.</div>
          : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {freelancers.map(f => {
                const avatarUrl = f.avatarUrl
                  ? (f.avatarUrl.startsWith('http') ? f.avatarUrl : `${FILE_BASE}${f.avatarUrl}`)
                  : null
                return (
                  <div key={f._id} className="bg-white rounded-xl border border-zinc-200 p-5 hover:border-zinc-300 hover:shadow-sm transition-all flex flex-col">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      {avatarUrl
                        ? <img src={avatarUrl} alt={f.user?.name} className="w-11 h-11 rounded-full object-cover border border-zinc-200 flex-shrink-0" />
                        : <div className="w-11 h-11 bg-zinc-900 rounded-full flex items-center justify-center text-white font-semibold text-base flex-shrink-0">
                            {f.user?.name?.[0]?.toUpperCase()}
                          </div>
                      }
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-zinc-900 text-sm leading-tight">{f.user?.name}</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {f.user?.rating > 0 && (
                            <span className="text-zinc-700 text-xs font-medium">★ {f.user.rating.toFixed(1)}</span>
                          )}
                          {f.user?.totalJobsCompleted > 0 && (
                            <span className="text-zinc-400 text-xs">{f.user.totalJobsCompleted} jobs</span>
                          )}
                          <span className="capitalize text-xs px-2 py-0.5 rounded-md font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                            {f.availability || 'full-time'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    {f.bio && (
                      <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2 mb-3">{f.bio}</p>
                    )}

                    {/* Skills */}
                    {f.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {f.skills.slice(0, 5).map(s => (
                          <span key={s} className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-xs">{s}</span>
                        ))}
                        {f.skills.length > 5 && (
                          <span className="text-zinc-400 text-xs px-1">+{f.skills.length - 5} more</span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-auto">
                      <Link to={`/freelancers/${f.user?._id}`}
                        className="block w-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-2 rounded-lg text-xs font-medium text-center transition-colors">
                        View Profile
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
        }
      </div>
    </div>
  )
}
