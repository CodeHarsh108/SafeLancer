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
        ├── pages/             # 16 page components
        └── App.jsx            # React Router v6 with role guards
```

## Models (server/models/)

| File | Key fields |
|------|-----------|
| User.js | name, email, password (bcrypt), role (client/freelancer/admin), rating, totalJobsCompleted, onTimeDeliveryRate, disputeRate, isBanned, banReason, penaltyDue, penaltyCount |
| Portfolio.js | user (ref), skills[], hourlyRate, availability, bio, githubUrl, projectSamples[{title,fileHash,url}], companyName, paymentVerified |
| Job.js | title, description, budget, deadline, skills[], status (open/in_progress/completed/cancelled), bids[] subdoc |
| DemoRequest.js | client, freelancer, message, proposedAt, status (pending/accepted/rejected/completed/expired), meetingRoomId, meetingAt, rejectionReason, convertedToJob, jobId |
| Negotiation.js | job, client, freelancer, rounds[] (roundNumber, amount, timeline, milestoneCount, scope, message, status, proposedByRole), currentRound, maxRounds:4, status (active/agreed/rejected/expired), agreedAmount/agreedTimeline/agreedMilestoneCount/agreedScope |
| Contract.js | hashId (auto SHA-256 16-char uppercase), job, client, freelancer, amount, milestoneCount, status (active/completed/withdrawn/disputed) |
| Milestone.js | contract, milestoneNumber, title, description, amount, status (11 values), isAdvance, inaccuracyCount, maxRevisions (from job phase), submissionFileHash, submissionVideoHash, inaccuracyNote, autoReleaseAt, paymentDueAt (48h after approved), deadlineExtensions[], clientPaymentPenaltyApplied, submissionPenaltyApplied, deadline |
| Dispute.js | contract, milestone, raisedBy, reason, type (milestone/manual/withdrawal/deadline_breach/payment_default/freelancer_exit), evidence[], status (open/resolved), resolution (release_to_freelancer/refund_to_client/split), splitPercent, evidenceSummary (auto-compiled: submissionHashes, videoHashes, deadlineExtensionCount, inaccuracyNotes) |
| Rating.js | contract, milestone, ratedBy, ratedUser, role (client_rating_freelancer/freelancer_rating_client), stars, review, communication, quality, timeliness, professionalism, isVisible |
| Message.js | contract, sender, senderName, senderRole (client/freelancer/admin), text, type (text/system/meeting_request/file), meetingData{scheduledAt,agenda,status}, readBy[] |

### Job.bidSchema (subdocument inside Job.bids[])

Freelancers no longer propose a price — budget is fixed on the job. The bid tracks the hiring pipeline:

| Field | Type | Notes |
|-------|------|-------|
| freelancer | ObjectId ref User | required |
| proposal | String | required — cover letter only, no amount |
| status | String enum | applied → shortlisted → interview_scheduled → interviewed → negotiating \| hired \| rejected |
| appliedAt | Date | default: now |
| shortlistedAt | Date | set on shortlist action |
| interviewScheduledAt | Date | set on schedule-interview action |
| meetingRoomId | String | `'interview-' + crypto.randomUUID()`, set on schedule |
| interviewDoneAt | Date | set on interview-done action |
| rejectionReason | String | optional, set on reject action |
| hiredAt | Date | set on hire action |

## Hiring Pipeline (new flow)

```
freelancer applies (proposal only)
  → client shortlists
    → client schedules interview (meetingRoomId generated)
      → both join /interview/:meetingRoomId (WebRTC)
        → client marks interview done
          ├── hire directly   → Contract created at job.budget, milestones auto-generated, job → in_progress
          ├── start negotiation → Negotiation created at job.budget as starting point
          └── reject          → bid.status = rejected
