# FreeLock — Claude Code Context

## Project Overview
MERN stack freelancing escrow platform. Solves payment fraud via SHA-256 proof of delivery, milestone-based escrow, and cryptographic delivery certificates.

**Running**: Server → `cd server && node index.js` (port 5001 via `.env PORT=5001`, fallback 5000) | Client → `cd client && npm run dev` (port 5173)
**Dev mode**: Server → `cd server && npx nodemon index.js` | uses `nodemon.json` watch config

## Architecture

```
freelock/
├── server/                    # Express + MongoDB backend
│   ├── models/                # 10 Mongoose models (see below)
│   ├── routes/                # 11 route files, all mounted at /api/*
│   ├── middleware/auth.js     # JWT verify → req.user
│   ├── services/stateMachine.js  # Milestone state transitions
│   ├── seed.js                # Creates demo data (run once)
│   ├── tests/workflow.test.js # Full integration test suite
│   └── index.js               # Express + Socket.io + node-cron
└── client/                    # React 18 + Vite + Tailwind
    └── src/
        ├── api/index.js       # Axios instance — auto-attaches JWT Bearer token
        ├── components/        # Navbar, ProtectedRoute
        ├── pages/             # 15 page components
        └── App.jsx            # React Router v6 with role guards
```

## Models (server/models/)

| File | Key fields |
|------|-----------|
| User.js | name, email, password (bcrypt), role (client/freelancer/admin), rating, totalJobsCompleted, onTimeDeliveryRate, disputeRate |
| Portfolio.js | user (ref), skills[], hourlyRate, availability, bio, githubUrl, projectSamples[{title,fileHash,url}], companyName, paymentVerified |
| Job.js | title, description, budget, deadline, skills[], status (open/closed/in_progress/completed), bids[] subdoc |
| DemoRequest.js | client, freelancer, message, proposedAt, status (pending/accepted/rejected/completed/expired), meetingRoomId, meetingAt, rejectionReason, convertedToJob, jobId |
| Negotiation.js | job, client, freelancer, rounds[] (roundNumber, amount, timeline, milestoneCount, scope, message, status, proposedByRole), currentRound, maxRounds:4, status (active/agreed/rejected/expired), agreedAmount/agreedTimeline/agreedMilestoneCount/agreedScope |
| Contract.js | hashId (auto SHA-256 16-char uppercase), job, client, freelancer, amount, milestoneCount, status (active/completed/withdrawn/disputed) |
| Milestone.js | contract, milestoneNumber, title, description, amount, status (11 values), isAdvance, inaccuracyCount (0/1/2), submissionFileHash, inaccuracyNote, autoReleaseAt, deadline |
| Dispute.js | contract, milestone, raisedBy, reason, type (milestone/manual/withdrawal), evidence[], status (open/resolved), resolution (release_to_freelancer/refund_to_client/split), splitPercent |
| Rating.js | contract, milestone, ratedBy, ratedUser, role (client_rating_freelancer/freelancer_rating_client), stars, review, communication, quality, timeliness, professionalism, isVisible |
| Message.js | contract, sender, senderName, senderRole (client/freelancer/admin), text, type (text/system/meeting_request/file), meetingData{scheduledAt,agenda,status}, readBy[] |

## Milestone State Machine

```
pending_deposit → funded → in_progress → submitted → review
                                                        ├── approved → released
                                                        ├── inaccurate_1 → submitted (retry)
                                                        │       └── inaccurate_2 → disputed → released | refunded
                                                        └── released (auto after 3 days: autoReleaseAt)
```

**Trigger logic** (routes/milestones.js handles side effects; stateMachine.js handles state transitions):
- `fund` — Razorpay `orders.create({ amount: milestone.amount*100, currency: 'INR' })`; test mode generates mock `order_test_*` id
- `start` — state: funded → in_progress (freelancer only)
- `submit` — stores SHA-256 hash in `submissionFileHash`; does **two sequential transitions**: submitted → review (both in one request)
- `review + approved` — state → approved; client must separately call `/release` to capture payment
- `review + rejected` — inaccuracyCount++; 1st rejection: state → inaccurate_1, extends deadline 7 days (resubmit allowed); 2nd rejection: state → inaccurate_2 → disputed, auto-creates Dispute doc
- `release` — state → released; if milestoneNumber===1, also releases the advance milestone (milestoneNumber===0, isAdvance=true)
- `refund` — via Razorpay `payments.refund()` (used in withdrawal & dispute resolution flow)

