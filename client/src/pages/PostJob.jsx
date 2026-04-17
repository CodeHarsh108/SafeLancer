import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'
import Navbar from '../components/Navbar'
import SkillSelector from '../components/SkillSelector'
import toast from 'react-hot-toast'

const CATEGORIES = ['Web Development', 'Mobile', 'Design', 'Data Science', 'DevOps', 'Content', 'Other']
const DELIVERABLE_TYPES = ['Code File', 'Design File', 'Document', 'APK', 'Video', 'Other']

const emptyPhase = () => ({ title: '', guideline: '', deliverableType: 'Other', budgetPercent: '', phaseDeadline: '', maxRevisions: 2 })

const SectionHeader = ({ num, title, subtitle }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{num}</div>
    <div>
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
  </div>
)

export default function PostJob() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    title: '', description: '', budget: '', deadline: '',
    category: 'Other', experienceLevel: 'Mid',
    advancePercent: 10,
    nda: false, ipOwnership: 'client', latePenalty: 0, autoReleaseHours: 72
  })
  const [skills, setSkills] = useState([])
  const [phases, setPhases] = useState([emptyPhase(), emptyPhase(), emptyPhase()])
  const [referenceFiles, setReferenceFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [completion, setCompletion] = useState(parseInt(localStorage.getItem('profileCompletion') || '0', 10))

  useEffect(() => {
    api.get('/api/auth/me').then(({ data }) => {
      const pct = data.portfolio?.completionPercent || 0
      setCompletion(pct)
      localStorage.setItem('profileCompletion', String(pct))
    }).catch(() => {})
  }, [])

  const totalPercent = phases.reduce((sum, p) => sum + Number(p.budgetPercent || 0), 0)
  const budget = Number(form.budget) || 0
  const advanceAmount = Math.round(budget * form.advancePercent / 100)
  const remaining = budget - advanceAmount

  const updatePhase = (i, field, value) => {
    const updated = [...phases]
    updated[i] = { ...updated[i], [field]: value }
    setPhases(updated)
  }

  const addPhase = () => setPhases([...phases, emptyPhase()])
  const removePhase = (i) => { if (phases.length > 3) setPhases(phases.filter((_, idx) => idx !== i)) }

  const handleRefFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (referenceFiles.length >= 5) return toast.error('Maximum 5 reference files')
    if (file.size > 10 * 1024 * 1024) return toast.error('File must be under 10MB')
    setUploadingFile(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post('/api/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setReferenceFiles([...referenceFiles, { url: data.fileUrl, fileHash: data.fileHash, originalName: file.name }])
      toast.success('File uploaded and hashed')
    } catch {
      toast.error('File upload failed')
    } finally {
      setUploadingFile(false)
      e.target.value = ''
    }
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = 'Required'
    if (!form.description.trim() || form.description.length < 50) e.description = 'Minimum 50 characters'
    if (!form.budget || budget < 1000) e.budget = 'Minimum ₹1,000'
    if (!form.deadline) {
      e.deadline = 'Required'
    } else {
      const minDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      if (new Date(form.deadline) < minDate) e.deadline = 'Must be at least 7 days from today'
    }
    phases.forEach((p, i) => {
      if (!p.title.trim()) e[`phase_${i}_title`] = 'Required'
      if (!p.guideline.trim() || p.guideline.length < 20) e[`phase_${i}_guideline`] = 'Min 20 chars'
      if (!p.budgetPercent || Number(p.budgetPercent) <= 0) e[`phase_${i}_budget`] = 'Required'
      if (!p.phaseDeadline) e[`phase_${i}_deadline`] = 'Required'
    })
    if (Math.abs(totalPercent - 100) > 0.5) e.phasesTotal = `Phase % must total 100% (currently ${totalPercent}%)`
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) {
      toast.error('Please fix the errors below')
      return
    }
    setLoading(true)
    try {
      await api.post('/api/jobs', {
        ...form,
        budget: budget,
        skills,
        phases: phases.map(p => ({ ...p, budgetPercent: Number(p.budgetPercent) })),
        referenceFiles
      })
      toast.success('Job posted successfully!')
      setTimeout(() => navigate('/dashboard/client'), 1000)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post job')
    } finally { setLoading(false) }
  }

  const inp = (field) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none transition-colors ${errors[field] ? 'border-red-300 bg-red-50' : 'border-zinc-200 focus:border-zinc-400'}`

  const isBlocked = completion < 100

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-zinc-900">Post a New Job</h1>
          <p className="text-sm text-zinc-500 mt-1">Define your project phases upfront — freelancers see the full scope before applying</p>
        </div>

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
              <Link to="/profile/setup" className="flex-shrink-0 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
                Complete Profile
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={isBlocked ? 'opacity-50 pointer-events-none select-none space-y-5' : 'space-y-5'}>

          {/* Section 1: Basic Info */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <SectionHeader num="1" title="Basic Job Information" subtitle="Core details that describe your project" />
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Job Title</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className={inp('title')} placeholder="e.g. Build React E-Commerce Website" />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-400 transition-colors">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Experience Level</label>
                  <select value={form.experienceLevel} onChange={e => setForm({ ...form, experienceLevel: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-400 transition-colors">
                    <option value="Junior">Junior</option>
                    <option value="Mid">Mid-Level</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Project Description</label>
                <textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className={inp('description')} placeholder="Describe what needs to be built, tech stack, requirements..." />
                <div className="flex justify-between mt-1">
                  {errors.description ? <p className="text-red-500 text-xs">{errors.description}</p> : <span />}
                  <span className="text-xs text-zinc-400">{form.description.length} chars</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Total Budget (₹)</label>
                  <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
                    className={inp('budget')} placeholder="50000" />
                  {errors.budget && <p className="text-red-500 text-xs mt-1">{errors.budget}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Overall Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
                    min={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    className={inp('deadline')} />
                  {errors.deadline && <p className="text-red-500 text-xs mt-1">{errors.deadline}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Required Skills</label>
                <SkillSelector value={skills} onChange={setSkills} />
              </div>
            </div>
          </div>

          {/* Section 2: Advance Payment */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <SectionHeader num="2" title="Advance Payment" subtitle="Automatically locked when you hire — released to freelancer after Phase 1 approval" />
            <div className="flex gap-3 mb-4">
              {[10, 15, 20, 25].map(pct => (
                <button key={pct} type="button" onClick={() => setForm({ ...form, advancePercent: pct })}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${form.advancePercent === pct ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'}`}>
                  {pct}%
                </button>
              ))}
            </div>
            {budget > 0 && (
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 text-sm">
                <div className="flex justify-between text-zinc-600">
                  <span>Advance amount locked at hire:</span>
                  <span className="font-semibold text-zinc-900">₹{advanceAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-zinc-500 text-xs mt-1">
                  <span>Distributed across phases:</span>
                  <span>₹{remaining.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Phase Planning */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <SectionHeader num="3" title="Phase Planning" subtitle="Define deliverables for each phase — minimum 3 required" />

            {errors.phasesTotal && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errors.phasesTotal}</div>
            )}

            {/* Live Budget Breakdown */}
            {budget > 0 && (
              <div className="mb-5 p-4 bg-zinc-50 rounded-lg border border-zinc-100">
                <p className="text-xs font-semibold text-zinc-700 mb-2">Payment Breakdown</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span className="font-medium">Advance ({form.advancePercent}%)</span>
                    <span className="font-semibold text-zinc-900">₹{advanceAmount.toLocaleString()}</span>
                  </div>
                  {phases.map((p, i) => (
                    <div key={i} className="flex justify-between text-xs text-zinc-500">
                      <span>{p.title || `Phase ${i + 1}`} ({p.budgetPercent || 0}%)</span>
                      <span>₹{p.budgetPercent ? Math.round(remaining * Number(p.budgetPercent) / 100).toLocaleString() : '—'}</span>
                    </div>
                  ))}
                  <div className={`flex justify-between text-xs font-semibold mt-2 pt-2 border-t border-zinc-200 ${Math.abs(totalPercent - 100) > 0.5 ? 'text-red-600' : 'text-zinc-900'}`}>
                    <span>Phase Total</span>
                    <span>{totalPercent}% {Math.abs(totalPercent - 100) > 0.5 ? '✗' : '✓'}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {phases.map((phase, i) => (
                <div key={i} className="border border-zinc-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-zinc-900">Phase {i + 1}</span>
                    {phases.length > 3 && (
                      <button type="button" onClick={() => removePhase(i)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-zinc-600 mb-1 block">Phase Title</label>
                        <input value={phase.title} onChange={e => updatePhase(i, 'title', e.target.value)}
                          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${errors[`phase_${i}_title`] ? 'border-red-300 bg-red-50' : 'border-zinc-200 focus:border-zinc-400'}`}
                          placeholder="e.g. UI Design" />
                        {errors[`phase_${i}_title`] && <p className="text-red-500 text-xs mt-0.5">{errors[`phase_${i}_title`]}</p>}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-600 mb-1 block">Deliverable Type</label>
                        <select value={phase.deliverableType} onChange={e => updatePhase(i, 'deliverableType', e.target.value)}
                          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 transition-colors">
                          {DELIVERABLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-600 mb-1 block">Phase Guideline / Acceptance Criteria</label>
                      <textarea rows={3} value={phase.guideline} onChange={e => updatePhase(i, 'guideline', e.target.value)}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${errors[`phase_${i}_guideline`] ? 'border-red-300 bg-red-50' : 'border-zinc-200 focus:border-zinc-400'}`}
                        placeholder="What exactly must be delivered? What does done look like?" />
                      {errors[`phase_${i}_guideline`] && <p className="text-red-500 text-xs mt-0.5">{errors[`phase_${i}_guideline`]}</p>}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-zinc-600 mb-1 block">Budget %</label>
                        <div className="relative">
                          <input type="number" value={phase.budgetPercent} onChange={e => updatePhase(i, 'budgetPercent', e.target.value)}
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-7 ${errors[`phase_${i}_budget`] ? 'border-red-300 bg-red-50' : 'border-zinc-200 focus:border-zinc-400'}`}
                            placeholder="30" min="1" max="99" />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">%</span>
                        </div>
                        {errors[`phase_${i}_budget`] && <p className="text-red-500 text-xs mt-0.5">{errors[`phase_${i}_budget`]}</p>}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-600 mb-1 block">Phase Deadline</label>
                        <input type="date" value={phase.phaseDeadline} onChange={e => updatePhase(i, 'phaseDeadline', e.target.value)}
                          max={form.deadline || undefined}
                          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${errors[`phase_${i}_deadline`] ? 'border-red-300 bg-red-50' : 'border-zinc-200 focus:border-zinc-400'}`} />
                        {errors[`phase_${i}_deadline`] && <p className="text-red-500 text-xs mt-0.5">{errors[`phase_${i}_deadline`]}</p>}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-600 mb-1 block">Max Revisions</label>
                        <select value={phase.maxRevisions} onChange={e => updatePhase(i, 'maxRevisions', Number(e.target.value))}
                          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 transition-colors">
                          <option value={1}>1 revision</option>
                          <option value={2}>2 revisions</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={addPhase}
              className="mt-4 w-full border-2 border-dashed border-zinc-200 hover:border-zinc-400 text-zinc-500 hover:text-zinc-700 py-3 rounded-xl text-sm font-medium transition-colors">
              + Add Phase
            </button>
          </div>

          {/* Section 4: Reference Files */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <SectionHeader num="4" title="Reference Files" subtitle="Mockups, wireframes, specs — hashed and locked as dispute evidence (optional)" />
            {referenceFiles.length > 0 && (
              <div className="space-y-2 mb-4">
                {referenceFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 truncate">{f.originalName}</p>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate">{f.fileHash}</p>
                    </div>
                    <button type="button" onClick={() => setReferenceFiles(referenceFiles.filter((_, idx) => idx !== i))}
                      className="ml-3 text-zinc-400 hover:text-red-500 text-lg leading-none transition-colors">×</button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleRefFileUpload} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile || referenceFiles.length >= 5}
              className="w-full border-2 border-dashed border-zinc-200 hover:border-zinc-400 text-zinc-500 hover:text-zinc-700 py-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              {uploadingFile ? 'Uploading...' : `Upload Reference File (${referenceFiles.length}/5, max 10MB each)`}
            </button>
          </div>

          {/* Section 5: Terms */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <SectionHeader num="5" title="Project Terms" subtitle="Legal and payment terms visible to all applicants" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-800">NDA Required</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Non-disclosure agreement</p>
                    </div>
                    <button type="button" onClick={() => setForm({ ...form, nda: !form.nda })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${form.nda ? 'bg-zinc-900' : 'bg-zinc-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.nda ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-600 mb-1 block">IP Ownership</label>
                  <select value={form.ipOwnership} onChange={e => setForm({ ...form, ipOwnership: e.target.value })}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400 transition-colors">
                    <option value="client">Client owns all deliverables</option>
                    <option value="freelancer">Freelancer retains license</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-600 mb-1 block">Late Penalty % (per phase)</label>
                  <div className="relative">
                    <input type="number" value={form.latePenalty} onChange={e => setForm({ ...form, latePenalty: Math.min(30, Math.max(0, Number(e.target.value))) })}
                      className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400 transition-colors pr-7"
                      placeholder="0" min="0" max="30" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">%</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">Deducted if phase deadline missed (0 = no penalty)</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-600 mb-1 block">Auto-Release Timer</label>
                  <select value={form.autoReleaseHours} onChange={e => setForm({ ...form, autoReleaseHours: Number(e.target.value) })}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-400 transition-colors">
                    <option value={48}>48 hours</option>
                    <option value={72}>72 hours (default)</option>
                    <option value={168}>7 days</option>
                  </select>
                  <p className="text-xs text-zinc-400 mt-1">Auto-release payment if no review action taken</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Review & Post */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <SectionHeader num="6" title="Review & Post" subtitle="Once posted, scope and phase guidelines are locked with a SHA-256 hash" />

            {form.title && budget > 0 && (
              <div className="mb-5 p-4 bg-zinc-50 rounded-lg border border-zinc-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Title</span>
                  <span className="font-medium text-zinc-900 text-right max-w-xs truncate">{form.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Category</span>
                  <span className="font-medium text-zinc-900">{form.category}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Experience</span>
                  <span className="font-medium text-zinc-900">{form.experienceLevel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Budget</span>
                  <span className="font-medium text-zinc-900">₹{budget.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Advance</span>
                  <span className="font-medium text-zinc-900">{form.advancePercent}% = ₹{advanceAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Phases</span>
                  <span className="font-medium text-zinc-900">{phases.length} phases</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">NDA</span>
                  <span className="font-medium text-zinc-900">{form.nda ? 'Required' : 'Not required'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">IP Ownership</span>
                  <span className="font-medium text-zinc-900">{form.ipOwnership === 'client' ? 'Client' : 'Freelancer'}</span>
                </div>
              </div>
            )}

            <div className="p-3 bg-zinc-900 rounded-lg mb-5">
              <p className="text-xs text-zinc-400">Scope Lock</p>
              <p className="text-xs text-zinc-300 mt-1">After posting, a SHA-256 hash of your job title, description, and all phase guidelines will be generated and stored. This creates a tamper-proof record that protects both parties in any dispute.</p>
            </div>

            <button type="submit" disabled={loading || isBlocked}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50">
              {loading ? 'Posting...' : 'Post Job & Lock Scope'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
