import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'

export default function JobBoard() {
  const [jobs, setJobs] = useState([])
  const [filters, setFilters] = useState({ skills: '', minBudget: '', maxBudget: '', search: '' })
  const [loading, setLoading] = useState(true)

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.skills) params.skills = filters.skills
      if (filters.minBudget) params.minBudget = filters.minBudget
      if (filters.maxBudget) params.maxBudget = filters.maxBudget
      if (filters.search) params.search = filters.search
      const { data } = await api.get('/api/jobs', { params })
      setJobs(data)
    } catch { setJobs([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchJobs() }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Job Board</h1>
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Search jobs..." value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input placeholder="Skills (React,Node.js)" value={filters.skills}
              onChange={e => setFilters({ ...filters, skills: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input placeholder="Min Budget ₹" type="number" value={filters.minBudget}
              onChange={e => setFilters({ ...filters, minBudget: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input placeholder="Max Budget ₹" type="number" value={filters.maxBudget}
              onChange={e => setFilters({ ...filters, maxBudget: e.target.value })}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button onClick={fetchJobs}
            className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
            Apply Filters
          </button>
        </div>

        {loading
          ? <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>
          : jobs.length === 0
          ? <div className="text-center py-12 text-slate-400">No jobs found matching your filters</div>
          : jobs.map(job => (
            <div key={job._id} className="bg-white rounded-xl border border-slate-200 p-5 mb-4 hover:border-indigo-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-800">{job.title}</h2>
                  <p className="text-slate-500 text-sm mt-1 line-clamp-2">{job.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {job.skills?.map(s => <span key={s} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">{s}</span>)}
                  </div>
                  <div className="flex gap-4 mt-3 text-sm text-slate-500">
                    <span>Budget: <strong className="text-slate-700">₹{job.budget?.toLocaleString()}</strong></span>
                    <span>Deadline: <strong className="text-slate-700">{new Date(job.deadline).toLocaleDateString()}</strong></span>
                    <span>Bids: <strong className="text-slate-700">{job.bids?.length || 0}</strong></span>
                    {job.client?.rating > 0 && <span>Client: <strong className="text-slate-700">★ {job.client.rating}</strong></span>}
                  </div>
                </div>
                <Link to={`/jobs/${job._id}`}
                  className="ml-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors">
                  View & Bid
                </Link>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}
