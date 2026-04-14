import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import toast, { Toaster } from 'react-hot-toast'

export default function ProfileSetup() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const [form, setForm] = useState({ bio: '', skills: '', githubUrl: '', linkedinUrl: '', portfolioUrl: '', hourlyRate: '', availability: 'full-time', companyName: '' })
  const [uploading, setUploading] = useState(false)
  const [sampleTitle, setSampleTitle] = useState('')
  const [completion, setCompletion] = useState(20)

  useEffect(() => {
    api.get('/api/auth/me').then(({ data }) => {
      if (data.portfolio) {
        setForm({
          bio: data.portfolio.bio || '',
          skills: (data.portfolio.skills || []).join(', '),
          githubUrl: data.portfolio.githubUrl || '',
          linkedinUrl: data.portfolio.linkedinUrl || '',
          portfolioUrl: data.portfolio.portfolioUrl || '',
          hourlyRate: data.portfolio.hourlyRate || '',
          availability: data.portfolio.availability || 'full-time',
          companyName: data.portfolio.companyName || ''
        })
        setCompletion(data.portfolio.completionPercent || 20)
      }
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    try {
      await api.post('/api/portfolio/update', { ...form, skills: form.skills.split(',').map(s => s.trim()).filter(Boolean) })
      toast.success('Profile saved!')
    } catch { toast.error('Failed to save profile') }
  }

  const handleSampleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', sampleTitle || file.name)
    try {
      await api.post('/api/portfolio/upload-sample', fd)
      toast.success('Portfolio sample uploaded!')
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const fd = new FormData()
    fd.append('resume', file)
    try {
      await api.post('/api/portfolio/upload-resume', fd)
      toast.success('Resume uploaded!')
    } catch { toast.error('Upload failed') }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <Navbar />
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-slate-800">Complete Your Profile</h2>
            <span className="text-indigo-600 font-bold">{completion}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${completion}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          {user?.role === 'client' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Your company name (optional)" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
            <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Tell others about yourself..." />
          </div>
          {user?.role === 'freelancer' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Skills (comma separated)</label>
                <input value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="React, Node.js, MongoDB, Python..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate (₹)</label>
                  <input type="number" value={form.hourlyRate} onChange={e => setForm({ ...form, hourlyRate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Availability</label>
                  <select value={form.availability} onChange={e => setForm({ ...form, availability: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">GitHub URL</label>
                <input value={form.githubUrl} onChange={e => setForm({ ...form, githubUrl: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://github.com/username" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn URL</label>
                <input value={form.linkedinUrl} onChange={e => setForm({ ...form, linkedinUrl: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://linkedin.com/in/username" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Portfolio Sample Title</label>
                <input value={sampleTitle} onChange={e => setSampleTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="E.g. E-Commerce App Screenshot" />
                <label className="mt-2 block cursor-pointer bg-slate-100 hover:bg-slate-200 border-2 border-dashed border-slate-300 rounded-lg p-4 text-center transition-colors">
                  <p className="text-sm text-slate-600">{uploading ? 'Uploading...' : 'Click to upload portfolio sample'}</p>
                  <input type="file" className="hidden" onChange={handleSampleUpload} disabled={uploading} />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Resume (PDF)</label>
                <label className="block cursor-pointer bg-slate-100 hover:bg-slate-200 border-2 border-dashed border-slate-300 rounded-lg p-4 text-center transition-colors">
                  <p className="text-sm text-slate-600">Click to upload resume PDF</p>
                  <input type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} />
                </label>
              </div>
            </>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors">
              Save Profile
            </button>
            <button onClick={() => navigate(user?.role === 'client' ? '/client/dashboard' : '/freelancer/dashboard')}
              className="flex-1 border border-slate-300 text-slate-600 font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
