const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const contractorRoutes = require('./routes/contractors');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const postRoutes = require('./routes/posts');

const app = express();
app.set('strict routing', false);
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const PORT = process.env.PORT || 5001;

// Connect to database
connectDB();

// JSON + CORS middleware
app.use(express.json());
app.use(cors({
  origin: ['https://ratedeed.com', 'https://www.ratedeed.com', 'https://api.ratedeed.com', 'http://localhost:8081', 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Mount all API routes
// Note: Quote, Job, Lead routes are handled by production API at https://api.ratedeed.com
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/posts', postRoutes);

// Health/Version endpoint
app.get('/api/version', (req, res) => {
  res.json({
    name: process.env.BACKEND_NAME || 'ratedeed-mobile-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Serve static files
app.use('/img', express.static(path.join(__dirname, 'img')));

// 404 handler - pass to production API for unhandled routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found in mobile backend. Use production API.' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mobile backend running on port ${PORT}`);
  console.log(`Note: Quote/Job/Lead calls go to production API at https://api.ratedeed.com`);
});

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: ['https://ratedeed.com', 'https://www.ratedeed.com', 'https://api.ratedeed.com', 'http://localhost:8081', 'http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store active users and their socket IDs
const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log('Backend: A user connected via socket:', socket.id);

  socket.on('register', (userId) => {
    console.log(`Backend: User ${userId} registered with socket ID ${socket.id}`);
    activeUsers.set(userId, { socketId: socket.id, lastSeen: new Date() });
    socket.join(userId);
    io.emit('userOnlineStatus', { userId, isOnline: true });
  });

  socket.on('joinConversation', (conversationId) => {
    socket.join(conversationId);
  });

  socket.on('leaveConversation', (conversationId) => {
    socket.leave(conversationId);
  });

  socket.on('typing', ({ conversationId, userId, isTyping }) => {
    socket.to(conversationId).emit('typing', { userId, isTyping });
  });

  socket.on('messageRead', async ({ messageId, readerId }) => {
    try {
      const Message = require('./models/Message');
      const message = await Message.findById(messageId);
      if (message && message.recipientId.toString() === readerId && !message.read) {
        message.read = true;
        await message.save();
        io.to(message.senderId.toString()).emit('messageRead', { messageId, conversationId: message.conversation.toString(), readerId });
      }
    } catch (error) {
      console.error('Backend: Error marking message as read via socket:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Backend: User disconnected via socket:', socket.id);
    let disconnectedUserId = null;
    for (let [userId, userInfo] of activeUsers.entries()) {
      if (userInfo.socketId === socket.id) {
        activeUsers.delete(userId);
        disconnectedUserId = userId;
        break;
      }
    }
    if (disconnectedUserId) {
      io.emit('userOnlineStatus', { userId: disconnectedUserId, isOnline: false });
    }
  });
});

// Make io and activeUsers available to routes
app.set('socketio', io);
app.set('activeUsers', activeUsers);

module.exports = app;
