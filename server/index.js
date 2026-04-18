require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors());
app.use(express.json());
// Videos served statically so the browser can play them natively; code files are gated via /api/milestones/file/:id/code
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/milestones', require('./routes/milestones'));
app.use('/api/files', require('./routes/files'));
app.use('/api/disputes', require('./routes/disputes'));
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Socket.io
io.on('connection', (socket) => {
  socket.on('join-room', (contractId) => {
    socket.join(contractId);
  });

  socket.on('send-message', async (data) => {
    if (!data.senderId) return;
    try {
      const Message = require('./models/Message');
      const msg = new Message({
        contract: data.contractId,
        sender: data.senderId,
        senderName: data.senderName,
        senderRole: data.senderRole,
        text: data.text,
        type: data.type || 'text',
        meetingData: data.meetingData
      });
      await msg.save();
      io.to(data.contractId).emit('receive-message', msg);
    } catch (err) {
      console.error('send-message error:', err.message);
    }
  });

  socket.on('typing', (data) => {
    socket.to(data.contractId).emit('user-typing', { name: data.name });
  });

  socket.on('stop-typing', (data) => {
    socket.to(data.contractId).emit('user-stop-typing');
  });

  socket.on('request-meeting', (data) => {
    io.to(data.contractId).emit('meeting-requested', data);
  });

  socket.on('respond-meeting', (data) => {
    io.to(data.contractId).emit('meeting-response', data);
  });

  socket.on('call-user', (data) => {
    socket.to(data.contractId).emit('incoming-call', { signal: data.signal, from: data.from, name: data.name });
  });

  socket.on('accept-call', (data) => {
    socket.to(data.contractId).emit('call-accepted', { signal: data.signal });
  });

  socket.on('end-call', (data) => {
    socket.to(data.contractId).emit('call-ended');
  });

});

// Auto-release cron — runs every hour: release milestones in 'review' past autoReleaseAt
cron.schedule('0 * * * *', async () => {
  try {
    const Milestone = require('./models/Milestone');
    const { performRelease } = require('./services/releaseService');

    const overdue = await Milestone.find({ status: 'review', autoReleaseAt: { $lte: new Date() } });
    for (const m of overdue) {
      try {
        await performRelease(m);
        console.log(`Auto-released milestone ${m._id}`);
      } catch (e) {
        console.error(`Auto-release failed for ${m._id}:`, e.message);
      }
    }
  } catch (err) {
    console.error('Auto-release cron error:', err.message);
  }
});

// Client payment penalty cron — runs every hour: penalise + ban clients who miss release deadline
cron.schedule('30 * * * *', async () => {
  try {
    const Milestone = require('./models/Milestone');
    const User = require('./models/User');

    const lateApproved = await Milestone.find({
      status: 'approved',
      paymentDueAt: { $lte: new Date() },
      clientPaymentPenaltyApplied: false
    });

    for (const m of lateApproved) {
      try {
        const penalty = Math.round(m.amount * 0.05); // 5% of milestone amount
        await User.findByIdAndUpdate(m.client, {
          $inc: { penaltyDue: penalty, penaltyCount: 1 },
          isBanned: true,
          banReason: `Late payment on milestone "${m.title}". Pay penalty of ₹${penalty} to restore access.`
        });
        await Milestone.findByIdAndUpdate(m._id, { clientPaymentPenaltyApplied: true });
        console.log(`Payment penalty ₹${penalty} applied to client ${m.client} for milestone ${m._id}`);
      } catch (e) {
        console.error(`Payment penalty failed for ${m._id}:`, e.message);
      }
    }
  } catch (err) {
    console.error('Payment penalty cron error:', err.message);
  }
});

// Freelancer submission penalty cron — runs every hour: penalise freelancers who miss deadline
cron.schedule('45 * * * *', async () => {
  try {
    const Milestone = require('./models/Milestone');
    const User = require('./models/User');
    const Dispute = require('./models/Dispute');

    const overdueWork = await Milestone.find({
      status: { $in: ['in_progress', 'inaccurate_1'] },
      deadline: { $lte: new Date() },
      submissionPenaltyApplied: false
    });

    for (const m of overdueWork) {
      try {
        const freelancer = await User.findByIdAndUpdate(m.freelancer, {
          $inc: { penaltyCount: 1 }
        }, { new: true });

        await Milestone.findByIdAndUpdate(m._id, { submissionPenaltyApplied: true });

        // Ban freelancer after 3 missed deadlines
        if (freelancer && freelancer.penaltyCount >= 3) {
          await User.findByIdAndUpdate(m.freelancer, {
            isBanned: true,
            banReason: `Repeated deadline misses (${freelancer.penaltyCount}×). Contact support to restore access.`
          });
        }

        // Auto-raise dispute if deadline missed by more than 3 days
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        if (new Date(m.deadline) <= threeDaysAgo) {
          const existing = await Dispute.findOne({ milestone: m._id, type: 'deadline_breach' });
          if (!existing) {
            await Dispute.create({
              milestone: m._id,
              contract: m.contract,
              raisedBy: m.client,
              type: 'deadline_breach',
              reason: `Freelancer missed submission deadline by 3+ days for "${m.title}"`,
              evidenceSummary: {
                deadlineExtensionCount: m.deadlineExtensions?.length || 0,
                autoCompiled: true,
                compiledAt: new Date()
              }
            });
            await Milestone.findByIdAndUpdate(m._id, { status: 'disputed' });
            console.log(`Deadline breach dispute auto-raised for milestone ${m._id}`);
          }
        }
      } catch (e) {
        console.error(`Submission penalty failed for ${m._id}:`, e.message);
      }
    }
  } catch (err) {
    console.error('Submission penalty cron error:', err.message);
  }
});

// Connect MongoDB and start server
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
