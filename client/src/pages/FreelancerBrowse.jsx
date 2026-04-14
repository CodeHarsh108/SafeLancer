import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

export default function FreelancerBrowse() {
  const [freelancers, setFreelancers] = useState([])
  const [filters, setFilters] = useState({ skills: '', minRating: '', availability: '', maxRate: '' })
  const [loading, setLoading] = useState(true)
  const [demoModal, setDemoModal] = useState(null)
  const [demoForm, setDemoForm] = useState({ message: '', proposedAt: '' })

  const fetchFreelancers = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.skills) params.skills = filters.skills
      if (filters.minRating) params.minRating = filters.minRating
      if (filters.availability) params.availability = filters.availability
      if (filters.maxRate) params.maxRate = filters.maxRate
      const { data } = await api.get('/api/jobs/freelancers/browse', { params })
      setFreelancers(data)
    } catch { setFreelancers([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchFreelancers() }, [])

  const sendDemoRequest = async () => {
    if (!demoForm.message) return toast.error('Please describe what you want to see')
    try {
      await api.post('/api/demos/request', { freelancerId: demoModal._id, message: demoForm.message, proposedAt: demoForm.proposedAt })
      toast.success('Demo request sent!')
      setDemoModal(null)
      setDemoForm({ message: '', proposedAt: '' })
    } catch { toast.error('Failed to send demo request') }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Find Freelancers</h1>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Skills (React,Node.js)" value={filters.skills}
              onChange={e => setFilters({ ...filters, skills: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input placeholder="Min Rating (1-5)" type="number" min="1" max="5" value={filters.minRating}
              onChange={e => setFilters({ ...filters, minRating: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <select value={filters.availability} onChange={e => setFilters({ ...filters, availability: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Any Availability</option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
            </select>
            <input placeholder="Max Rate ₹/hr" type="number" value={filters.maxRate}
              onChange={e => setFilters({ ...filters, maxRate: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button onClick={fetchFreelancers}
            className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
            Apply Filters
          </button>
        </div>

        {loading
          ? <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>
          : freelancers.length === 0
          ? <div className="text-center py-12 text-slate-400">No freelancers found. Try different filters.</div>
          : freelancers.map(f => (
            <div key={f._id} className="bg-white rounded-xl border border-slate-200 p-5 mb-4 hover:border-indigo-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {f.user?.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-800">{f.user?.name}</h2>
                      <div className="flex items-center gap-2 text-sm">
                        {f.user?.rating > 0 && <span className="text-yellow-600">★ {f.user.rating}</span>}
                        {f.user?.totalJobsCompleted > 0 && <span className="text-slate-500">{f.user.totalJobsCompleted} jobs</span>}
                        <span className={`capitalize text-xs px-2 py-0.5 rounded-full ${
                          f.availability === 'full-time' ? 'bg-green-100 text-green-700'
                          : f.availability === 'part-time' ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>{f.availability || 'full-time'}</span>
                      </div>
                    </div>
                  </div>
                  {f.bio && <p className="text-sm text-slate-500 mt-2 line-clamp-2">{f.bio}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {f.skills?.map(s => <span key={s} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">{s}</span>)}
                  </div>
                  {f.hourlyRate > 0 && <p className="text-sm text-slate-500 mt-2">Rate: <strong className="text-slate-700">₹{f.hourlyRate}/hr</strong></p>}
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  <Link to={`/freelancers/${f.user?._id}`}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium text-center">
                    View Profile
                  </Link>
                  <button onClick={() => setDemoModal(f.user)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                    Request Demo
                  </button>
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {demoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Request Demo from {demoModal.name}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">What do you want to see?</label>
                <textarea value={demoForm.message} onChange={e => setDemoForm({ ...demoForm, message: e.target.value })} rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. I want to see your React dashboard and how you structure components" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Proposed Meeting Time</label>
                <input type="datetime-local" value={demoForm.proposedAt} onChange={e => setDemoForm({ ...demoForm, proposedAt: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3">
                <button onClick={sendDemoRequest}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors">
                  Send Request
                </button>
                <button onClick={() => setDemoModal(null)}
                  className="flex-1 border border-slate-300 text-slate-600 font-semibold py-2.5 rounded-lg hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
