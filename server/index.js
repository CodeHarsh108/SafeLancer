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
app.use(require('passport').initialize());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/demos', require('./routes/demos'));
app.use('/api/negotiations', require('./routes/negotiations'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/milestones', require('./routes/milestones'));
app.use('/api/files', require('./routes/files'));
app.use('/api/disputes', require('./routes/disputes'));
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/messages', require('./routes/messages'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Socket.io
io.on('connection', (socket) => {
  socket.on('join-room', (contractId) => {
    socket.join(contractId);
  });

  socket.on('join-interview', (meetingRoomId) => {
    socket.join(meetingRoomId);
  });

  socket.on('send-interview-message', (data) => {
    io.to(data.roomId).emit('receive-message', {
      sender: { _id: data.senderId, name: data.senderName },
      senderName: data.senderName,
      text: data.text,
      type: 'text',
      createdAt: new Date()
    });
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
    socket.to(data.contractId).emit('incoming-call', { signal: data.signal, from: data.from });
  });

  socket.on('accept-call', (data) => {
    socket.to(data.contractId).emit('call-accepted', { signal: data.signal });
  });

  socket.on('end-call', (data) => {
    socket.to(data.contractId).emit('call-ended');
  });
});

// Auto-release cron job — runs every hour
cron.schedule('0 * * * *', async () => {
  try {
    const Milestone = require('./models/Milestone');
    const { milestoneTransition } = require('./services/stateMachine');

    const overdue = await Milestone.find({
      status: 'review',
      autoReleaseAt: { $lte: new Date() }
    });

    for (const m of overdue) {
      try {
        // In live mode, payout to freelancer via Razorpay Payouts before releasing
        await milestoneTransition(m._id, 'released');
        console.log(`Auto-released milestone ${m._id}`);
      } catch (e) {
        console.error(`Auto-release failed for ${m._id}:`, e.message);
      }
    }
  } catch (err) {
    console.error('Cron error:', err.message);
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