```

**Status transition guards** (server/routes/jobs.js):
- `shortlist` — requires bid.status === `applied`
- `schedule-interview` — requires bid.status === `shortlisted`
- `interview-done` — requires bid.status === `interview_scheduled`
- `hire` / `negotiate` — requires bid.status === `interviewed`

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
GET    /api/jobs/my-jobs               → client's posted jobs (bids.freelancer populated)
GET    /api/jobs/my-applications       → freelancer's applications + contractId/negotiationId if hired/negotiating
GET    /api/jobs/:id                   → job + bids.freelancer populated
POST   /api/jobs/:id/apply             body: { proposal } — freelancer applies (no amount)
GET    /api/jobs/:id/applications      → { job, applications[] } with portfolio data (client only)
PATCH  /api/jobs/:id/applications/:bidId/shortlist          — client shortlists (applied → shortlisted)
PATCH  /api/jobs/:id/applications/:bidId/schedule-interview body: { scheduledAt } → sets meetingRoomId
PATCH  /api/jobs/:id/applications/:bidId/interview-done     — marks interview complete
PATCH  /api/jobs/:id/applications/:bidId/hire               → Contract at job.budget + auto milestones + job in_progress
PATCH  /api/jobs/:id/applications/:bidId/negotiate          → Negotiation at job.budget + returns { negotiationId }
PATCH  /api/jobs/:id/applications/:bidId/reject             body: { reason? }
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
| /interview/:meetingRoomId | InterviewRoom | auth |
| /admin | AdminDashboard | admin |

## Socket.io Events (server/index.js)

Client emits → Server handles → Server broadcasts:
- `join-room(contractId)` — joins socket room for contract chat
- `send-message({contractId, senderId, senderName, senderRole, text, type, meetingData?})` → saves Message doc → emits `receive-message`
- `typing({contractId, name})` → emits `user-typing` to room
- `stop-typing({contractId})` → emits `user-stop-typing`
- `request-meeting({contractId, ...data})` → emits `meeting-requested`
- `respond-meeting({contractId, ...data})` → emits `meeting-response`
- `call-user({contractId, signal, from})` → emits `incoming-call` to room
- `accept-call({contractId, signal})` → emits `call-accepted`
- `end-call({contractId})` → emits `call-ended`
- `join-interview(meetingRoomId)` — joins interview socket room (pre-contract)
- `send-interview-message({roomId, senderId, senderName, senderRole, text})` → emits `receive-message` to room (NOT saved to DB — ephemeral)

**Note**: Interview rooms use `meetingRoomId` as the room identifier. `call-user`, `accept-call`, `end-call` reuse the same handlers — InterviewRoom passes `meetingRoomId` as the `contractId` field in those payloads.

## Key Business Rules
1. **Advance payment**: 10% of total, released only when Phase 1 is approved+released
2. **Inaccuracy auto-dispute**: 2 rejections on same milestone → auto `Dispute` doc + milestone status = `disputed`
3. **Withdrawal**: `completionRatio = (released + in_progress*0.5) / total` — if ≤0.5, free refund; else must pay
4. **Auto-release**: `node-cron` hourly job (`0 * * * *`) marks `released` for milestones in `review` status where `autoReleaseAt <= now` (set 72 hrs after submission)
5. **SHA-256 hash**: Every file submission gets `crypto.createHash('sha256').update(fileBuffer).digest('hex')`
6. **Contract hashId**: `crypto.createHash('sha256').update(_id + Date.now()).digest('hex').substring(0,16).toUpperCase()`
7. **Rolling rating**: `(oldRating × totalJobs + newStars) / (totalJobs + 1)`
8. **Filter search (NOT AI)**: MongoDB `$in` for skills, `$gte/$lte` for rating/rate, sorted by `rating: -1`
9. **Direct hire**: `/hire` route creates Contract at `job.budget`, milestoneCount=3, timeline=30 days, rejects all other applicants, sets `job.status = in_progress`
10. **Negotiate from pipeline**: `/negotiate` route creates Negotiation with `initialOffer.amount = job.budget` as the client's starting point

## Auth Flow
- JWT stored in `localStorage` as `token`, user object as `user`
- Auth response shape: `{ token, user: { id, name, email, role, rating } }` — stored user has `id` (string), NOT `_id`
- Axios interceptor in `client/src/api/index.js` auto-attaches `Authorization: Bearer <token>`
- 401 response → clears localStorage → redirects to `/login`
- `ProtectedRoute` checks `token` + optionally `user.role` matches required role

## Database State

Clean — no demo data. Real users register via `/register`.

**Reset** (`node reset.js` from server/): clears all collections, creates admin only.
- Admin: `admin@freelock.in` / `Admin@123`

**Old seed** (`node seed.js`): still exists but not used. Creates demo users + pre-built contracts for demo purposes only.

## Test Suite
`node server/tests/workflow.test.js` — 60+ HTTP integration tests, no external deps, requires server running on :5001

Covers: auth, portfolio, jobs (apply → shortlist → schedule → interview-done → hire), freelancer browse, demo requests, negotiations, milestone state machine, dispute flow, admin resolution, SHA-256 verification, ratings, withdrawal, messages, contracts.

## Common Gotchas (read before making changes)

### No amount in bids — budget is on the job
Freelancers no longer propose a price. `bidSchema` has no `amount` field. The budget is `job.budget`. All contract creation (hire route and negotiate→accept flow) uses `job.budget` as the contract amount. Never add `amount` back to bid submissions.

### Payment — Razorpay, not Stripe
The codebase uses **Razorpay** (not Stripe). Key differences:
- Razorpay captures payment at checkout time (no separate capture call needed)
- Payout to freelancer on release is done via **Razorpay Payouts** (manual/external — not implemented yet)
- Refunds use `razorpay.payments.refund(paymentId)`
- Test mode: if `RAZORPAY_KEY_ID` is missing or contains `'placeholder'`, all payment calls are skipped and mock IDs are used

### Milestone submit = two state transitions
`POST /api/milestones/:id/submit` transitions `in_progress → submitted → review` in one request. The `review` state is what the client sees and acts on — do not confuse `submitted` (intermediate) with the final delivery state.

### Message field is `text`, not `content`
`Message.text` is the field name in the schema and Socket.io payload. Never use `content`.

### Interview messages are ephemeral
`send-interview-message` is NOT saved to MongoDB — it broadcasts directly via Socket.io. There is no `GET /api/messages/:meetingRoomId` equivalent. Chat history is lost when both parties leave the room. This is intentional (pre-contract context).

### Advance milestone unlock
The advance (milestoneNumber=0, isAdvance=true) is NOT released when approved — it stays `approved` until Phase 1 (milestoneNumber=1) is released. The release logic in `milestones.js` handles this automatically.

### user.id vs user._id
The stored localStorage user object has `id` (string), not `_id`. The auth route returns `{ user: { id: user._id, ... } }`. Always use `user.id` in frontend code. Using `user._id` will be `undefined`.

### Route ordering in jobs.js
Named routes (`/my-jobs`, `/my-applications`, `/freelancers/browse`) must be defined **before** `/:id` to avoid Express matching them as job IDs. Current order is correct — do not move `/:id` above named routes.

### Role checks in routes
Every route that modifies data checks `req.user.role` or compares `milestone.client/freelancer.toString()` to `req.user.id`. Do not skip these when adding new endpoints.

### Adding a new route
1. Create handler in the relevant `server/routes/*.js` file
2. Guard with `auth` middleware
3. Add role check where needed (`req.user.role !== 'client'`)
4. Mount is already done in `server/index.js` — no changes needed for existing route files
5. Add the endpoint to the API Routes section above
