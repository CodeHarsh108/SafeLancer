require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('./models/User');
const Portfolio = require('./models/Portfolio');
const Job = require('./models/Job');
const Negotiation = require('./models/Negotiation');
const Contract = require('./models/Contract');
const Milestone = require('./models/Milestone');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Portfolio.deleteMany({}),
    Job.deleteMany({}),
    Negotiation.deleteMany({}),
    Contract.deleteMany({}),
    Milestone.deleteMany({})
  ]);
  console.log('Cleared existing data');

  // ─── Users ───────────────────────────────────────────────────────────────

  const admin = new User({
    name: 'Admin User', email: 'admin@test.com', password: 'Test@123',
    role: 'admin', rating: 5
  });
  const client = new User({
    name: 'Alex Johnson', email: 'client@test.com', password: 'Test@123',
    role: 'client', rating: 4.6, totalJobsCompleted: 8
  });
  const sam = new User({
    name: 'Sam Developer', email: 'freelancer@test.com', password: 'Test@123',
    role: 'freelancer', rating: 4.8, totalJobsCompleted: 23
  });
  const priya = new User({
    name: 'Priya Designer', email: 'freelancer2@test.com', password: 'Test@123',
    role: 'freelancer', rating: 4.5, totalJobsCompleted: 11
  });
  await Promise.all([admin.save(), client.save(), sam.save(), priya.save()]);
  console.log('Users created');

  // ─── Portfolios ──────────────────────────────────────────────────────────

  await Portfolio.create([
    {
      user: admin._id, role: 'client',
      bio: 'Platform Admin',
      completionPercent: 40
    },
    {
      user: client._id, role: 'client',
      bio: 'We build fintech and e-commerce products.',
      companyName: 'TechStart Ltd',
      industry: 'Technology',
      linkedinUrl: 'https://linkedin.com/company/techstart',
      paymentVerified: true,
      completionPercent: 100
    },
    {
      user: sam._id, role: 'freelancer',
      bio: 'Full-stack developer with 4 years experience in React, Node.js, and MongoDB.',
      skills: ['React', 'Node.js', 'MongoDB', 'Express', 'Tailwind CSS'],
      githubUrl: 'https://github.com/samdev',
      hourlyRate: 500,
      availability: 'full-time',
      completionPercent: 70
    },
    {
      user: priya._id, role: 'freelancer',
      bio: 'UI/UX designer and frontend developer. I turn Figma designs into pixel-perfect React components.',
      skills: ['React', 'Figma', 'Tailwind CSS', 'UI/UX', 'TypeScript'],
      githubUrl: 'https://github.com/priyadesigns',
      hourlyRate: 600,
      availability: 'part-time',
      completionPercent: 80
    }
  ]);
  console.log('Portfolios created');

  // ─── JOB 1: Existing contract + milestones (for payment flow demo) ───────

  const job1Phases = [
    {
      title: 'User Authentication & Project Setup',
      guideline: 'Setup React + Node.js boilerplate, implement JWT-based register/login, role-based dashboards for client and freelancer. Deliverable: working auth system with protected routes.',
      deliverableType: 'Code File',
      budgetPercent: 34,
      phaseDeadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      maxRevisions: 2
    },
    {
      title: 'Product Listing, Cart & Orders',
      guideline: 'Build product catalog with search and filter, shopping cart with localStorage persistence, and order management system with status tracking.',
      deliverableType: 'Code File',
      budgetPercent: 33,
      phaseDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      maxRevisions: 2
    },
    {
      title: 'Razorpay Payment Integration & Checkout',
      guideline: 'Integrate Razorpay payments into checkout flow, add payment history page, and generate PDF invoices for completed orders.',
      deliverableType: 'Code File',
      budgetPercent: 33,
      phaseDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      maxRevisions: 2
    }
  ];
  const job1Hash = crypto.createHash('sha256')
    .update('Build E-Commerce Website with React & Node.js' + 'Need a full-stack e-commerce platform with user auth, product listing, cart, and Razorpay payments.' + job1Phases.map(p => p.title + p.guideline).join(''))
    .digest('hex').substring(0, 16).toUpperCase();

  const job1 = new Job({
    client: client._id,
    title: 'Build E-Commerce Website with React & Node.js',
    description: 'Need a full-stack e-commerce platform with user auth, product listing, cart, and Razorpay payments.',
    budget: 10000,
    skills: ['React', 'Node.js', 'MongoDB', 'Razorpay'],
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'in_progress',
    category: 'Web Development',
    experienceLevel: 'Mid',
    advancePercent: 10,
    verifiedOnly: false,
    nda: false,
    ipOwnership: 'client',
    latePenalty: 5,
    autoReleaseHours: 72,
    scopeHash: job1Hash,
    phases: job1Phases
  });
  await job1.save();

  const negotiation = new Negotiation({
    job: job1._id,
    client: client._id,
    freelancer: sam._id,
    status: 'agreed',
    currentRound: 2,
    maxRounds: 4,
    agreedAmount: 10000,
    agreedTimeline: 30,
    agreedScope: 'React frontend + Node.js backend + MongoDB + Razorpay integration with 3 payment phases',
    agreedMilestoneCount: 3,
    agreedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    rounds: [
      {
        roundNumber: 1, proposedByRole: 'client',
        amount: 9000, timeline: 25, scope: 'E-commerce app', milestoneCount: 3,
        message: 'Initial offer', status: 'countered',
        respondedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        roundNumber: 2, proposedByRole: 'freelancer',
        amount: 10000, timeline: 30, scope: 'React + Node.js + MongoDB + Razorpay', milestoneCount: 3,
        message: 'Counter with full scope. Fair price for the work.', status: 'accepted',
        respondedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }
    ]
  });
  await negotiation.save();

  const contract = new Contract({
    job: job1._id,
    negotiation: negotiation._id,
    client: client._id,
    freelancer: sam._id,
    amount: 10000,
    scope: 'React + Node.js + MongoDB + Razorpay integration',
    timeline: 30,
    milestoneCount: 3,
    advancePercent: 10,
    status: 'active',
    startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  });
  await contract.save();

  const now = new Date();
  await Milestone.insertMany([
    {
      contract: contract._id, client: client._id, freelancer: sam._id,
      milestoneNumber: 0, isAdvance: true,
      title: 'Advance Payment (10%)',
      description: 'Initial advance payment — held until Phase 1 approval',
      amount: 1000,
      deadline: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      status: 'released',
      razorpayOrderId: 'order_test_advance_demo', razorpayPaymentId: 'pay_test_advance_demo',
      submittedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      releasedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    },
    {
      contract: contract._id, client: client._id, freelancer: sam._id,
      milestoneNumber: 1,
      title: 'Phase 1: User Authentication & Project Setup',
      description: 'Setup React + Node.js boilerplate, implement user register/login with JWT, role-based dashboards',
      amount: 3000,
      deadline: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      status: 'released',
      razorpayOrderId: 'order_test_phase1_demo', razorpayPaymentId: 'pay_test_phase1_demo',
      submissionNote: 'Auth system complete. JWT login working. Client and freelancer dashboards built.',
      submissionFileHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      submissionFileUrl: '/uploads/phase1-demo.zip',
      submittedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      releasedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    },
    {
      contract: contract._id, client: client._id, freelancer: sam._id,
      milestoneNumber: 2,
      title: 'Phase 2: Product Listing, Cart & Orders',
      description: 'Build product catalog, shopping cart with persistence, order management system',
      amount: 3000,
      deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      status: 'review',
      razorpayOrderId: 'order_test_phase2_demo', razorpayPaymentId: 'pay_test_phase2_demo',
      submissionNote: 'Product listing and cart complete. Filter, search, and order tracking implemented.',
      submissionFileHash: 'b2c3d4e5f6a7b2c3d4e5f6a7b2c3d4e5f6a7b2c3d4e5f6a7b2c3d4e5f6a7b2c3',
      submissionFileUrl: '/uploads/phase2-demo.zip',
      submittedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      autoReleaseAt: new Date(now.getTime() + 71 * 60 * 60 * 1000)
    },
    {
      contract: contract._id, client: client._id, freelancer: sam._id,
      milestoneNumber: 3,
      title: 'Phase 3: Razorpay Payment Integration & Checkout',
      description: 'Integrate Razorpay payments, checkout flow, payment history, invoice generation',
      amount: 3000,
      deadline: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
      status: 'pending_deposit'
    }
  ]);
  console.log('Job 1 (e-commerce) + contract + milestones created');

  // ─── JOB 2: New application pipeline demo ────────────────────────────────
  //
  // Shows the full hiring pipeline in one job:
  //   Sam Developer    → interviewed  (client sees in "Awaiting Your Decision")
  //   Priya Designer   → interview_scheduled TODAY  (client sees in "Interviews Scheduled Today")
  //
  // Client can:  Hire Sam | Negotiate Sam | Reject Sam
  //             Join Priya's interview | Mark Done
  //
  // Freelancers see their status in "My Applications" on their dashboard

  const todayAt3pm = new Date();
  todayAt3pm.setHours(15, 0, 0, 0);

  const interviewRoomId = 'interview-' + crypto.randomUUID();

  const job2Phases = [
    {
      title: 'UI Design & Component Library',
      guideline: 'Create a Figma prototype for approval, then build the base component library: sidebar navigation, header, cards, data tables, and dark/light mode toggle. All components must be responsive.',
      deliverableType: 'Design File',
      budgetPercent: 30,
      phaseDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxRevisions: 2
    },
    {
      title: 'Charts, Graphs & Analytics Widgets',
      guideline: 'Implement all data visualisation components: line charts, bar charts, pie charts, KPI cards, and date-range pickers using Recharts. Charts must animate on load and support live data refresh.',
      deliverableType: 'Code File',
      budgetPercent: 40,
      phaseDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      maxRevisions: 2
    },
    {
      title: 'REST API Integration & Role-Based Access',
      guideline: 'Wire all widgets to the provided REST API endpoints, implement JWT-based role-based views (Admin / Viewer), add loading/error states, and write a README covering setup and environment variables.',
      deliverableType: 'Code File',
      budgetPercent: 30,
      phaseDeadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      maxRevisions: 1
    }
  ];
  const job2Hash = crypto.createHash('sha256')
    .update('Build React Dashboard with Charts & Analytics' + 'Looking for a React developer to build a responsive analytics dashboard.' + job2Phases.map(p => p.title + p.guideline).join(''))
    .digest('hex').substring(0, 16).toUpperCase();

  const job2 = new Job({
    client: client._id,
    title: 'Build React Dashboard with Charts & Analytics',
    description: 'Looking for a React developer to build a responsive analytics dashboard. Must include interactive charts (Recharts/Chart.js), role-based views, dark mode, and a REST API integration layer.',
    budget: 50000,
    skills: ['React', 'Tailwind CSS', 'Node.js', 'Recharts'],
    deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    status: 'open',
    category: 'Web Development',
    experienceLevel: 'Mid',
    advancePercent: 15,
    verifiedOnly: false,
    nda: false,
    ipOwnership: 'client',
    latePenalty: 0,
    autoReleaseHours: 72,
    scopeHash: job2Hash,
    phases: job2Phases,
    bids: [
      // Sam: went through full pipeline → interviewed, waiting for client decision
      {
        freelancer: sam._id,
        proposal: 'I have built 5+ dashboards with React and Recharts. I can deliver a pixel-perfect, fully responsive solution with dark mode and role-based access. Here is my approach: Week 1 — layout and chart components, Week 2 — API integration and auth, Week 3 — polish and QA.',
        status: 'interviewed',
        appliedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        shortlistedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        interviewScheduledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        meetingRoomId: 'interview-sam-demo-done',
        interviewDoneAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      // Priya: interview scheduled for TODAY — live interview room ready
      {
        freelancer: priya._id,
        proposal: 'As a UI/UX focused frontend developer I specialise in exactly this kind of project. My dashboards are known for their clean aesthetics and smooth interactions. I will start with a Figma prototype for approval before coding so you know exactly what you are getting.',
        status: 'interview_scheduled',
        appliedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        shortlistedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        interviewScheduledAt: todayAt3pm,
        meetingRoomId: interviewRoomId,
      }
    ]
  });
  await job2.save();
  console.log('Job 2 (pipeline demo) created');

  // ─── JOB 3: Fresh open job — zero applicants ─────────────────────────────

  const job3Phases = [
    {
      title: 'App Setup & Workout Logging',
      guideline: 'Initialize React Native project (Expo), set up navigation, implement user onboarding, and build the core workout logging screen: exercise search, sets/reps/weight input, and workout history list.',
      deliverableType: 'Code File',
      budgetPercent: 30,
      phaseDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      maxRevisions: 2
    },
    {
      title: 'Progress Charts & Push Notifications',
      guideline: 'Build progress tracking charts (weekly/monthly volume, personal records), body weight log, and configure Firebase push notifications for workout reminders and streak alerts.',
      deliverableType: 'Code File',
      budgetPercent: 35,
      phaseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      maxRevisions: 2
    },
    {
      title: 'Health API Integration & App Store Build',
      guideline: 'Integrate Apple HealthKit and Google Fit APIs to sync steps and calories. Run full QA on iOS and Android. Deliver signed APK and IPA builds with a TestFlight / Play Store internal track release.',
      deliverableType: 'APK',
      budgetPercent: 35,
      phaseDeadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      maxRevisions: 1
    }
  ];
  const job3Hash = crypto.createHash('sha256')
    .update('Mobile App: Fitness Tracker (React Native)' + 'Build a cross-platform fitness tracking app. Features: workout logging, progress charts, push notifications, Apple Health / Google Fit integration.' + job3Phases.map(p => p.title + p.guideline).join(''))
    .digest('hex').substring(0, 16).toUpperCase();

  const job3 = new Job({
    client: client._id,
    title: 'Mobile App: Fitness Tracker (React Native)',
    description: 'Build a cross-platform fitness tracking app. Features: workout logging, progress charts, push notifications, Apple Health / Google Fit integration.',
    budget: 80000,
    skills: ['React Native', 'Node.js', 'MongoDB', 'Firebase'],
    deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    status: 'open',
    category: 'Mobile',
    experienceLevel: 'Senior',
    advancePercent: 20,
    verifiedOnly: true,
    nda: true,
    ipOwnership: 'client',
    latePenalty: 10,
    autoReleaseHours: 48,
    scopeHash: job3Hash,
    phases: job3Phases
  });
  await job3.save();
  console.log('Job 3 (open, no applicants yet) created');

  // ─── Done ─────────────────────────────────────────────────────────────────

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    SEED COMPLETE — DEMO GUIDE                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  console.log('\n── Accounts ─────────────────────────────────────────────────────');
  console.log('  client@test.com        / Test@123  → Alex Johnson (Client)');
  console.log('  freelancer@test.com    / Test@123  → Sam Developer (Freelancer)');
  console.log('  freelancer2@test.com   / Test@123  → Priya Designer (Freelancer)');
  console.log('  admin@test.com         / Test@123  → Admin');

  console.log('\n── What you can demo ────────────────────────────────────────────');

  console.log('\n  [CLIENT — client@test.com]');
  console.log('  Dashboard → "Interviews Scheduled Today"');
  console.log('    • Priya Designer has an interview at 3:00 PM today');
  console.log('    • Click "Join Interview" → opens WebRTC interview room');
  console.log('');
  console.log('  Dashboard → "Awaiting Your Decision"');
  console.log('    • Sam Developer — interviewed, ready for decision');
  console.log('    • [Hire] → creates contract at ₹50,000 + auto-generates milestones');
  console.log('    • [Negotiate] → opens negotiation room starting at ₹50,000');
  console.log('    • [Reject] → marks rejected');
  console.log('');
  console.log('  Dashboard → "My Posted Jobs"');
  console.log('    • "Build React Dashboard" shows: 1 applied · 1 shortlisted (pipeline counts)');
  console.log('    • [Manage Applications] → Job Detail page with pipeline tabs');
  console.log('');
  console.log('  Job Detail → "Build React Dashboard" (/jobs/' + job2._id + ')');
  console.log('    Tabs:  All(2) | Shortlisted(1) | Interview(1) | Interviewed(1)');
  console.log('    • Sam (Interviewed tab) → [Hire Directly ₹50,000] [Start Negotiation] [Reject]');
  console.log('    • Priya (Interview tab) → [Join Interview] [Mark Done]');
  console.log('');
  console.log('  Job 3 "Fitness Tracker" → No applications yet → freelancers can apply');

  console.log('\n  [FREELANCER — freelancer@test.com  (Sam)]');
  console.log('  Dashboard → "My Applications"');
  console.log('    • "Build React Dashboard" — status: Interviewed (pipeline bar shows progress)');
  console.log('    • "Build E-Commerce Website" — active contract → [View Contract]');
  console.log('  After client hires: status becomes Hired → [View Contract] link appears');
  console.log('  After client negotiates: status becomes In Negotiation → [View Negotiation] link');

  console.log('\n  [FREELANCER — freelancer2@test.com  (Priya)]');
  console.log('  Dashboard → "My Applications"');
  console.log('    • "Build React Dashboard" — status: Interview Scheduled at 3:00 PM today');
  console.log('    • [Join Interview] button → opens WebRTC room (same room as client)');
  console.log('  Interview room ID: ' + interviewRoomId);

  console.log('\n  [EXISTING CONTRACT DEMO — still intact]');
  console.log('  Client or Sam → Contracts → "Build E-Commerce Website"');
  console.log('    • Phase 1 & Advance: Released ✓');
  console.log('    • Phase 2: In Review → client can [Approve] or [Reject]');
  console.log('    • Phase 3: Pending Deposit → client needs to fund');

  console.log('\n  [ADMIN — admin@test.com]');
  console.log('  /admin → dispute management (disputes auto-created on 2nd rejection)');

  console.log('\n── Interview Room (both parties use this link) ──────────────────');
  console.log('  /interview/' + interviewRoomId + '?job=Build%20React%20Dashboard&jobId=' + job2._id);

  console.log('\n── Quick flow to demo from zero ────────────────────────────────');
  console.log('  1. Login as Priya → Browse Jobs → Apply to "Fitness Tracker" (new application)');
  console.log('  2. Login as Client → Dashboard → shortlist Priya → schedule interview');
  console.log('  3. Login as Client → "Awaiting Your Decision" → Hire Sam');
  console.log('  4. Watch Sam\'s dashboard update: Interviewed → Hired + View Contract');
  console.log('  5. Open two browsers → Client + Priya → Join Interview → WebRTC call');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
