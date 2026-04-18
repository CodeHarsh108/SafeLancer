require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Portfolio = require('./models/Portfolio');
const Job = require('./models/Job');
const Negotiation = require('./models/Negotiation');
const Contract = require('./models/Contract');
const Milestone = require('./models/Milestone');
const Dispute = require('./models/Dispute');
const Message = require('./models/Message');

async function reset() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear all collections
  await Promise.all([
    User.deleteMany({}),
    Portfolio.deleteMany({}),
    Job.deleteMany({}),
    Negotiation.deleteMany({}),
    Contract.deleteMany({}),
    Milestone.deleteMany({}),
    Dispute.deleteMany({}),
    Message.deleteMany({})
  ]);
  console.log('All collections cleared');

  // Create only the admin user
  const admin = new User({
    name: 'Admin',
    email: 'admin@safelancer.in',
    password: 'Admin@123',
    role: 'admin'
  });
  await admin.save();
  console.log('Admin user created: admin@safelancer.in / Admin@123');

  console.log('\nDatabase is clean. Real users can now register and use the platform.');
  await mongoose.disconnect();
  process.exit(0);
}

reset().catch(err => {
  console.error('Reset error:', err);
  process.exit(1);
});