## API Routes Quick Reference

```
POST   /api/auth/register              body: { name, email, password, role }
POST   /api/auth/login                 body: { email, password }
GET    /api/auth/me                    → current user

GET    /api/portfolio/:userId          → public profile
POST   /api/portfolio/update           → upsert own portfolio
POST   /api/portfolio/upload-sample    multipart, → { fileHash }

GET    /api/jobs                       ?search, ?skills, ?minBudget, ?maxBudget
POST   /api/jobs                       create job (client)
GET    /api/jobs/:id
POST   /api/jobs/:id/bid               body: { amount, timeline, proposal }
PATCH  /api/jobs/:id/accept/:bidId     → client accepts bid, job status → in_progress
GET    /api/jobs/freelancers/browse    ?skills, ?minRating, ?availability, ?maxRate

POST   /api/demos/request              body: { freelancerId, message, proposedAt }
GET    /api/demos/my-requests
GET    /api/demos/incoming
PATCH  /api/demos/:id/accept           → generates meetingRoomId
PATCH  /api/demos/:id/reject
PATCH  /api/demos/:id/complete

POST   /api/negotiations/start         body: { jobId, freelancerId, initialOffer:{amount,timeline,milestoneCount,scope} }
GET    /api/negotiations/my-negotiations
GET    /api/negotiations/:id
POST   /api/negotiations/:id/respond   body: { action: accept|reject|counter, ...counterFields }
  → on accept: auto-creates Contract + Milestones (10% advance + equal phase split)

GET    /api/contracts/my-contracts
GET    /api/contracts/my-work
GET    /api/contracts/:id              → { contract, milestones[] }
POST   /api/contracts/:id/withdraw     → { allowed: bool, message }

GET    /api/milestones/contract/:contractId
GET    /api/milestones/:id
POST   /api/milestones/:id/fund        → creates Razorpay order; test mode uses mock orderId
POST   /api/milestones/:id/start
POST   /api/milestones/:id/submit      multipart: file + submissionNote (transitions submitted→review in one call)
POST   /api/milestones/:id/review      body: { approved: bool, note?, inaccuracyNote?, newDeadline? }
POST   /api/milestones/:id/release
POST   /api/milestones/:id/schedule-meeting  body: { scheduledAt }

POST   /api/files/upload               multipart → { fileHash, url }
POST   /api/files/verify-hash          body: { fileHash } → { verified, client, freelancer, milestoneTitle, amount, status, submittedAt }
GET    /api/files/certificate/:hash    → PDF (pdfkit)

POST   /api/disputes/raise             body: { contractId, milestoneId, reason }
POST   /api/disputes/:id/evidence      body: { description }
PATCH  /api/disputes/:id/resolve       body: { resolution, splitPercent? } (admin only)
GET    /api/disputes/admin/all         (admin only)
GET    /api/disputes/contract/:contractId

POST   /api/ratings/submit             body: { contractId, ratedUserId, stars, communication, quality, timeliness, professionalism, review }
GET    /api/ratings/user/:userId
GET    /api/ratings/contract/:contractId

GET    /api/messages/:contractId
POST   /api/messages/mark-read/:contractId

GET    /api/health                     → { status: 'ok', time }
```

## Frontend Routes (client/src/App.jsx)

| Path | Component | Guard |
|------|-----------|-------|
| /login | Login | public |
| /register | Register | public |
| /verify/:hash | VerifyHash | public |
| / | DashboardRedirect | auth |
| /profile/setup | ProfileSetup | auth |
| /dashboard/client | ClientDashboard | client |
| /dashboard/freelancer | FreelancerDashboard | freelancer |
| /jobs | JobBoard | auth |
| /jobs/post | PostJob | client |
| /jobs/:id | JobDetail | auth |
| /freelancers | FreelancerBrowse | client |
| /freelancers/:userId | FreelancerProfile | auth |
| /contracts/:id | ContractDashboard | auth |
| /negotiations/:id | NegotiationRoom | auth |
| /chat/:contractId | ChatRoom | auth |
| /admin | AdminDashboard | admin |

