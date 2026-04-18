const express = require('express');
const router = express.Router();
const Contract = require('../models/Contract');
const Milestone = require('../models/Milestone');
const User = require('../models/User');
const auth = require('../middleware/auth');
const isTestMode = require('../utils/isTestMode');
const { milestoneTransition } = require('../services/stateMachine');
const { initiateFreelancerPayout } = require('../services/releaseService');

// Helper: refund amount to client (wallet credit in test; Razorpay refund in live)
async function refundToClient(milestone, amount) {
  const refundAmt = amount != null ? amount : (milestone.clientTotal || milestone.amount);
  if (!isTestMode() && milestone.razorpayPaymentId && !milestone.razorpayPaymentId.startsWith('pay_test_')) {
    try {
      const Razorpay = require('razorpay');
      const rz = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
      await rz.payments.refund(milestone.razorpayPaymentId, { amount: Math.round(refundAmt * 100) });
      return;
    } catch (e) {
      console.error('Razorpay refund failed, crediting wallet:', e.message);
    }
  }
  await User.findByIdAndUpdate(milestone.client, { $inc: { walletBalance: refundAmt } });
}

// Pure function — no side effects, computes what a withdrawal will look like
function computeWithdrawPreview(contract, milestones, withdrawingRole) {
  const advance = milestones.find(m => m.isAdvance);
  const regular = [...milestones.filter(m => !m.isAdvance)].sort((a, b) => a.milestoneNumber - b.milestoneNumber);

  const activePhase = regular.find(m =>
    ['funded', 'in_progress', 'submitted', 'review', 'inaccurate_1', 'inaccurate_2'].includes(m.status)
  );
  const anyPhaseStarted = regular.some(m => m.status !== 'pending_deposit');
  const advanceFunded = !!advance && advance.status === 'funded';
  const advanceAmount = advance?.amount || 0;

  // Scenario 1: no phase has been funded yet
  if (!anyPhaseStarted) {
    return {
      scenario: 1,
      withdrawingRole,
      advanceFunded,
      advanceAmount,
      advanceGoesTo: withdrawingRole === 'client' ? 'freelancer' : 'client',
      penalty: 0,
      phaseAmount: 0,
      elapsedPct: 0,
      past50: false,
      phaseRefundToClient: 0,
      freelancerReceivesFromPhase: 0,
      freelancerPenalty: 0,
    };
  }

  // Scenario 2: at least one phase has been funded
  if (activePhase) {
    const phaseStart = activePhase.fundedAt
      ? new Date(activePhase.fundedAt)
      : new Date(contract.startedAt || contract.createdAt);
    const phaseEnd = new Date(activePhase.deadline);
    const now = new Date();
    const totalMs = phaseEnd.getTime() - phaseStart.getTime();
    const elapsedMs = now.getTime() - phaseStart.getTime();
    const elapsedPct = totalMs > 0
      ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)))
      : 100;
    const past50 = elapsedPct >= 50;
    const phaseAmount = activePhase.amount;
    const penalty = Math.round(phaseAmount * 0.15);

    let phaseRefundToClient = 0;
    let freelancerReceivesFromPhase = 0;
    let freelancerPenalty = 0;

    if (past50) {
      freelancerReceivesFromPhase = phaseAmount;
    } else if (withdrawingRole === 'client') {
      freelancerReceivesFromPhase = penalty;
      phaseRefundToClient = phaseAmount - penalty;
    } else {
      phaseRefundToClient = phaseAmount;
      freelancerPenalty = penalty;
    }

    return {
      scenario: 2,
      withdrawingRole,
      advanceFunded,
      advanceAmount,
      advanceGoesTo: 'freelancer',
      activePhaseNumber: activePhase.milestoneNumber,
      activePhaseTitle: activePhase.title,
      activePhaseId: activePhase._id,
      phaseAmount,
      elapsedPct,
      past50,
      penalty: past50 ? 0 : penalty,
      phaseRefundToClient,
      freelancerReceivesFromPhase,
      freelancerPenalty,
    };
  }

  // All phases are done/refunded — clean close
  return {
    scenario: 2,
    withdrawingRole,
    advanceFunded,
    advanceAmount,
    advanceGoesTo: 'freelancer',
    allComplete: true,
    penalty: 0,
    phaseAmount: 0,
    elapsedPct: 0,
    past50: false,
    phaseRefundToClient: 0,
    freelancerReceivesFromPhase: 0,
    freelancerPenalty: 0,
  };
}

