// stateMachine.js — single source of truth for milestone state transitions.
const Milestone = require('../models/Milestone');

const VALID_TRANSITIONS = {
  pending_deposit: ['funded'],
  funded: ['in_progress', 'released'], // released: used for advance milestone release after Phase 1 completion
  in_progress: ['submitted'],
  submitted: ['review'],
  review: ['approved', 'inaccurate_1', 'disputed', 'released'], // disputed: exceeds reschedule limit
  inaccurate_1: ['submitted'],
  inaccurate_2: ['disputed'], // kept for legacy data only
  disputed: ['released', 'refunded'],
  approved: ['released'],
  released: [],
  refunded: []
};

function canTransition(currentState, nextState) {
  return VALID_TRANSITIONS[currentState] && VALID_TRANSITIONS[currentState].includes(nextState);
}

async function milestoneTransition(milestoneId, nextState) {
  const milestone = await Milestone.findById(milestoneId);
  if (!milestone) throw new Error('Milestone not found');

  if (!canTransition(milestone.status, nextState)) {
    throw new Error(`Invalid transition: ${milestone.status} → ${nextState}`);
  }

  milestone.status = nextState;

  const now = new Date();
  if (nextState === 'submitted') {
    milestone.submittedAt = now;
    milestone.autoReleaseAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  }
  if (nextState === 'approved') {
    // Client has 48h to release payment before penalty kicks in
    milestone.paymentDueAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  }
  if (nextState === 'released') {
    milestone.releasedAt = now;
  }

  await milestone.save();
  return milestone;
}

module.exports = { milestoneTransition, canTransition };
