require('dotenv').config();
const mongoose = require('mongoose');
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

  // Create users
  const admin = new User({ name: 'Admin User', email: 'admin@test.com', password: 'Test@123', role: 'admin', rating: 5 });
  const client = new User({ name: 'Alex Johnson', email: 'client@test.com', password: 'Test@123', role: 'client', rating: 4.6, totalJobsCompleted: 8 });
  const freelancer = new User({ name: 'Sam Developer', email: 'freelancer@test.com', password: 'Test@123', role: 'freelancer', rating: 4.8, totalJobsCompleted: 23 });
  await Promise.all([admin.save(), client.save(), freelancer.save()]);
  console.log('Users created');

  // Create portfolios
  await Portfolio.create([
    {
      user: admin._id, role: 'client', bio: 'Platform Admin', completionPercent: 100
    },
    {
      user: client._id, role: 'client',
      bio: 'We build fintech and e-commerce products.',
      companyName: 'TechStart Ltd',
      projectsPosted: 12, projectsCompleted: 8,
      paymentVerified: true, completionPercent: 85
    },
    {
      user: freelancer._id, role: 'freelancer',
      bio: 'Full-stack developer with 4 years experience in React, Node.js, and MongoDB.',
      skills: ['React', 'Node.js', 'MongoDB', 'Express', 'Tailwind CSS'],
      githubUrl: 'https://github.com/samdev',
      hourlyRate: 500,
      availability: 'full-time',
      completionPercent: 95
    }
  ]);
  console.log('Portfolios created');

  // Create a job
  const job = new Job({
    client: client._id,
    title: 'Build E-Commerce Website with React & Node.js',
    description: 'Need a full-stack e-commerce platform with user auth, product listing, cart, and Stripe payments.',
    budget: 10000,
    skills: ['React', 'Node.js', 'MongoDB', 'Stripe'],
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'in_progress'
  });
  await job.save();

  // Create negotiation
  const negotiation = new Negotiation({
    job: job._id,
    client: client._id,
    freelancer: freelancer._id,
    status: 'agreed',
    currentRound: 2,
    maxRounds: 4,
    agreedAmount: 10000,
    agreedTimeline: 30,
    agreedScope: 'React frontend + Node.js backend + MongoDB + Stripe integration with 3 payment phases',
    agreedMilestoneCount: 3,
    agreedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    rounds: [
      {
        roundNumber: 1, proposedByRole: 'client',
        amount: 9000, timeline: 25, scope: 'E-commerce app', milestoneCount: 3,
        message: 'Initial offer', status: 'countered', respondedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        roundNumber: 2, proposedByRole: 'freelancer',
        amount: 10000, timeline: 30, scope: 'React + Node.js + MongoDB + Stripe', milestoneCount: 3,
        message: 'Counter with full scope. Fair price for the work.', status: 'accepted', respondedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }
    ]
  });
  await negotiation.save();

  // Create contract
  const contract = new Contract({
    job: job._id,
    negotiation: negotiation._id,
    client: client._id,
    freelancer: freelancer._id,
    amount: 10000,
    scope: 'React + Node.js + MongoDB + Stripe integration',
    timeline: 30,
    milestoneCount: 3,
    status: 'active',
    startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  });
  await contract.save();

  // Create milestones
  const now = new Date();
  await Milestone.insertMany([
    {
      contract: contract._id, client: client._id, freelancer: freelancer._id,
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
      contract: contract._id, client: client._id, freelancer: freelancer._id,
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
      contract: contract._id, client: client._id, freelancer: freelancer._id,
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
      contract: contract._id, client: client._id, freelancer: freelancer._id,
      milestoneNumber: 3,
      title: 'Phase 3: Stripe Payment Integration & Checkout',
      description: 'Integrate Stripe payments, checkout flow, payment history, invoice generation',
      amount: 3000,
      deadline: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
      status: 'pending_deposit'
    }
  ]);

  console.log('Milestones created');
  console.log('\n=== SEED COMPLETE ===');
  console.log('admin@test.com / Test@123 → Admin');
  console.log('client@test.com / Test@123 → Alex Johnson (Client)');
  console.log('freelancer@test.com / Test@123 → Sam Developer (Freelancer)');
  console.log('Phase 2 is in REVIEW — ready for live demo approval/rejection');
  console.log('Phase 3 is PENDING DEPOSIT — shows client needs to fund next phase');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
