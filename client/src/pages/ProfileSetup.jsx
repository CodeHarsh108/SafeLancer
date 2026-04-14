import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import SkillSelector from '../components/SkillSelector'
import toast, { Toaster } from 'react-hot-toast'

const INDUSTRIES = [
  'Technology', 'Finance & Fintech', 'Healthcare', 'E-commerce', 'Education',
  'Media & Entertainment', 'Real Estate', 'Manufacturing', 'Consulting', 'Other'
]

function isValidUrl(url) {
  if (!url) return true
  try { new URL(url); return true } catch { return false }
}

// ─────────────────────────────────────────────
// Profile Card — read-only view
// ─────────────────────────────────────────────
function ProfileCard({ portfolio, user, completion, onEdit }) {
  const isFreelancer = user?.role === 'freelancer'

  const completionColor =
    completion < 40 ? 'bg-red-500' :
    completion < 70 ? 'bg-amber-500' :
    completion < 100 ? 'bg-blue-500' : 'bg-green-500'

  const completionText =
    completion < 40 ? 'text-red-600' :
    completion < 70 ? 'text-amber-600' :
    completion < 100 ? 'text-blue-600' : 'text-green-600'

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{user?.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-semibold capitalize">
                  {user?.role}
                </span>
                {isFreelancer && portfolio?.availability && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    portfolio.availability === 'full-time' ? 'bg-green-100 text-green-700' :
                    portfolio.availability === 'part-time' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {portfolio.availability}
                  </span>
                )}
                {isFreelancer && portfolio?.hourlyRate > 0 && (
                  <span className="text-sm font-semibold text-slate-700">₹{portfolio.hourlyRate}/hr</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
            </svg>
            Edit Profile
          </button>
        </div>

        {/* Bio */}
        {portfolio?.bio ? (
          <p className="mt-4 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-4">{portfolio.bio}</p>
        ) : (
          <p className="mt-4 text-slate-400 text-sm italic border-t border-slate-100 pt-4">No bio added yet.</p>
        )}
      </div>

      {/* Skills (freelancer) */}
      {isFreelancer && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Skills</h3>
          {portfolio?.skills?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {portfolio.skills.map(skill => (
                <span key={skill} className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm font-medium px-3 py-1.5 rounded-full">
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm italic">No skills added yet.</p>
          )}
        </div>
      )}

      {/* Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Details</h3>
        <div className="space-y-3">
          {!isFreelancer && portfolio?.companyName && (
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-lg">🏢</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">Company</p>
                <p className="text-sm text-slate-700 font-medium">{portfolio.companyName}</p>
              </div>
            </div>
          )}
          {!isFreelancer && portfolio?.industry && (
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-lg">🏭</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">Industry</p>
                <p className="text-sm text-slate-700 font-medium">{portfolio.industry}</p>
              </div>
            </div>
          )}
          {isFreelancer && portfolio?.githubUrl && (
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-lg">💻</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">GitHub</p>
                <a href={portfolio.githubUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:underline font-medium break-all">
                  {portfolio.githubUrl}
                </a>
              </div>
            </div>
          )}
          {portfolio?.linkedinUrl && (
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-lg">🔗</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">LinkedIn</p>
                <a href={portfolio.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:underline font-medium break-all">
                  {portfolio.linkedinUrl}
                </a>
              </div>
            </div>
          )}
          {isFreelancer && portfolio?.portfolioUrl && (
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-lg">🌐</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">Portfolio Website</p>
                <a href={portfolio.portfolioUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:underline font-medium break-all">
                  {portfolio.portfolioUrl}
                </a>
              </div>
            </div>
          )}
          {isFreelancer && portfolio?.resumeUrl && (
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-lg">📄</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">Resume</p>
                <p className="text-sm text-green-600 font-medium">Uploaded</p>
              </div>
            </div>
          )}
          {isFreelancer && portfolio?.projectSamples?.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-lg">📎</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">Portfolio Samples</p>
                <p className="text-sm text-slate-700 font-medium">{portfolio.projectSamples.length} sample{portfolio.projectSamples.length > 1 ? 's' : ''} uploaded</p>
              </div>
            </div>
          )}
          {!portfolio?.linkedinUrl && !portfolio?.githubUrl && !portfolio?.companyName && !portfolio?.industry && (
            <p className="text-slate-400 text-sm italic">No details added yet. Click Edit Profile to complete your profile.</p>
          )}
        </div>
      </div>

      {/* Completion bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">Profile Completion</h3>
          <span className={`text-lg font-bold ${completionText}`}>{completion}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div className={`h-2 rounded-full transition-all duration-500 ${completionColor}`} style={{ width: `${completion}%` }} />
        </div>
        {completion < 100 && (
          <p className="text-xs text-slate-400 mt-2">
            {completion < 40 ? 'Add more details to make your profile visible to others.' :
             completion < 70 ? 'A few more details will make your profile stand out.' :
             'Almost there — one last push to reach 100%!'}
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Edit Form
// ─────────────────────────────────────────────
function ProfileEditForm({ portfolio, user, onSave, onCancel }) {
  const isFreelancer = user?.role === 'freelancer'

  const [form, setForm] = useState({
    bio: portfolio?.bio || '',
    skills: portfolio?.skills || [],
    githubUrl: portfolio?.githubUrl || '',
    linkedinUrl: portfolio?.linkedinUrl || '',
    portfolioUrl: portfolio?.portfolioUrl || '',
    hourlyRate: portfolio?.hourlyRate || '',
    availability: portfolio?.availability || 'full-time',
    companyName: portfolio?.companyName || '',
    industry: portfolio?.industry || ''
  })
  const [errors, setErrors] = useState({})
  const [uploading, setUploading] = useState(false)
  const [resumeUploading, setResumeUploading] = useState(false)
  const [sampleTitle, setSampleTitle] = useState('')
  const [localPortfolio, setLocalPortfolio] = useState(portfolio)
  const [saving, setSaving] = useState(false)

  const validate = () => {
    const e = {}
    if (!form.bio.trim()) e.bio = 'Bio is required'
    else if (form.bio.trim().length < 20) e.bio = 'Bio must be at least 20 characters'
    else if (form.bio.trim().length > 1000) e.bio = 'Bio cannot exceed 1000 characters'

    if (isFreelancer) {
      if (form.skills.length === 0) e.skills = 'Add at least one skill'
      if (!form.hourlyRate || Number(form.hourlyRate) <= 0) e.hourlyRate = 'Hourly rate is required and must be greater than 0'
      if (form.githubUrl && !isValidUrl(form.githubUrl)) e.githubUrl = 'Enter a valid URL (e.g. https://github.com/username)'
      if (form.portfolioUrl && !isValidUrl(form.portfolioUrl)) e.portfolioUrl = 'Enter a valid URL'
    } else {
      if (!form.industry) e.industry = 'Please select your industry'
    }
    if (form.linkedinUrl && !isValidUrl(form.linkedinUrl)) e.linkedinUrl = 'Enter a valid URL (e.g. https://linkedin.com/in/username)'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix the errors before saving')
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, skills: form.skills }
      const { data } = await api.post('/api/portfolio/update', payload)
      localStorage.setItem('profileCompletion', String(data.completionPercent || 20))
      window.dispatchEvent(new Event('profileUpdated'))
      onSave(data)
      toast.success('Profile saved!')
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleSampleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', sampleTitle || file.name)
    try {
      const { data } = await api.post('/api/portfolio/upload-sample', fd)
      setLocalPortfolio(prev => ({ ...prev, projectSamples: [...(prev?.projectSamples || []), data.sample] }))
      localStorage.setItem('profileCompletion', String(data.completionPercent || 20))
      window.dispatchEvent(new Event('profileUpdated'))
      setSampleTitle('')
      toast.success('Portfolio sample uploaded!')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setResumeUploading(true)
    const fd = new FormData()
    fd.append('resume', file)
    try {
      const { data } = await api.post('/api/portfolio/upload-resume', fd)
      setLocalPortfolio(prev => ({ ...prev, resumeUrl: data.resumeUrl }))
      localStorage.setItem('profileCompletion', String(data.completionPercent || 20))
      window.dispatchEvent(new Event('profileUpdated'))
      toast.success('Resume uploaded!')
    } catch {
      toast.error('Upload failed')
    } finally {
      setResumeUploading(false)
    }
  }

  const Field = ({ label, hint, required, bonus, error, children }) => (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
          {bonus && <span className="ml-1.5 text-xs text-indigo-500 font-normal">+{bonus}%</span>}
        </label>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )

  const inputClass = (hasErr) =>
    `w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
      hasErr ? 'border-red-400 bg-red-50' : 'border-slate-300'
    }`

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-slate-800">
            {isFreelancer ? 'Freelancer Profile' : 'Client Profile'}
          </h3>
          <span className="text-xs text-slate-400">Fields marked <span className="text-red-500">*</span> are required</span>
        </div>

        {/* Client-only */}
        {!isFreelancer && (
          <>
            <Field label="Company Name" bonus={15} error={errors.companyName}>
              <input
                value={form.companyName}
                onChange={e => setForm({ ...form, companyName: e.target.value })}
                className={inputClass(errors.companyName)}
                placeholder="e.g. TechStart Ltd"
              />
            </Field>
            <Field label="Industry" required bonus={15} error={errors.industry}>
              <select
                value={form.industry}
                onChange={e => { setForm({ ...form, industry: e.target.value }); setErrors({ ...errors, industry: '' }) }}
                className={inputClass(errors.industry)}
              >
                <option value="">Select your industry</option>
                {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </Field>
          </>
        )}

        {/* Bio */}
        <Field
          label="Bio"
          required
          bonus={isFreelancer ? 15 : 20}
          hint={`${form.bio.length}/1000`}
          error={errors.bio}
        >
          <textarea
            value={form.bio}
            onChange={e => { setForm({ ...form, bio: e.target.value }); setErrors({ ...errors, bio: '' }) }}
            rows={4}
            maxLength={1000}
            className={inputClass(errors.bio)}
            placeholder={
              isFreelancer
                ? 'Describe your expertise, the kind of projects you work on, and what makes you stand out... (min 20 characters)'
                : 'Describe what kind of projects you hire for, your company focus, and what you look for in freelancers... (min 20 characters)'
            }
          />
        </Field>

        {/* Freelancer-only */}
        {isFreelancer && (
          <>
            <Field label="Skills" required bonus={15} error={errors.skills}>
              <SkillSelector
                selected={form.skills}
                onChange={skills => { setForm({ ...form, skills }); setErrors({ ...errors, skills: '' }) }}
                error={errors.skills}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Hourly Rate (₹)" required bonus={10} error={errors.hourlyRate}>
                <input
                  type="number"
                  min="1"
                  value={form.hourlyRate}
                  onChange={e => { setForm({ ...form, hourlyRate: e.target.value }); setErrors({ ...errors, hourlyRate: '' }) }}
                  className={inputClass(errors.hourlyRate)}
                  placeholder="e.g. 500"
                />
              </Field>
              <Field label="Availability">
                <select
                  value={form.availability}
                  onChange={e => setForm({ ...form, availability: e.target.value })}
                  className={inputClass(false)}
                >
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </Field>
            </div>

            <Field label="GitHub URL" bonus={10} error={errors.githubUrl}
              hint="Must start with https://">
              <input
                value={form.githubUrl}
                onChange={e => { setForm({ ...form, githubUrl: e.target.value }); setErrors({ ...errors, githubUrl: '' }) }}
                className={inputClass(errors.githubUrl)}
                placeholder="https://github.com/username"
              />
            </Field>
          </>
        )}

        {/* LinkedIn — both roles */}
        <Field label="LinkedIn URL" bonus={isFreelancer ? 5 : 15} error={errors.linkedinUrl}
          hint="Must start with https://">
          <input
            value={form.linkedinUrl}
            onChange={e => { setForm({ ...form, linkedinUrl: e.target.value }); setErrors({ ...errors, linkedinUrl: '' }) }}
            className={inputClass(errors.linkedinUrl)}
            placeholder="https://linkedin.com/in/username"
          />
        </Field>

        {/* Freelancer: portfolio website */}
        {isFreelancer && (
          <Field label="Personal Portfolio Website" bonus={5} error={errors.portfolioUrl}
            hint="Must start with https://">
            <input
              value={form.portfolioUrl}
              onChange={e => { setForm({ ...form, portfolioUrl: e.target.value }); setErrors({ ...errors, portfolioUrl: '' }) }}
              className={inputClass(errors.portfolioUrl)}
              placeholder="https://yourportfolio.com"
            />
          </Field>
        )}

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-slate-300 text-slate-600 font-semibold py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Portfolio samples & resume — freelancer only */}
      {isFreelancer && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">
            Portfolio Samples & Resume
          </h3>

          {/* Uploaded samples list */}
          {localPortfolio?.projectSamples?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">
                Uploaded samples ({localPortfolio.projectSamples.length})
              </p>
              <div className="space-y-2">
                {localPortfolio.projectSamples.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-2.5">
                    <span className="text-lg">📎</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{s.title}</p>
                      <p className="text-xs text-slate-400 font-mono truncate">{s.fileHash?.slice(0, 24)}…</p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                      SHA-256 verified
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new sample */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">
                Add Portfolio Sample
                {!(localPortfolio?.projectSamples?.length > 0) && (
                  <span className="ml-1.5 text-xs text-indigo-500 font-normal">+10%</span>
                )}
              </label>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Each file is SHA-256 hashed — proof your work is authentic and timestamped on upload.
            </p>
            <input
              value={sampleTitle}
              onChange={e => setSampleTitle(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
              placeholder="Sample title (e.g. E-Commerce App Screenshot)"
            />
            <label className="block cursor-pointer bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-lg p-5 text-center transition-colors">
              <p className="text-sm text-slate-600 font-medium">
                {uploading ? 'Uploading & generating hash...' : 'Click to upload portfolio sample'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Images, PDFs, zip files • Max 10 MB</p>
              <input type="file" className="hidden" onChange={handleSampleUpload} disabled={uploading} />
            </label>
          </div>

          {/* Resume */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">
                Resume (PDF)
                {!localPortfolio?.resumeUrl && (
                  <span className="ml-1.5 text-xs text-indigo-500 font-normal">+10%</span>
                )}
              </label>
            </div>
            {localPortfolio?.resumeUrl ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <span className="text-xl">📄</span>
                <p className="text-sm text-green-700 font-medium flex-1">Resume uploaded</p>
                <label className="cursor-pointer text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors">
                  Replace
                  <input type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} />
                </label>
              </div>
            ) : (
              <label className="block cursor-pointer bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-lg p-5 text-center transition-colors">
                <p className="text-sm text-slate-600 font-medium">
                  {resumeUploading ? 'Uploading...' : 'Click to upload resume PDF'}
                </p>
                <p className="text-xs text-slate-400 mt-1">PDF only • Max 10 MB</p>
                <input type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} disabled={resumeUploading} />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function ProfileSetup() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || 'null')

  const [portfolio, setPortfolio] = useState(null)
  const [completion, setCompletion] = useState(
    parseInt(localStorage.getItem('profileCompletion') || '20', 10)
  )
  const [mode, setMode] = useState('loading') // 'loading' | 'view' | 'edit'

  useEffect(() => {
    api.get('/api/auth/me').then(({ data }) => {
      const p = data.portfolio
      setPortfolio(p)
      const pct = p?.completionPercent ?? 20
      setCompletion(pct)
      localStorage.setItem('profileCompletion', String(pct))
      // Start in edit mode if profile is brand new (no bio yet)
      setMode(!p?.bio ? 'edit' : 'view')
    }).catch(() => {
      setMode('edit')
    })
  }, [])

  const handleSaved = (updatedPortfolio) => {
    setPortfolio(updatedPortfolio)
    setCompletion(updatedPortfolio.completionPercent || 20)
    setMode('view')
  }

  const handleCancel = () => {
    if (!portfolio?.bio) {
      // New user cancelling — go to dashboard
      navigate(user?.role === 'client' ? '/dashboard/client' : '/dashboard/freelancer')
    } else {
      setMode('view')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      <Navbar />
      <div className="max-w-2xl mx-auto p-6 pb-16">

        {/* Page title row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {mode === 'edit' ? 'Fill in your details and save' : 'How others see your profile'}
            </p>
          </div>
          {mode === 'view' && (
            <button
              onClick={() => navigate(user?.role === 'client' ? '/dashboard/client' : '/dashboard/freelancer')}
              className="text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors"
            >
              ← Dashboard
            </button>
          )}
        </div>

        {mode === 'loading' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading your profile…</p>
          </div>
        )}

        {mode === 'view' && portfolio && (
          <ProfileCard
            portfolio={portfolio}
            user={user}
            completion={completion}
            onEdit={() => setMode('edit')}
          />
        )}

        {mode === 'edit' && (
          <ProfileEditForm
            portfolio={portfolio}
            user={user}
            onSave={handleSaved}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  )
}