// GET /api/contracts/my-contracts — client
router.get('/my-contracts', auth, async (req, res) => {
  try {
    const contracts = await Contract.find({ client: req.user.id })
      .populate('freelancer', 'name email rating')
      .populate('job', 'title')
      .sort({ createdAt: -1 });
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/contracts/my-work — freelancer
router.get('/my-work', auth, async (req, res) => {
  try {
    const contracts = await Contract.find({ freelancer: req.user.id })
      .populate('client', 'name email rating')
      .populate('job', 'title')
      .sort({ createdAt: -1 });
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/contracts/:id — with milestones
router.get('/:id', auth, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('client', 'name email rating')
      .populate('freelancer', 'name email rating')
      .populate('job', 'title description');
    if (!contract) return res.status(404).json({ message: 'Not found' });

    const isParty = contract.client._id.toString() === req.user.id ||
      contract.freelancer._id.toString() === req.user.id ||
      req.user.role === 'admin';
    if (!isParty) return res.status(403).json({ message: 'Not your contract' });

    const milestones = await Milestone.find({ contract: contract._id }).sort({ milestoneNumber: 1 });
    res.json({ contract, milestones });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/contracts/:id/withdraw-preview — preview withdrawal outcome (no side effects)
router.get('/:id/withdraw-preview', auth, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ message: 'Not found' });
    const isParty = [contract.client.toString(), contract.freelancer.toString()].includes(req.user.id);
    if (!isParty) return res.status(403).json({ message: 'Not your contract' });
    if (!['active', 'pending_advance'].includes(contract.status)) {
      return res.status(400).json({ message: 'Contract is not active' });
    }
    const milestones = await Milestone.find({ contract: contract._id });
    res.json(computeWithdrawPreview(contract, milestones, req.user.role));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/contracts/:id/withdraw — execute withdrawal (client or freelancer)
router.post('/:id/withdraw', auth, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ message: 'Not found' });

    const isClient = contract.client.toString() === req.user.id;
    const isFreelancer = contract.freelancer.toString() === req.user.id;
    if (!isClient && !isFreelancer) return res.status(403).json({ message: 'Not your contract' });
    if (!['active', 'pending_advance'].includes(contract.status)) {
      return res.status(400).json({ message: 'Contract is not active' });
    }

    const milestones = await Milestone.find({ contract: contract._id });
    const preview = computeWithdrawPreview(contract, milestones, req.user.role);
    const advance = milestones.find(m => m.isAdvance);
    const regular = milestones.filter(m => !m.isAdvance).sort((a, b) => a.milestoneNumber - b.milestoneNumber);
    const activePhase = regular.find(m =>
      ['funded', 'in_progress', 'submitted', 'review', 'inaccurate_1', 'inaccurate_2'].includes(m.status)
    );

    // ── Step 1: Handle advance payment ──────────────────────────────────────
    if (advance && advance.status === 'funded') {
      if (preview.advanceGoesTo === 'freelancer') {
        await milestoneTransition(advance._id, 'released');
        const advanceType = preview.scenario === 1 ? 'withdrawal_advance' : 'advance_payment';
        await initiateFreelancerPayout(advance, null, advanceType);
      } else {
        // Scenario 1, freelancer withdraws → refund advance to client
        await refundToClient(advance, advance.clientTotal || advance.amount);
        await Milestone.findByIdAndUpdate(advance._id, { status: 'refunded' });
      }
    }

    // ── Step 2: Handle active phase ─────────────────────────────────────────
    if (activePhase) {
      if (preview.past50) {
        // Both parties: full phase payment goes to freelancer
        await milestoneTransition(activePhase._id, 'released');
        await initiateFreelancerPayout(activePhase, null, 'withdrawal_phase');
      } else if (isClient) {
        // Client withdraws before 50%: 15% penalty to freelancer, 85% refund to client
        await milestoneTransition(activePhase._id, 'released');
        const penaltyAfterFee = Math.round(preview.penalty * 0.98);
        await initiateFreelancerPayout(activePhase, penaltyAfterFee, 'withdrawal_penalty');
        if (preview.phaseRefundToClient > 0) {
          await refundToClient(activePhase, preview.phaseRefundToClient);
        }
      } else {
        // Freelancer withdraws before 50%: 100% refund to client + 15% penalty from freelancer wallet
        await refundToClient(activePhase, activePhase.amount);
        await Milestone.findByIdAndUpdate(activePhase._id, { status: 'refunded' });

        if (preview.freelancerPenalty > 0) {
          const freelancer = await User.findById(activePhase.freelancer);
          if (freelancer && freelancer.walletBalance >= preview.freelancerPenalty) {
            await User.findByIdAndUpdate(activePhase.freelancer, { $inc: { walletBalance: -preview.freelancerPenalty } });
          } else {
            await User.findByIdAndUpdate(activePhase.freelancer, { $inc: { penaltyDue: preview.freelancerPenalty } });
          }
          await User.findByIdAndUpdate(contract.client, { $inc: { walletBalance: preview.freelancerPenalty } });
        }
      }
    }

    // ── Step 3: Close all unfunded phases ────────────────────────────────────
    for (const m of regular) {
      if (m.status === 'pending_deposit') {
        await Milestone.findByIdAndUpdate(m._id, { status: 'refunded' });
      }
    }

    // ── Step 4: Mark contract withdrawn ─────────────────────────────────────
    await Contract.findByIdAndUpdate(contract._id, {
      status: 'withdrawn',
      withdrawnAt: new Date(),
      withdrawnBy: req.user.role,
    });

    res.json({ success: true, preview });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
