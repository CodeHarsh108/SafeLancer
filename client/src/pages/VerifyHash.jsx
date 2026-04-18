import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'

export default function VerifyHash() {
  const { hash } = useParams()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.post('/api/files/verify-hash', { fileHash: hash })
      .then(({ data }) => setResult(data))
      .catch(() => setResult({ verified: false }))
      .finally(() => setLoading(false))
  }, [hash])

  if (loading) return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="text-xl font-bold text-zinc-900 tracking-tight">SafeLancer</div>
        <div className="text-sm text-zinc-500 mt-1">Delivery Verification</div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-8 w-full max-w-lg text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold ${result?.verified ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
          {result?.verified ? '✓' : '✗'}
        </div>
        <h1 className={`text-xl font-semibold mb-2 ${result?.verified ? 'text-emerald-700' : 'text-red-600'}`}>
          {result?.verified ? 'Delivery Verified' : 'Hash Not Found'}
        </h1>
        <p className="text-zinc-500 text-sm mb-6">
          {result?.verified
            ? 'This file was cryptographically recorded as delivered on SafeLancer.'
            : 'This hash does not match any recorded delivery on the platform.'}
        </p>

        {result?.verified && (
          <>
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-left text-sm mb-5 space-y-2.5">
              {[
                ['Client', result.client],
                ['Freelancer', result.freelancer],
                ['Milestone', result.milestoneTitle],
                ['Amount', `₹${result.amount?.toLocaleString()}`],
                ['Status', result.status],
                ['Submitted', result.submittedAt ? new Date(result.submittedAt).toLocaleDateString() : 'N/A'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-zinc-400">{label}</span>
                  <span className="font-medium text-zinc-700 capitalize">{value}</span>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 rounded-xl p-4 text-left mb-5">
              <p className="text-zinc-400 text-xs mb-1.5">SHA-256 Hash</p>
              <p className="text-emerald-400 font-mono text-xs break-all">{hash}</p>
            </div>
            <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/files/certificate/${hash}`} target="_blank" rel="noreferrer"
              className="inline-block bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
              Download Certificate PDF
            </a>
          </>
        )}
        <div className="mt-6">
          <a href="/" className="text-zinc-500 hover:text-zinc-900 text-sm underline underline-offset-2">← Back to SafeLancer</a>
        </div>
      </div>
    </div>
  )
}