## Socket.io Events (server/index.js)

Client emits → Server handles → Server broadcasts:
- `join-room(contractId)` — joins socket room
- `send-message({contractId, senderId, senderName, senderRole, text, type, meetingData?})` → saves Message doc (field: `text`, not `content`) → emits `receive-message`
- `typing({contractId, name})` → emits `user-typing` to room
- `stop-typing({contractId})` → emits `user-stop-typing`
- `request-meeting({contractId, ...data})` → emits `meeting-requested`
- `respond-meeting({contractId, ...data})` → emits `meeting-response`
- `call-user({contractId, signal, from})` → emits `incoming-call` to room
- `accept-call({contractId, signal})` → emits `call-accepted`
- `end-call({contractId})` → emits `call-ended`

## Key Business Rules
1. **Advance payment**: 10% of total, released only when Phase 1 is approved+released
2. **Inaccuracy auto-dispute**: 2 rejections on same milestone → auto `Dispute` doc + milestone status = `disputed`
3. **Withdrawal**: `completionRatio = (released + in_progress*0.5) / total` — if ≤0.5, free refund; else must pay
4. **Auto-release**: `node-cron` hourly job (`0 * * * *`) marks `released` for milestones in `review` status where `autoReleaseAt <= now` (set 72 hrs after submission)
5. **SHA-256 hash**: Every file submission gets `crypto.createHash('sha256').update(fileBuffer).digest('hex')`
6. **Contract hashId**: `crypto.createHash('sha256').update(_id + Date.now()).digest('hex').substring(0,16).toUpperCase()`
7. **Rolling rating**: `(oldRating × totalJobs + newStars) / (totalJobs + 1)`
8. **Filter search (NOT AI)**: MongoDB `$in` for skills, `$gte/$lte` for rating/rate, sorted by `rating: -1`

## Auth Flow
- JWT stored in `localStorage` as `token`, user object as `user`  
- Axios interceptor in `client/src/api/index.js` auto-attaches `Authorization: Bearer <token>`
- 401 response → clears localStorage → redirects to `/login`
- `ProtectedRoute` checks `token` + optionally `user.role` matches required role

## Seed Data (node seed.js)
Creates: admin@freelock.com / Admin@123, client@test.com / Pass123!, freelancer@test.com / Pass123!
Plus: portfolios, 1 job, 1 negotiation (agreed), 1 contract, 4 milestones (advance released, Phase1 released, Phase2 in review, Phase3 pending)

## Test Suite
`node server/tests/workflow.test.js` — 50+ HTTP integration tests, no external deps, requires server running on :5001

## Common Gotchas (read before making changes)

### Payment — Razorpay, not Stripe
The codebase uses **Razorpay** (not Stripe). Key differences:
- Razorpay captures payment at checkout time (no separate capture call needed)
- Payout to freelancer on release is done via **Razorpay Payouts** (manual/external — not implemented in this codebase yet)
- Refunds use `razorpay.payments.refund(paymentId)` 
- Test mode: if `RAZORPAY_KEY_ID` is missing or contains `'placeholder'`, all payment calls are skipped and mock IDs are used

### Milestone submit = two state transitions
`POST /api/milestones/:id/submit` transitions `in_progress → submitted → review` in one request. The `review` state is what the client sees and acts on — do not confuse `submitted` (intermediate) with the final delivery state.

### Message field is `text`, not `content`
`Message.text` is the field name in the schema and Socket.io payload. Never use `content`.

### Advance milestone unlock
The advance (milestoneNumber=0, isAdvance=true) is NOT released when approved — it stays `approved` until Phase 1 (milestoneNumber=1) is released. The release logic in `milestones.js` handles this automatically.

### Role checks in routes
Every route that modifies data checks `req.user.role` or compares `milestone.client/freelancer.toString()` to `req.user.id`. Do not skip these when adding new endpoints.

### Adding a new route
1. Create handler in the relevant `server/routes/*.js` file
2. Guard with `auth` middleware
3. Add role check where needed (`req.user.role !== 'client'`)
4. Mount is already done in `server/index.js` — no changes needed for existing route files
5. Add the endpoint to the API Routes section above
