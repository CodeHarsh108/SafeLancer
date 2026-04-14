// stateMachine.js — single source of truth for milestone state transitions.
// All routes (milestones.js) must call milestoneTransition() instead of setting status directly.
const Milestone = require('../models/Milestone');

// Allowed next-states for each current state.
// NOTE: submit route calls submitted→review as two sequential transitions in one request.
// NOTE: review route drives inaccurate_1/inaccurate_2/approved; release drives approved→released.
const VALID_TRANSITIONS = {
  pending_deposit: ['funded'],
  funded: ['in_progress'],
  in_progress: ['submitted'],
  submitted: ['review'],
  review: ['approved', 'inaccurate_1', 'inaccurate_2', 'released'], // released = auto-release path
  inaccurate_1: ['submitted'],    // freelancer gets one retry after 1st rejection
  inaccurate_2: ['disputed'],     // 2nd rejection → auto-dispute (no more retries)
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
    // Auto-release fires if client doesn't review within 72 hours (cron in index.js)
    milestone.autoReleaseAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  }
  if (nextState === 'released') {
    milestone.releasedAt = now;
  }

  await milestone.save();
  return milestone;
}

module.exports = { milestoneTransition, canTransition };
