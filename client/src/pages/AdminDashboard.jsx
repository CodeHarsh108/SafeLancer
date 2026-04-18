import { useState, useEffect } from 'react'
import api from '../api'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'

const FILE_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001'

function FileLink({ url, label }) {
  if (!url) return null
  const href = url.startsWith('http') ? url : `${FILE_BASE}${url}`
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {label || 'Download'}
    </a>
  )
}

function HashBadge({ hash }) {
  if (!hash) return null
  return (
    <span className="font-mono text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded border border-zinc-200 break-all">
      SHA256: {hash.substring(0, 16)}…
    </span>
  )
}

function DisputeDetail({ disputeId, onClose, onResolved }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [split, setSplit] = useState('')
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    api.get(`/api/admin/disputes/${disputeId}/full`)
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load dispute details'))
      .finally(() => setLoading(false))
  }, [disputeId])

  const resolve = async (resolution, splitPercent) => {
    setResolving(true)
    try {
      await api.patch(`/api/disputes/${disputeId}/resolve`, { resolution, splitPercent })
      toast.success('Dispute resolved!')
      onResolved()
    } catch { toast.error('Failed to resolve') }
    finally { setResolving(false) }
  }

  const STATUS_COLOR = {
    pending_deposit: 'bg-zinc-100 text-zinc-500',
    funded: 'bg-blue-50 text-blue-600',
    in_progress: 'bg-amber-50 text-amber-600',
    submitted: 'bg-purple-50 text-purple-600',
    review: 'bg-yellow-50 text-yellow-700',
    approved: 'bg-emerald-50 text-emerald-700',
    released: 'bg-zinc-900 text-white',
    disputed: 'bg-red-100 text-red-700',
    refunded: 'bg-zinc-100 text-zinc-500',
    inaccurate_1: 'bg-orange-50 text-orange-600',
    inaccurate_2: 'bg-red-50 text-red-600',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-red-50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <h2 className="text-sm font-semibold text-zinc-900">Dispute Review</h2>
            {data?.dispute?.contract?.hashId && (
              <span className="font-mono text-xs text-zinc-400">#{data.dispute.contract.hashId}</span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" />
          </div>
        ) : data ? (
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Parties */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">Client</p>
                <p className="text-sm font-semibold text-zinc-900">{data.dispute.contract?.client?.name}</p>
                <p className="text-xs text-zinc-500">{data.dispute.contract?.client?.email}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Freelancer</p>
                <p className="text-sm font-semibold text-zinc-900">{data.dispute.contract?.freelancer?.name}</p>
                <p className="text-xs text-zinc-500">{data.dispute.contract?.freelancer?.email}</p>
              </div>
            </div>

            {/* Dispute Reason */}
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1">
                Dispute Reason · Raised by {data.dispute.raisedBy?.name} ({data.dispute.raisedBy?.role})
              </p>
              <p className="text-sm text-red-800">{data.dispute.reason}</p>
              <p className="text-xs text-red-400 mt-1">{new Date(data.dispute.createdAt).toLocaleString()}</p>
            </div>

            {/* Disputed Milestone Files */}
            {data.dispute.milestone && (
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="bg-zinc-50 px-4 py-2.5 border-b border-zinc-100">
                  <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Disputed Milestone — {data.dispute.milestone.title}</p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600">Amount: <strong>₹{data.dispute.milestone.amount?.toLocaleString()}</strong></span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLOR[data.dispute.milestone.status] || 'bg-zinc-100 text-zinc-500'}`}>
                      {data.dispute.milestone.status?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {data.dispute.milestone.submissionFileUrl && (
                    <div className="flex items-center gap-3 bg-zinc-50 rounded-lg p-3 border border-zinc-100">
                      <svg className="w-5 h-5 text-zinc-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-700 mb-1">Submitted File</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <FileLink url={data.dispute.milestone.submissionFileUrl} label="Download file" />
                          <HashBadge hash={data.dispute.milestone.submissionFileHash} />
                        </div>
                      </div>
                    </div>
                  )}

                  {data.dispute.milestone.submissionVideoUrl && (
                    <div className="flex items-center gap-3 bg-zinc-50 rounded-lg p-3 border border-zinc-100">
                      <svg className="w-5 h-5 text-zinc-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-700 mb-1">Submission Video</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <FileLink url={data.dispute.milestone.submissionVideoUrl} label="Watch video" />
                          <HashBadge hash={data.dispute.milestone.submissionVideoHash} />
                        </div>
                      </div>
                    </div>
                  )}

                  {data.dispute.milestone.submissionNote && (
                    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100">
                      <p className="text-xs font-medium text-zinc-500 mb-1">Submission Note</p>
                      <p className="text-sm text-zinc-700">{data.dispute.milestone.submissionNote}</p>
                    </div>
                  )}

                  {data.dispute.milestone.inaccuracyNote && (
                    <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                      <p className="text-xs font-medium text-orange-500 mb-1">
                        Inaccuracy Note ({data.dispute.milestone.inaccuracyCount}/{data.dispute.milestone.maxRevisions} revisions used)
                      </p>
                      <p className="text-sm text-orange-800">{data.dispute.milestone.inaccuracyNote}</p>
                    </div>
                  )}

                  {data.dispute.milestone.deadlineExtensions?.length > 0 && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <p className="text-xs font-medium text-amber-600 mb-2">
                        Deadline Extended {data.dispute.milestone.deadlineExtensions.length}×
                      </p>
                      {data.dispute.milestone.deadlineExtensions.map((ext, i) => (
                        <p key={i} className="text-xs text-amber-700">
                          → {new Date(ext.newDeadline).toLocaleDateString()} {ext.reason && `— ${ext.reason}`}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* All Contract Milestones */}
            {data.milestones?.length > 0 && (
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="bg-zinc-50 px-4 py-2.5 border-b border-zinc-100">
                  <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">All Contract Milestones</p>
                </div>
                <div className="divide-y divide-zinc-100">
                  {data.milestones.map(m => (
                    <div key={m._id} className="px-4 py-3 flex items-center gap-3">
                      <span className="w-6 h-6 bg-zinc-100 rounded-full text-[10px] font-bold text-zinc-500 flex items-center justify-center flex-shrink-0">
                        {m.isAdvance ? 'A' : m.milestoneNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 truncate">{m.title}</p>
                        <p className="text-xs text-zinc-400">₹{m.amount?.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {m.submissionFileUrl && <FileLink url={m.submissionFileUrl} label="File" />}
                        {m.submissionVideoUrl && <FileLink url={m.submissionVideoUrl} label="Video" />}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLOR[m.status] || 'bg-zinc-100 text-zinc-500'}`}>
                          {m.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Freelancer Portfolio Samples */}
            {data.portfolioSamples?.length > 0 && (
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="bg-zinc-50 px-4 py-2.5 border-b border-zinc-100">
                  <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Freelancer Portfolio Samples</p>
                </div>
                <div className="divide-y divide-zinc-100">
                  {data.portfolioSamples.map((s, i) => (
                    <div key={i} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800">{s.title}</p>
                        {s.description && <p className="text-xs text-zinc-400 truncate">{s.description}</p>}
                        {s.fileHash && <HashBadge hash={s.fileHash} />}
                      </div>
                      {s.fileUrl && <FileLink url={s.fileUrl} label="View sample" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence Timeline */}
            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <div className="bg-zinc-50 px-4 py-2.5 border-b border-zinc-100">
                <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                  Evidence Submitted ({data.dispute.evidence?.length || 0})
                </p>
              </div>
              {!data.dispute.evidence?.length ? (
                <p className="text-sm text-zinc-400 text-center py-4">No evidence submitted yet</p>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {data.dispute.evidence.map((e, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-zinc-700">{e.submittedBy?.name || 'Unknown'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${e.submittedBy?.role === 'client' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {e.submittedBy?.role}
                        </span>
                        <span className="text-xs text-zinc-400 ml-auto">{new Date(e.submittedAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-zinc-700">{e.description}</p>
                      {e.fileUrl && <div className="mt-1"><FileLink url={e.fileUrl} label="View attachment" /></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Auto Evidence Summary */}
            {data.dispute.evidenceSummary?.submissionHashes?.length > 0 && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Auto-Compiled Evidence Summary</p>
                <div className="space-y-1.5">
                  {data.dispute.evidenceSummary.submissionHashes.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Submission hash {i + 1}:</span>
                      <HashBadge hash={h} />
                    </div>
                  ))}
                  {data.dispute.evidenceSummary.inaccuracyNotes?.map((n, i) => (
                    <div key={i} className="text-xs text-orange-600">Inaccuracy note {i + 1}: {n}</div>
                  ))}
                  {data.dispute.evidenceSummary.deadlineExtensionCount > 0 && (
                    <div className="text-xs text-amber-600">Deadline extended {data.dispute.evidenceSummary.deadlineExtensionCount}× during contract</div>
                  )}
                </div>
              </div>
            )}

            {/* Resolution Actions */}
            <div className="border-t border-zinc-100 pt-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Resolve Dispute</p>
              <div className="flex flex-wrap gap-2 items-center">
                <button onClick={() => resolve('release_to_freelancer')} disabled={resolving}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Release to Freelancer
                </button>
                <button onClick={() => resolve('refund_to_client')} disabled={resolving}
                  className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Refund to Client
                </button>
                <div className="flex items-center gap-2 border-l border-zinc-200 pl-3">
                  <input type="number" min="0" max="100" placeholder="Freelancer %" value={split}
                    onChange={e => setSplit(e.target.value)}
                    className="border border-zinc-200 rounded-lg px-2 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-zinc-300" />
                  <button onClick={() => resolve('split', Number(split))} disabled={!split || resolving}
                    className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                    Split
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const TX_TYPE = {
  phase_payment:   'Phase Payment',
  advance_payment: 'Advance Payment',
  dispute_release: 'Dispute Release',
  split_payment:   'Split Payment',
  auto_release:    'Auto Release',
}

const M_STATUS_COLOR = {
  pending_deposit: 'bg-zinc-100 text-zinc-400',
  funded:          'bg-blue-50 text-blue-600',
  in_progress:     'bg-amber-50 text-amber-600',
  submitted:       'bg-purple-50 text-purple-600',
  review:          'bg-yellow-50 text-yellow-700',
  approved:        'bg-emerald-50 text-emerald-700',
  inaccurate_1:    'bg-orange-50 text-orange-600',
  inaccurate_2:    'bg-red-50 text-red-600',
  disputed:        'bg-red-100 text-red-700',
  released:        'bg-zinc-900 text-white',
  refunded:        'bg-zinc-100 text-zinc-500',
}

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-200'}`}>
      <div className={`text-2xl font-bold ${accent ? 'text-white' : 'text-zinc-900'}`}>{value}</div>
      <div className={`text-sm mt-0.5 ${accent ? 'text-zinc-400' : 'text-zinc-500'}`}>{label}</div>
      {sub && <div className={`text-xs mt-0.5 ${accent ? 'text-zinc-500' : 'text-zinc-400'}`}>{sub}</div>}
    </div>
  )
}

function PaymentsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedContract, setExpandedContract] = useState(null)
  const [view, setView] = useState('overview') // overview | clients | advances | contracts | payouts

  useEffect(() => {
    api.get('/api/admin/payments')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load payment data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" />
    </div>
  )
  if (!data) return null

  const { summary, advances, contracts, clientSummary, transactions } = data
  const heldAdvances = advances.filter(a => a.held)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Total Funded" value={`₹${summary.totalFunded.toLocaleString()}`} sub="by clients" accent />
        <SummaryCard label="In Escrow" value={`₹${summary.totalHeld.toLocaleString()}`} sub="held by platform" />
        <SummaryCard label="Released" value={`₹${summary.totalReleased.toLocaleString()}`} sub="to freelancers" />
        <SummaryCard label="Advance Held" value={`₹${summary.totalAdvanceHeld.toLocaleString()}`} sub={`${heldAdvances.length} contracts`} />
        <SummaryCard label="Payouts Sent" value={`₹${summary.totalPayouts.toLocaleString()}`} sub={`${transactions.length} transactions`} />
        <SummaryCard label="Refunded" value={`₹${summary.totalRefunded.toLocaleString()}`} sub="to clients" />
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
        {[
          { key: 'overview',  label: 'Overview' },
          { key: 'clients',   label: `Clients (${clientSummary.length})` },
          { key: 'advances',  label: `Advances (${heldAdvances.length} held)` },
          { key: 'contracts', label: `Contracts (${contracts.length})` },
          { key: 'payouts',   label: `Payouts (${transactions.length})` },
        ].map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${view === v.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ── VIEW: Overview ── */}
      {view === 'overview' && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Fund flow visual */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Fund Flow</p>
            {[
              { label: 'Client Deposits (Total Funded)', amount: summary.totalFunded, color: 'bg-zinc-900' },
              { label: 'Currently in Escrow', amount: summary.totalHeld, color: 'bg-amber-400' },
              { label: 'Released to Freelancers', amount: summary.totalReleased, color: 'bg-emerald-500' },
              { label: 'Advance Held by Platform', amount: summary.totalAdvanceHeld, color: 'bg-blue-500' },
              { label: 'Refunded to Clients', amount: summary.totalRefunded, color: 'bg-red-400' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 mb-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: row.color.replace('bg-', '') }}>
                  <div className={`w-2.5 h-2.5 rounded-full ${row.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-zinc-600">{row.label}</span>
                    <span className="text-xs font-bold text-zinc-900">₹{row.amount.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className={`h-1.5 rounded-full ${row.color} transition-all`}
                      style={{ width: summary.totalFunded > 0 ? `${Math.min(100, (row.amount / summary.totalFunded) * 100)}%` : '0%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Top clients by deposit */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Top Clients by Deposit</p>
            {clientSummary.slice(0, 6).map(c => (
              <div key={c.client._id} className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 bg-zinc-900 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {c.client.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-800 truncate">{c.client.name}</span>
                    <span className="text-xs font-bold text-zinc-900 flex-shrink-0 ml-2">₹{c.totalDeposited.toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2 text-[10px] text-zinc-400 mt-0.5">
                    <span>{c.contractCount} contract{c.contractCount !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span className="text-amber-600">₹{c.totalHeld.toLocaleString()} held</span>
                    <span>·</span>
                    <span className="text-emerald-600">₹{c.totalReleased.toLocaleString()} released</span>
                  </div>
                </div>
              </div>
            ))}
            {clientSummary.length === 0 && <p className="text-sm text-zinc-400 text-center py-4">No client deposits yet</p>}
          </div>
        </div>
      )}

      {/* ── VIEW: Clients ── */}
      {view === 'clients' && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50 grid grid-cols-6 gap-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span className="col-span-2">Client</span>
            <span className="text-right">Contracts</span>
            <span className="text-right">Total Deposited</span>
            <span className="text-right">In Escrow</span>
            <span className="text-right">Released</span>
          </div>
          {clientSummary.length === 0
            ? <p className="text-sm text-zinc-400 text-center py-8">No client payment data yet</p>
            : clientSummary.map(c => (
              <div key={c.client._id} className="px-5 py-3 border-b border-zinc-50 grid grid-cols-6 gap-2 items-center hover:bg-zinc-50 transition-colors">
                <div className="col-span-2 flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 bg-zinc-900 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {c.client.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{c.client.name}</p>
                    <p className="text-xs text-zinc-400 truncate">{c.client.email}</p>
                  </div>
                </div>
                <span className="text-sm text-zinc-600 text-right">{c.contractCount}</span>
                <span className="text-sm font-semibold text-zinc-900 text-right">₹{c.totalDeposited.toLocaleString()}</span>
                <span className="text-sm font-medium text-amber-600 text-right">₹{c.totalHeld.toLocaleString()}</span>
                <span className="text-sm font-medium text-emerald-600 text-right">₹{c.totalReleased.toLocaleString()}</span>
              </div>
            ))
          }
        </div>
      )}

      {/* ── VIEW: Advances ── */}
      {view === 'advances' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-800">
              <strong>₹{summary.totalAdvanceHeld.toLocaleString()}</strong> advance currently held — released to freelancer when Phase 1 is approved.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50 grid grid-cols-5 gap-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              <span className="col-span-2">Contract / Project</span>
              <span>Client</span>
              <span className="text-right">Advance Amount</span>
              <span className="text-right">Status</span>
            </div>
            {advances.length === 0
              ? <p className="text-sm text-zinc-400 text-center py-8">No advance payments yet</p>
              : advances.map(a => (
                <div key={a._id} className="px-5 py-3 border-b border-zinc-50 grid grid-cols-5 gap-2 items-center">
                  <div className="col-span-2 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {a.contract?.job?.title || 'Untitled Project'}
                    </p>
                    <p className="text-xs text-zinc-400 font-mono">#{a.contract?.hashId}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-700 truncate">{a.contract?.client?.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{a.contract?.client?.email}</p>
                  </div>
                  <span className={`text-sm font-semibold text-right ${a.held ? 'text-amber-600' : 'text-emerald-600'}`}>
                    ₹{a.amount.toLocaleString()}
                  </span>
                  <div className="text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${M_STATUS_COLOR[a.status] || 'bg-zinc-100 text-zinc-400'}`}>
                      {a.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── VIEW: Contracts ── */}
      {view === 'contracts' && (
        <div className="space-y-3">
          {contracts.length === 0
            ? <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center text-zinc-400 text-sm">No contracts with payments yet</div>
            : contracts.map(entry => {
              const isOpen = expandedContract === entry.contract._id.toString()
              const contractId = entry.contract._id.toString()
              return (
                <div key={contractId} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                  <button className="w-full px-5 py-4 flex items-center gap-4 hover:bg-zinc-50 transition-colors text-left"
                    onClick={() => setExpandedContract(isOpen ? null : contractId)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-900 truncate">
                          {entry.contract.job?.title || 'Untitled Project'}
                        </span>
                        <span className="font-mono text-xs text-zinc-400">#{entry.contract.hashId}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                          entry.contract.status === 'completed' ? 'bg-zinc-900 text-white' :
                          entry.contract.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-zinc-100 text-zinc-500'}`}>
                          {entry.contract.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-zinc-400 flex-wrap">
                        <span>Client: <strong className="text-zinc-600">{entry.contract.client?.name}</strong></span>
                        <span>·</span>
                        <span>Freelancer: <strong className="text-zinc-600">{entry.contract.freelancer?.name}</strong></span>
                        <span>·</span>
                        <span className="text-zinc-900 font-semibold">₹{entry.totalFunded.toLocaleString()} funded</span>
                      </div>
                    </div>
                    <div className="flex gap-3 text-right flex-shrink-0 text-xs">
                      {entry.totalHeld > 0 && <span className="text-amber-600 font-medium">₹{entry.totalHeld.toLocaleString()} held</span>}
                      {entry.totalReleased > 0 && <span className="text-emerald-600 font-medium">₹{entry.totalReleased.toLocaleString()} released</span>}
                      {entry.totalRefunded > 0 && <span className="text-red-500 font-medium">₹{entry.totalRefunded.toLocaleString()} refunded</span>}
                    </div>
                    <svg className={`w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="border-t border-zinc-100">
                      <div className="px-5 py-2 bg-zinc-50 grid grid-cols-5 gap-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        <span className="col-span-2">Phase</span>
                        <span className="text-right">Amount</span>
                        <span className="text-right">Status</span>
                        <span className="text-right">Released At</span>
                      </div>
                      {entry.milestones.map(m => (
                        <div key={m._id} className="px-5 py-2.5 border-t border-zinc-50 grid grid-cols-5 gap-2 items-center">
                          <div className="col-span-2 flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 bg-zinc-100 rounded-full text-[9px] font-bold text-zinc-500 flex items-center justify-center flex-shrink-0">
                              {m.isAdvance ? 'A' : m.milestoneNumber}
                            </span>
                            <span className="text-xs text-zinc-700 truncate">{m.title}</span>
                            {m.isAdvance && (
                              <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 rounded font-medium flex-shrink-0">Advance</span>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-zinc-900 text-right">₹{m.amount.toLocaleString()}</span>
                          <div className="text-right">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${M_STATUS_COLOR[m.status] || 'bg-zinc-100 text-zinc-400'}`}>
                              {m.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 text-right">
                            {m.releasedAt ? new Date(m.releasedAt).toLocaleDateString() : '—'}
                          </span>
                        </div>
                      ))}
                      <div className="px-5 py-2.5 border-t border-zinc-200 bg-zinc-50 grid grid-cols-5 gap-2">
                        <span className="col-span-2 text-xs font-semibold text-zinc-700">Total</span>
                        <span className="text-xs font-bold text-zinc-900 text-right">₹{entry.totalFunded.toLocaleString()}</span>
                        <span className="text-[10px] text-right">
                          <span className="text-amber-600">₹{entry.totalHeld.toLocaleString()} held</span>
                          {entry.totalRefunded > 0 && <span className="text-red-500 ml-1">₹{entry.totalRefunded.toLocaleString()} refunded</span>}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold text-right">₹{entry.totalReleased.toLocaleString()} released</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          }
        </div>
      )}

      {/* ── VIEW: Payouts ── */}
      {view === 'payouts' && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50 grid grid-cols-6 gap-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span className="col-span-2">Freelancer</span>
            <span>Type</span>
            <span>Phase</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Date</span>
          </div>
          {transactions.length === 0
            ? <p className="text-sm text-zinc-400 text-center py-8">No payouts recorded yet</p>
            : transactions.map(tx => (
              <div key={tx._id} className="px-5 py-3 border-b border-zinc-50 grid grid-cols-6 gap-2 items-center hover:bg-zinc-50 transition-colors">
                <div className="col-span-2 flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-[10px] font-bold text-emerald-700 flex-shrink-0">
                    {tx.freelancer?.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-900 truncate">{tx.freelancer?.name}</p>
                    {tx.contract?.hashId && (
                      <p className="text-[10px] text-zinc-400 font-mono">#{tx.contract.hashId}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-zinc-600">{TX_TYPE[tx.type] || tx.type}</span>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-700 truncate">{tx.milestone?.title || '—'}</p>
                  {tx.milestone?.isAdvance && (
                    <span className="text-[9px] bg-amber-50 text-amber-600 px-1 rounded">Advance</span>
                  )}
                </div>
                <span className="text-sm font-bold text-emerald-700 text-right">+₹{tx.amount.toLocaleString()}</span>
                <span className="text-[10px] text-zinc-400 text-right">{new Date(tx.createdAt).toLocaleDateString()}</span>
              </div>
            ))
          }
          {transactions.length > 0 && (
            <div className="px-5 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <span className="text-xs text-zinc-500">{transactions.length} payouts</span>
              <span className="text-sm font-bold text-zinc-900">Total: ₹{summary.totalPayouts.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('verification')
  const [pendingFreelancers, setPendingFreelancers] = useState([])
  const [stats, setStats] = useState(null)
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [splits, setSplits] = useState({})
  const [expandedDispute, setExpandedDispute] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [statsRes, pendingRes, disputesRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/freelancers/pending'),
        api.get('/api/disputes/admin/all')
      ])
      setStats(statsRes.data)
      setPendingFreelancers(pendingRes.data)
      setDisputes(disputesRes.data)
    } catch {
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleVerify = async (userId, status) => {
    setActionLoading(prev => ({ ...prev, [userId]: true }))
    try {
      await api.post(`/api/admin/freelancers/${userId}/verify`, { status })
      toast.success(`Freelancer ${status}`)
      setPendingFreelancers(prev => prev.filter(f => f._id !== userId))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed')
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }))
    }
  }

  const resolveDispute = async (id, resolution, splitPercent) => {
    try {
      await api.patch(`/api/disputes/${id}/resolve`, { resolution, splitPercent })
      toast.success('Dispute resolved!')
      loadData()
    } catch { toast.error('Failed to resolve') }
  }

  const openDisputes = disputes.filter(d => d.status === 'open')

  return (
    <div className="min-h-screen bg-zinc-100">
      <Navbar />

      {expandedDispute && (
        <DisputeDetail
          disputeId={expandedDispute}
          onClose={() => setExpandedDispute(null)}
          onResolved={() => { setExpandedDispute(null); loadData() }}
        />
      )}

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-zinc-900 mb-5">Admin Dashboard</h1>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-2xl font-bold text-zinc-900">{stats.users.total}</div>
              <div className="text-zinc-500 text-sm">Total Users</div>
              <div className="text-xs text-zinc-400 mt-1">{stats.users.freelancers} freelancers · {stats.users.clients} clients</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-2xl font-bold text-zinc-900">{stats.jobs.total}</div>
              <div className="text-zinc-500 text-sm">Total Jobs</div>
              <div className="text-xs text-zinc-400 mt-1">{stats.jobs.open} open · {stats.jobs.inProgress} in progress</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className={`text-2xl font-bold ${stats.disputes.open > 0 ? 'text-red-600' : 'text-zinc-900'}`}>{stats.disputes.open}</div>
              <div className="text-zinc-500 text-sm">Open Disputes</div>
              <div className="text-xs text-zinc-400 mt-1">{stats.disputes.total} total</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-4">
              <div className="text-2xl font-bold text-amber-600">{stats.pendingVerifications}</div>
              <div className="text-zinc-500 text-sm">Pending Verifications</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-zinc-200 mb-5">
          {[
            { key: 'verification', label: `Verification${stats?.pendingVerifications > 0 ? ` (${stats.pendingVerifications})` : ''}` },
            { key: 'disputes', label: `Disputes${openDisputes.length > 0 ? ` (${openDisputes.length})` : ''}` },
            { key: 'payments', label: 'Payments' },
            { key: 'stats', label: 'Stats' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key ? 'text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Verification */}
        {activeTab === 'verification' && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-600 mb-3">Freelancer Verification Requests</h2>
            {loading ? (
              <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" /></div>
            ) : pendingFreelancers.length === 0 ? (
              <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center text-zinc-400 text-sm">No pending verification requests</div>
            ) : (
              <div className="space-y-4">
                {pendingFreelancers.map(f => (
                  <div key={f._id} className="bg-white rounded-xl border border-zinc-200 p-5">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-medium text-zinc-900">{f.name}</div>
                        <div className="text-sm text-zinc-500">{f.email}</div>
                        {f.skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {f.skills.map(s => (
                              <span key={s} className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded border border-zinc-200">{s}</span>
                            ))}
                          </div>
                        )}
                        {f.bio && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{f.bio}</p>}
                        <div className="mt-3 space-y-1 text-sm">
                          {f.linkedin && (
                            <div><span className="font-medium text-zinc-600">LinkedIn:</span>{' '}
                              <a href={f.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{f.linkedin}</a>
                            </div>
                          )}
                          {f.github && (
                            <div><span className="font-medium text-zinc-600">GitHub:</span>{' '}
                              <a href={f.github} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{f.github}</a>
                            </div>
                          )}
                          {f.portfolio && (
                            <div><span className="font-medium text-zinc-600">Portfolio:</span>{' '}
                              <a href={f.portfolio} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{f.portfolio}</a>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 mt-2">
                          Joined: {new Date(f.createdAt).toLocaleDateString()} · Profile {f.completionPercent}% complete
                        </div>
                      </div>
                      <div className="flex gap-2 items-start">
                        <button onClick={() => handleVerify(f._id, 'approved')} disabled={actionLoading[f._id]}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                          Approve
                        </button>
                        <button onClick={() => handleVerify(f._id, 'rejected')} disabled={actionLoading[f._id]}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Disputes */}
        {activeTab === 'disputes' && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-600 mb-3">Open Disputes</h2>
            {loading ? (
              <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-zinc-900 border-t-transparent rounded-full" /></div>
            ) : openDisputes.length === 0 ? (
              <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center text-zinc-400 text-sm">No open disputes</div>
            ) : (
              openDisputes.map(d => (
                <div key={d._id} className="bg-white rounded-xl border border-red-200 p-5 mb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-zinc-900 flex items-center gap-2 flex-wrap">
                        <span className="capitalize">{d.type?.replace(/_/g, ' ')} Dispute</span>
                        {d.contract?.hashId && <span className="text-xs text-zinc-400 font-mono">#{d.contract.hashId}</span>}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-zinc-500 flex-wrap">
                        {d.contract?.client && <span>Client: <strong>{d.contract.client.name}</strong></span>}
                        {d.contract?.freelancer && <span>Freelancer: <strong>{d.contract.freelancer.name}</strong></span>}
                      </div>
                      {d.milestone && <div className="text-sm text-zinc-500 mt-0.5">{d.milestone.title} · ₹{d.milestone.amount?.toLocaleString()}</div>}
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Raised by: <strong>{d.raisedBy?.name}</strong> ({d.raisedBy?.role}) · {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="bg-red-50 text-red-600 text-xs px-2 py-1 rounded-md font-medium">Open</span>
                      <button onClick={() => setExpandedDispute(d._id)}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                        Review All Docs
                      </button>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-3 text-sm text-red-700">
                    <strong>Reason:</strong> {d.reason}
                  </div>

                  {/* Quick evidence preview */}
                  {d.evidence?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-zinc-500 mb-1.5">Evidence ({d.evidence.length} items):</p>
                      <div className="space-y-1">
                        {d.evidence.map((e, i) => (
                          <div key={i} className="text-sm text-zinc-600 bg-zinc-50 rounded-lg p-2 flex items-start gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 capitalize ${e.submittedBy?.role === 'client' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {e.submittedBy?.name || '?'} ({e.submittedBy?.role})
                            </span>
                            <span className="flex-1">{e.description}</span>
                            {e.fileUrl && <FileLink url={e.fileUrl} label="File" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Milestone file quick links */}
                  {d.milestone?.submissionFileUrl && (
                    <div className="mb-3 flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-zinc-500">Submission:</span>
                      <FileLink url={d.milestone.submissionFileUrl} label="Download file" />
                      {d.milestone.submissionVideoUrl && <FileLink url={d.milestone.submissionVideoUrl} label="Watch video" />}
                      <HashBadge hash={d.milestone.submissionFileHash} />
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap items-center pt-2 border-t border-zinc-100">
                    <button onClick={() => resolveDispute(d._id, 'release_to_freelancer')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      Release to Freelancer
                    </button>
                    <button onClick={() => resolveDispute(d._id, 'refund_to_client')}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      Refund to Client
                    </button>
                    <div className="flex items-center gap-2 border-l border-zinc-200 pl-3">
                      <input type="number" min="0" max="100" placeholder="Freelancer %" value={splits[d._id] || ''}
                        onChange={e => setSplits({ ...splits, [d._id]: e.target.value })}
                        className="border border-zinc-200 rounded-lg px-2 py-2 text-sm w-28 focus:outline-none" />
                      <button onClick={() => resolveDispute(d._id, 'split', Number(splits[d._id]))}
                        disabled={!splits[d._id]}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                        Split
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Payments */}
        {activeTab === 'payments' && <PaymentsTab />}

        {/* Tab: Stats */}
        {activeTab === 'stats' && stats && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-600 mb-4">Platform Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['Total Users', stats.users.total],
                ['Freelancers', stats.users.freelancers],
                ['Clients', stats.users.clients],
                ['Total Jobs', stats.jobs.total],
                ['Open Jobs', stats.jobs.open],
                ['In Progress Jobs', stats.jobs.inProgress],
                ['Completed Jobs', stats.jobs.completed],
                ['Total Contracts', stats.contracts.total],
                ['Total Disputes', stats.disputes.total],
                ['Open Disputes', stats.disputes.open],
                ['Pending Verifications', stats.pendingVerifications],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-zinc-50 pb-2">
                  <span className="text-sm text-zinc-600">{label}</span>
                  <span className="text-sm font-bold text-zinc-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
