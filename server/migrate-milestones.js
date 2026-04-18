// One-time migration: backfill originalDeadline and maxRevisions on existing phase milestones
require('dotenv').config();
const mongoose = require('mongoose');
const Milestone = require('./models/Milestone');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/freelock');
  console.log('Connected to MongoDB');

  // Backfill originalDeadline for phase milestones that don't have it set
  const missingOriginal = await Milestone.find({
    isAdvance: false,
    originalDeadline: { $exists: false }
  });
  console.log(`Found ${missingOriginal.length} milestones missing originalDeadline`);
  for (const m of missingOriginal) {
    m.originalDeadline = m.deadline;
    await m.save();
  }

  // Backfill maxRevisions for phase milestones that don't have it set
  const missingRevisions = await Milestone.find({
    isAdvance: false,
    maxRevisions: { $exists: false }
  });
  console.log(`Found ${missingRevisions.length} milestones missing maxRevisions`);
  for (const m of missingRevisions) {
    m.maxRevisions = 2;
    await m.save();
  }

  // Add compound index for fast lookups (contract + isAdvance)
  await Milestone.collection.createIndex({ contract: 1, isAdvance: 1 });
  await Milestone.collection.createIndex({ contract: 1, milestoneNumber: 1 });
  console.log('Indexes ensured');

  console.log('Migration complete');
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
