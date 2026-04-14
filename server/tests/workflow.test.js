/**
 * FreeLock Workflow Integration Test Suite
 * Tests the complete platform workflow end-to-end via HTTP requests.
 *
 * Run with: node server/tests/workflow.test.js
 * (Server must be running on port 5000)
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const BASE = 'http://localhost:5001'
let passed = 0
let failed = 0
const failures = []

// ─────────────────────────── HTTP helpers ───────────────────────────

function request(method, url, body, token, isMultipart) {
  return new Promise((resolve, reject) => {
    const bodyStr = body && !isMultipart ? JSON.stringify(body) : body
    const headers = {
      'Content-Type': isMultipart ? undefined : 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    if (!isMultipart) headers['Content-Length'] = Buffer.byteLength(bodyStr || '')

    const u = new URL(BASE + url)
    const opts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: Object.fromEntries(Object.entries(headers).filter(([, v]) => v != null)),
    }

    const req = http.request(opts, (res) => {
      let raw = ''
      res.on('data', d => raw += d)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }) }
        catch { resolve({ status: res.statusCode, data: raw }) }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

const get = (url, token) => request('GET', url, null, token)
const post = (url, body, token) => request('POST', url, body, token)
const patch = (url, body, token) => request('PATCH', url, body, token)

// ─────────────────────────── Test runner ───────────────────────────

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (err) {
    console.log(`  ✗  ${name}`)
    console.log(`     └─ ${err.message}`)
    failed++
    failures.push({ name, error: err.message })
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}
function assertStatus(res, code) {
  assert(res.status === code, `Expected HTTP ${code}, got ${res.status}: ${JSON.stringify(res.data).substring(0, 150)}`)
}
function assertField(obj, field) {
  assert(obj[field] !== undefined, `Missing field: ${field}`)
}

// ─────────────────────────── State ───────────────────────────

const state = {}

// ─────────────────────────── Suites ───────────────────────────

async function suiteAuth() {
  console.log('\n── Authentication ──')

  await test('Register client', async () => {
    const r = await post('/api/auth/register', {
      name: 'Test Client', email: `client_${Date.now()}@test.com`,
      password: 'Pass1234!', role: 'client'
    })
    assertStatus(r, 201)
    assertField(r.data, 'token')
    state.clientToken = r.data.token
    state.clientUser = r.data.user
  })

  await test('Register freelancer', async () => {
    const r = await post('/api/auth/register', {
      name: 'Test Freelancer', email: `fl_${Date.now()}@test.com`,
      password: 'Pass1234!', role: 'freelancer'
    })
    assertStatus(r, 201)
    state.freelancerToken = r.data.token
    state.freelancerUser = r.data.user
  })

  await test('Login client', async () => {
    const r = await post('/api/auth/login', {
      email: state.clientUser.email, password: 'Pass1234!'
    })
    assertStatus(r, 200)
    assertField(r.data, 'token')
  })

  await test('GET /me returns user', async () => {
    const r = await get('/api/auth/me', state.clientToken)
    assertStatus(r, 200)
    assertField(r.data.user, 'email')
  })

  await test('Invalid credentials rejected', async () => {
    const r = await post('/api/auth/login', { email: 'wrong@x.com', password: 'bad' })
    assert(r.status === 400 || r.status === 401, 'Expected 4xx for bad credentials')
  })
}

async function suitePortfolio() {
  console.log('\n── Portfolio ──')

  await test('Freelancer updates portfolio', async () => {
    const r = await post('/api/portfolio/update', {
      bio: 'Full-stack developer with 5 years experience',
      skills: ['React', 'Node.js', 'MongoDB'],
      hourlyRate: 1500,
      availability: 'full-time',
      githubUrl: 'https://github.com/testfreelancer'
    }, state.freelancerToken)
    assertStatus(r, 200)
    assertField(r.data, 'skills')
  })

  await test('Public portfolio accessible', async () => {
    const r = await get(`/api/portfolio/${state.freelancerUser.id}`, state.clientToken)
    assertStatus(r, 200)
    assertField(r.data, 'skills')
    assert(r.data.skills.includes('React'), 'React skill not in profile')
  })

  await test('Client profile update (companyName)', async () => {
    const r = await post('/api/portfolio/update', {
      companyName: 'Test Corp',
      paymentVerified: true
    }, state.clientToken)
    assertStatus(r, 200)
  })
}

async function suiteJobs() {
  console.log('\n── Jobs ──')

  await test('Client posts a job', async () => {
    const r = await post('/api/jobs', {
      title: 'Build a React Dashboard',
      description: 'We need a beautiful responsive dashboard with charts.',
      budget: 50000,
      deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
      skills: ['React', 'Node.js']
    }, state.clientToken)
    assertStatus(r, 201)
    state.jobId = r.data._id
    assertField(r.data, '_id')
  })

  await test('Job board lists jobs', async () => {
    const r = await get('/api/jobs', state.freelancerToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data), 'Expected array')
    assert(r.data.length > 0, 'No jobs found')
  })

  await test('Job filter by skills', async () => {
    const r = await get('/api/jobs?skills=React', state.freelancerToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
  })

  await test('Get single job', async () => {
    const r = await get(`/api/jobs/${state.jobId}`, state.freelancerToken)
    assertStatus(r, 200)
    assertField(r.data, 'title')
  })

  await test('Freelancer places bid', async () => {
    const r = await post(`/api/jobs/${state.jobId}/bid`, {
      amount: 45000,
      timeline: 20,
      proposal: 'I have extensive React experience and can deliver exactly what you need.'
    }, state.freelancerToken)
    assertStatus(r, 200)
    assert(r.data.bids?.length > 0, 'Bid not saved')
    state.bidId = r.data.bids[r.data.bids.length - 1]._id
  })

  await test('Cannot bid twice on same job', async () => {
    const r = await post(`/api/jobs/${state.jobId}/bid`, {
      amount: 44000, timeline: 18, proposal: 'Second bid attempt'
    }, state.freelancerToken)
    assert(r.status === 400 || r.status === 409, 'Expected 4xx for duplicate bid')
  })
}

async function suiteFreelancerBrowse() {
  console.log('\n── Freelancer Browse (filter-based) ──')

  await test('Browse all freelancers', async () => {
    const r = await get('/api/jobs/freelancers/browse', state.clientToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
  })

  await test('Filter by skills=React', async () => {
    const r = await get('/api/jobs/freelancers/browse?skills=React', state.clientToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
  })

  await test('Filter by availability=full-time', async () => {
    const r = await get('/api/jobs/freelancers/browse?availability=full-time', state.clientToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
  })

  await test('Filter by maxRate', async () => {
    const r = await get('/api/jobs/freelancers/browse?maxRate=2000', state.clientToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
    r.data.forEach(f => assert(!f.hourlyRate || f.hourlyRate <= 2000, 'Rate exceeds filter'))
  })
}

async function suiteDemoRequests() {
  console.log('\n── Demo Requests ──')

  await test('Client sends demo request', async () => {
    const r = await post('/api/demos/request', {
      freelancerId: state.freelancerUser.id,
      message: 'I want to see your React component structure and testing approach',
      proposedAt: new Date(Date.now() + 2 * 86400000).toISOString()
    }, state.clientToken)
    assertStatus(r, 201)
    state.demoId = r.data._id
  })

  await test('Freelancer sees incoming demos', async () => {
    const r = await get('/api/demos/incoming', state.freelancerToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
    assert(r.data.some(d => d._id === state.demoId), 'Demo not found in incoming list')
  })

  await test('Client sees sent demos', async () => {
    const r = await get('/api/demos/my-requests', state.clientToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
  })

  await test('Freelancer accepts demo (meetingRoomId generated)', async () => {
    const r = await patch(`/api/demos/${state.demoId}/accept`, {}, state.freelancerToken)
    assertStatus(r, 200)
    assertField(r.data, 'meetingRoomId')
    assert(r.data.meetingRoomId.startsWith('room-'), 'meetingRoomId format wrong')
    state.meetingRoomId = r.data.meetingRoomId
  })
}

async function suiteNegotiation() {
  console.log('\n── Negotiation System ──')

  await test('Client starts negotiation from bid', async () => {
    const r = await post('/api/negotiations/start', {
      jobId: state.jobId,
      freelancerId: state.freelancerUser.id,
      initialOffer: {
        amount: 40000,
        timeline: 25,
        milestoneCount: 3,
        scope: 'React dashboard with 4 chart widgets and auth system'
      }
    }, state.clientToken)
    assertStatus(r, 201)
    state.negId = r.data._id
    assertField(r.data, 'rounds')
    assert(r.data.rounds.length === 1, 'Should have 1 round after start')
  })

  await test('Negotiation visible to both parties', async () => {
    const r1 = await get(`/api/negotiations/${state.negId}`, state.clientToken)
    const r2 = await get(`/api/negotiations/${state.negId}`, state.freelancerToken)
    assertStatus(r1, 200)
    assertStatus(r2, 200)
  })

  await test('Freelancer sends counter-offer (Round 2)', async () => {
    const r = await post(`/api/negotiations/${state.negId}/respond`, {
      action: 'counter',
      amount: 47000,
      timeline: 22,
      milestoneCount: 3,
      scope: 'React dashboard with 4 chart widgets, auth, and mobile responsive',
      message: 'I need slightly more budget for the extra responsiveness work'
    }, state.freelancerToken)
    assertStatus(r, 200)
  })

  await test('Client accepts — Contract auto-created', async () => {
    const r = await post(`/api/negotiations/${state.negId}/respond`, {
      action: 'accept'
    }, state.clientToken)
    assertStatus(r, 200)
    assertField(r.data, 'contract')
    state.contractId = r.data.contract._id
    state.contract = r.data.contract
    assert(state.contractId, 'No contract ID returned')
  })

  await test('Contract has correct hashId format', async () => {
    const r = await get(`/api/contracts/${state.contractId}`, state.clientToken)
    assertStatus(r, 200)
    assertField(r.data.contract, 'hashId')
    assert(r.data.contract.hashId.length === 16, 'hashId should be 16 chars')
    state.milestones = r.data.milestones
  })

  await test('Milestones auto-generated (advance + phases)', async () => {
    assert(state.milestones.length > 0, 'No milestones created')
    const advance = state.milestones.find(m => m.isAdvance)
    assert(advance, 'No advance milestone found')
    const phaseMs = state.milestones.filter(m => !m.isAdvance)
    assert(phaseMs.length === 3, `Expected 3 phases, got ${phaseMs.length}`)
  })

  await test('Advance milestone is ~10% of total', async () => {
    const advance = state.milestones.find(m => m.isAdvance)
    const total = state.contract.amount || 47000
    const pct = (advance.amount / total) * 100
    assert(pct >= 8 && pct <= 12, `Advance % is ${pct.toFixed(1)}%, expected ~10%`)
  })
}

async function suiteMilestoneWorkflow() {
  console.log('\n── Milestone State Machine ──')

  const advance = state.milestones.find(m => m.isAdvance)
  const phase1 = state.milestones.filter(m => !m.isAdvance).sort((a, b) => a.milestoneNumber - b.milestoneNumber)[0]
  state.advanceId = advance._id
  state.phase1Id = phase1._id

  await test('Client funds advance milestone (Razorpay order)', async () => {
    const r = await post(`/api/milestones/${state.advanceId}/fund`, {
      paymentMethodId: 'pm_card_visa'
    }, state.clientToken)
    assertStatus(r, 200)
    assert(r.data.status === 'funded', `Status: ${r.data.status}`)
  })

  await test('Freelancer starts advance milestone', async () => {
    const r = await post(`/api/milestones/${state.advanceId}/start`, {}, state.freelancerToken)
    assertStatus(r, 200)
    assert(r.data.status === 'in_progress', `Status: ${r.data.status}`)
  })

  await test('Freelancer submits advance work (SHA-256 hash generated)', async () => {
    const r = await post(`/api/milestones/${state.advanceId}/submit`, {
      submissionNote: 'Initial setup and project scaffolding complete'
    }, state.freelancerToken)
    assertStatus(r, 200)
    assert(r.data.status === 'review', `Status: ${r.data.status}`)
    assertField(r.data, 'submissionFileHash')
    state.advanceHash = r.data.submissionFileHash
  })

  await test('SHA-256 hash is valid hex', async () => {
    assert(/^[a-f0-9]{64}$/.test(state.advanceHash), 'Invalid SHA-256 hash format')
  })

  await test('Client approves advance', async () => {
    const r = await post(`/api/milestones/${state.advanceId}/review`, {
      approved: true, note: 'Great start!'
    }, state.clientToken)
    assertStatus(r, 200)
    assert(r.data.status === 'approved', `Status: ${r.data.status}`)
  })

  await test('Client releases advance payment (Razorpay release)', async () => {
    const r = await post(`/api/milestones/${state.advanceId}/release`, {}, state.clientToken)
    assertStatus(r, 200)
    assert(r.data.status === 'released', `Status: ${r.data.status}`)
  })

  // Phase 1 workflow
  await test('Client funds Phase 1', async () => {
    const r = await post(`/api/milestones/${state.phase1Id}/fund`, {
      paymentMethodId: 'pm_card_visa'
    }, state.clientToken)
    assertStatus(r, 200)
  })

  await test('Freelancer starts Phase 1', async () => {
    const r = await post(`/api/milestones/${state.phase1Id}/start`, {}, state.freelancerToken)
    assertStatus(r, 200)
    assert(r.data.status === 'in_progress')
  })

  await test('Freelancer submits Phase 1', async () => {
    const r = await post(`/api/milestones/${state.phase1Id}/submit`, {
      submissionNote: 'Dashboard layout, auth pages, and chart components complete'
    }, state.freelancerToken)
    assertStatus(r, 200)
    assert(r.data.status === 'review')
  })

  await test('Client marks Phase 1 inaccurate (1st rejection)', async () => {
    const r = await post(`/api/milestones/${state.phase1Id}/review`, {
      approved: false,
      inaccuracyNote: 'Charts are missing, only skeleton components present'
    }, state.clientToken)
    assertStatus(r, 200)
    assert(r.data.status === 'inaccurate_1', `Status: ${r.data.status}`)
    assert(r.data.inaccuracyCount === 1, `inaccuracyCount: ${r.data.inaccuracyCount}`)
  })

  await test('Freelancer resubmits Phase 1 after fix', async () => {
    const r = await post(`/api/milestones/${state.phase1Id}/submit`, {
      submissionNote: 'Fixed: Charts now fully implemented with real data'
    }, state.freelancerToken)
    assertStatus(r, 200)
    assert(r.data.status === 'review')
  })

  await test('Client approves Phase 1 on second attempt', async () => {
    const r = await post(`/api/milestones/${state.phase1Id}/review`, {
      approved: true, note: 'Charts look great now!'
    }, state.clientToken)
    assertStatus(r, 200)
    assert(r.data.status === 'approved')
  })

  await test('Client releases Phase 1 payment', async () => {
    const r = await post(`/api/milestones/${state.phase1Id}/release`, {}, state.clientToken)
    assertStatus(r, 200)
    assert(r.data.status === 'released')
  })
}

async function suiteDisputeFlow() {
  console.log('\n── Dispute Flow (2nd rejection = auto-dispute) ──')

  // Set up a fresh milestone in review that will be rejected twice
  const phases = state.milestones.filter(m => !m.isAdvance).sort((a, b) => a.milestoneNumber - b.milestoneNumber)
  const phase2 = phases[1]
  state.phase2Id = phase2._id

  await test('Client funds Phase 2', async () => {
    const r = await post(`/api/milestones/${state.phase2Id}/fund`, { paymentMethodId: 'pm_card_visa' }, state.clientToken)
    assertStatus(r, 200)
  })

  await test('Freelancer starts Phase 2', async () => {
    await post(`/api/milestones/${state.phase2Id}/start`, {}, state.freelancerToken)
  })

  await test('Freelancer submits Phase 2', async () => {
    const r = await post(`/api/milestones/${state.phase2Id}/submit`, {
      submissionNote: 'Phase 2 work done'
    }, state.freelancerToken)
    assertStatus(r, 200)
  })

  await test('First rejection (inaccurate_1)', async () => {
    const r = await post(`/api/milestones/${state.phase2Id}/review`, {
      approved: false, inaccuracyNote: 'Missing mobile responsiveness'
    }, state.clientToken)
    assertStatus(r, 200)
    assert(r.data.status === 'inaccurate_1')
  })

  await test('Freelancer resubmits', async () => {
    await post(`/api/milestones/${state.phase2Id}/submit`, {
      submissionNote: 'Added mobile CSS'
    }, state.freelancerToken)
  })

  await test('Second rejection auto-creates dispute (inaccurate_2 → disputed)', async () => {
    const r = await post(`/api/milestones/${state.phase2Id}/review`, {
      approved: false, inaccuracyNote: 'Still not responsive on iPhone'
    }, state.clientToken)
    assertStatus(r, 200)
    assert(r.data.status === 'disputed', `Status: ${r.data.status}`)
    assert(r.data.inaccuracyCount === 2, `inaccuracyCount: ${r.data.inaccuracyCount}`)
  })

  await test('Dispute record created', async () => {
    const r = await get(`/api/disputes/contract/${state.contractId}`, state.clientToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data) && r.data.length > 0, 'No dispute found')
    state.disputeId = r.data[r.data.length - 1]._id
  })

  await test('Parties can add evidence', async () => {
    const r = await post(`/api/disputes/${state.disputeId}/evidence`, {
      description: 'Attached screenshot showing the layout was correctly implemented on mobile'
    }, state.freelancerToken)
    assertStatus(r, 200)
  })
}

async function suiteAdminDisputeResolution() {
  console.log('\n── Admin Dispute Resolution ──')

  // Login as admin (seed creates admin@freelock.com / Admin@123)
  await test('Admin login', async () => {
    const r = await post('/api/auth/login', {
      email: 'admin@test.com', password: 'Test@123'
    })
    assertStatus(r, 200)
    state.adminToken = r.data.token
  })

  await test('Admin sees all disputes', async () => {
    const r = await get('/api/disputes/admin/all', state.adminToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
  })

  await test('Admin resolves with split (60% freelancer)', async () => {
    const r = await patch(`/api/disputes/${state.disputeId}/resolve`, {
      resolution: 'split',
      splitPercent: 60
    }, state.adminToken)
    assertStatus(r, 200)
    assert(r.data.status === 'resolved', `Status: ${r.data.status}`)
    assert(r.data.resolution === 'split')
    assert(r.data.splitPercent === 60)
  })
}

async function suiteHashVerification() {
  console.log('\n── SHA-256 Hash Verification ──')

  await test('Valid hash verifies correctly', async () => {
    if (!state.advanceHash) return
    const r = await post('/api/files/verify-hash', { fileHash: state.advanceHash })
    assertStatus(r, 200)
    assert(r.data.verified === true, 'Hash should verify as true')
    assertField(r.data, 'milestoneTitle')
    assertField(r.data, 'client')
    assertField(r.data, 'freelancer')
  })

  await test('Invalid hash returns not verified', async () => {
    const fakeHash = 'a'.repeat(64)
    const r = await post('/api/files/verify-hash', { fileHash: fakeHash })
    assertStatus(r, 200)
    assert(r.data.verified === false, 'Fake hash should not verify')
  })

  await test('Certificate PDF endpoint returns 200', async () => {
    if (!state.advanceHash) return
    // Just check endpoint exists (can't easily parse PDF in test)
    const r = await new Promise((res) => {
      const req = http.request(`${BASE}/api/files/certificate/${state.advanceHash}`, { method: 'GET' }, (response) => {
        res({ status: response.statusCode, contentType: response.headers['content-type'] })
        response.resume()
      })
      req.on('error', () => res({ status: 0 }))
      req.end()
    })
    assert(r.status === 200, `PDF endpoint returned ${r.status}`)
    assert(r.contentType?.includes('pdf'), `Expected PDF content-type, got ${r.contentType}`)
  })
}

async function suiteRatings() {
  console.log('\n── Ratings & Reviews ──')

  await test('Client rates freelancer after work', async () => {
    const r = await post('/api/ratings/submit', {
      contractId: state.contractId,
      ratedUserId: state.freelancerUser.id,
      stars: 4,
      communication: 4,
      quality: 5,
      timeliness: 4,
      professionalism: 5,
      comment: 'Great developer, delivered quality work!'
    }, state.clientToken)
    assertStatus(r, 201)
  })

  await test('Freelancer rates client', async () => {
    const r = await post('/api/ratings/submit', {
      contractId: state.contractId,
      ratedUserId: state.clientUser.id,
      stars: 5,
      communication: 5,
      quality: 4,
      timeliness: 5,
      professionalism: 5,
      comment: 'Clear requirements and prompt payment!'
    }, state.freelancerToken)
    assertStatus(r, 201)
  })

  await test('Ratings visible on public profile', async () => {
    const r = await get(`/api/ratings/user/${state.freelancerUser.id}`)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
    assert(r.data.length > 0, 'No ratings found on profile')
  })

  await test('Rolling average updated on User document', async () => {
    const r = await get('/api/auth/me', state.freelancerToken)
    assertStatus(r, 200)
    assert(r.data.user.rating > 0, 'Freelancer rating should be > 0 after review')
  })
}

async function suiteWithdrawal() {
  console.log('\n── Contract Withdrawal (50% rule) ──')

  // Create a brand new contract for withdrawal testing
  await test('Setup: new negotiation + contract for withdrawal test', async () => {
    const jobR = await post('/api/jobs', {
      title: 'Withdrawal Test Job',
      description: 'Test job for withdrawal flow',
      budget: 10000,
      deadline: new Date(Date.now() + 60 * 86400000).toISOString(),
      skills: ['React']
    }, state.clientToken)
    assertStatus(jobR, 201)
    const jId = jobR.data._id

    const negR = await post('/api/negotiations/start', {
      jobId: jId,
      freelancerId: state.freelancerUser.id,
      initialOffer: { amount: 10000, timeline: 30, milestoneCount: 3, scope: 'Test' }
    }, state.clientToken)
    assertStatus(negR, 201)
    const nId = negR.data._id

    const accR = await post(`/api/negotiations/${nId}/respond`, { action: 'accept' }, state.freelancerToken)
    assertStatus(accR, 200)
    state.withdrawContractId = accR.data.contract._id
    state.withdrawMilestones = accR.data.milestones || []
  })

  await test('Withdrawal allowed when <50% complete', async () => {
    const r = await post(`/api/contracts/${state.withdrawContractId}/withdraw`, {}, state.clientToken)
    assertStatus(r, 200)
    assert(r.data.allowed === true, 'Withdrawal should be allowed with 0% complete')
  })
}

async function suiteMessages() {
  console.log('\n── Messages ──')

  await test('GET messages for contract returns array', async () => {
    const r = await get(`/api/messages/${state.contractId}`, state.clientToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
  })

  await test('Mark messages as read', async () => {
    const r = await post(`/api/messages/mark-read/${state.contractId}`, {}, state.clientToken)
    assertStatus(r, 200)
  })
}

async function suiteContracts() {
  console.log('\n── Contracts ──')

  await test('Client sees their contracts', async () => {
    const r = await get('/api/contracts/my-contracts', state.clientToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
    assert(r.data.some(c => c._id === state.contractId), 'Contract not found in list')
  })

  await test('Freelancer sees their work contracts', async () => {
    const r = await get('/api/contracts/my-work', state.freelancerToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
    assert(r.data.some(c => c._id === state.contractId), 'Contract not in freelancer work list')
  })

  await test('Contract detail includes milestones', async () => {
    const r = await get(`/api/contracts/${state.contractId}`, state.clientToken)
    assertStatus(r, 200)
    assertField(r.data, 'contract')
    assertField(r.data, 'milestones')
    assert(Array.isArray(r.data.milestones))
  })
}

async function suiteNegotiationEdgeCases() {
  console.log('\n── Negotiation Edge Cases ──')

  await test('Negotiation list for client', async () => {
    const r = await get('/api/negotiations/my-negotiations', state.clientToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
  })

  await test('Negotiation list for freelancer', async () => {
    const r = await get('/api/negotiations/my-negotiations', state.freelancerToken)
    assertStatus(r, 200)
    assert(Array.isArray(r.data))
  })
}

// ─────────────────────────── Main ───────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════╗')
  console.log('║   FreeLock Workflow Integration Tests  ║')
  console.log('╚════════════════════════════════════════╝')
  console.log(`\nTarget: ${BASE}`)
  console.log('Note: Server must be running and seeded.\n')

  // Check server is up
  try {
    await get('/api/auth/me')
  } catch (err) {
    console.error(`\n✗ Cannot reach server at ${BASE}`)
    console.error('  Start the server: cd server && node index.js\n')
    process.exit(1)
  }

  await suiteAuth()
  await suitePortfolio()
  await suiteJobs()
  await suiteFreelancerBrowse()
  await suiteDemoRequests()
  await suiteNegotiation()
  await suiteMilestoneWorkflow()
  await suiteDisputeFlow()
  await suiteAdminDisputeResolution()
  await suiteHashVerification()
  await suiteRatings()
  await suiteWithdrawal()
  await suiteMessages()
  await suiteContracts()
  await suiteNegotiationEdgeCases()

  // ── Summary ──
  const total = passed + failed
  console.log('\n╔════════════════════════════════════════╗')
  console.log(`║  Results: ${passed}/${total} passed                   `)
  console.log('╚════════════════════════════════════════╝')

  if (failures.length > 0) {
    console.log('\nFailed tests:')
    failures.forEach(f => console.log(`  ✗ ${f.name}\n    ${f.error}`))
  }

  if (failed === 0) {
    console.log('\n All tests passed! FreeLock workflow is working correctly.')
  } else {
    console.log(`\n ${failed} test(s) failed. Check server logs for details.`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
