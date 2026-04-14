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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg text-center">
        <div className={`text-6xl mb-4 ${result?.verified ? 'text-green-500' : 'text-red-400'}`}>
          {result?.verified ? '✓' : '✗'}
        </div>
        <h1 className={`text-2xl font-bold mb-2 ${result?.verified ? 'text-green-700' : 'text-red-600'}`}>
          {result?.verified ? 'Delivery Verified' : 'Hash Not Found'}
        </h1>
        <p className="text-slate-500 text-sm mb-6">
          {result?.verified
            ? 'This file was cryptographically recorded as delivered on FreeLock.'
            : 'This hash does not match any recorded delivery on the platform.'}
        </p>

        {result?.verified && (
          <>
            <div className="bg-slate-50 rounded-xl p-4 text-left text-sm mb-6 space-y-2">
              {[
                ['Client', result.client],
                ['Freelancer', result.freelancer],
                ['Milestone', result.milestoneTitle],
                ['Amount', `₹${result.amount?.toLocaleString()}`],
                ['Status', result.status],
                ['Submitted', result.submittedAt ? new Date(result.submittedAt).toLocaleDateString() : 'N/A'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium capitalize">{value}</span>
                </div>
              ))}
            </div>
            <div className="bg-slate-900 rounded-xl p-4 text-left mb-6">
              <p className="text-slate-400 text-xs mb-1">SHA-256 Hash:</p>
              <p className="text-green-400 font-mono text-xs break-all">{hash}</p>
            </div>
            <a href={`http://localhost:5000/api/files/certificate/${hash}`} target="_blank" rel="noreferrer"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
              Download Certificate PDF
            </a>
          </>
        )}
        <div className="mt-6">
          <a href="/" className="text-indigo-500 hover:underline text-sm">← Back to FreeLock</a>
        </div>
      </div>
    </div>
  )
}
