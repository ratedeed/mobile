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
const User = require('./models/User'); // Import User model
const asyncHandler = require('express-async-handler'); // Import asyncHandler

const app = express();
const http = require('http'); // Import http module
const server = http.createServer(app); // Create HTTP server
const { Server } = require('socket.io'); // Import Socket.IO Server
const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

// 1) JSON + CORS middleware
app.use(express.json());
app.use(cors({
  origin: ['https://ratedeed.com', 'https://api.ratedeed.com', 'http://localhost:8081', 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Super-aggressive diagnostic: Log all incoming requests
app.use((req, res, next) => {
  console.log(`Backend: Global Request Logger - ${req.method} ${req.originalUrl}`);
  next();
});

// 2) Mount all your API routes *before* any static/catch-all
// Ensure user routes are mounted early to avoid being caught by general API catch-all
console.log('Backend: Attempting to mount user routes at /api/users');
app.use('/api/users', (req, res, next) => {
  console.log(`Backend: User Route Specific Logger - ${req.method} ${req.originalUrl}`);
  next();
}, userRoutes);
console.log('Backend: User routes mounted at /api/users');

app.use('/api/auth', authRoutes);
console.log('Backend: Auth routes mounted at /api/auth');
app.use('/api/contractors', contractorRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/posts', postRoutes);

// Health/Version endpoint for debugging
app.get('/api/version', (req, res) => {
  console.log('Backend: /api/version endpoint hit.');
  res.json({
    name: process.env.BACKEND_NAME || 'ratedeed-backend',
    version: '1.0.0', // You might want to manage this dynamically
    timestamp: new Date().toISOString()
  });
});

// 3) (Optional) Serve any static files you own, e.g. images
app.use('/img', express.static(path.join(__dirname, 'img')));

// Diagnostic: Log before catch-all route - moved after all specific API routes
app.use('/api/*', (req, res, next) => {
  console.log(`Backend: Catch-all /api/* hit for ${req.method} ${req.originalUrl}. No specific route handled it.`);
  next();
});

// 4) Finally, any routes you don’t recognize — return JSON 404, not HTML - moved after all specific API routes
app.all('/api/*', (req, res) => {
  console.log(`Backend: Final 404 for ${req.method} ${req.originalUrl}.`);
  res.status(404).json({ message: 'API endpoint not found' });
});

// Error handling middleware - moved after all specific API routes
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

// 5) If you’re serving a frontend build (Next/React), do *that* last:
//    app.use(express.static(path.join(__dirname, '../frontend/build')));
//    app.get('*', (req, res) => {
//      res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
//    });

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Base URL: /api`);
});

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: ['https://ratedeed.com', 'https://api.ratedeed.com', 'http://localhost:8081', 'http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store active users and their socket IDs
const activeUsers = new Map(); // Map: userId -> { socketId, lastSeen }

io.on('connection', (socket) => {
  console.log('Backend: A user connected via socket:', socket.id);

  socket.on('register', (userId) => {
    console.log(`Backend: User ${userId} registered with socket ID ${socket.id}`);
    activeUsers.set(userId, { socketId: socket.id, lastSeen: new Date() });
    socket.join(userId); // Join a room named after the user's ID
    console.log(`Backend: Socket ${socket.id} joined room ${userId}`);
    console.log('Backend: Current active users map after register:', Array.from(activeUsers.entries()));
    // Broadcast online status to all connected clients
    io.emit('userOnlineStatus', { userId, isOnline: true });
  });

  socket.on('joinConversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`Backend: Socket ${socket.id} joined conversation room: ${conversationId}`);
  });

  socket.on('leaveConversation', (conversationId) => {
    socket.leave(conversationId);
    console.log(`Backend: Socket ${socket.id} left conversation room: ${conversationId}`);
  });

  socket.on('typing', ({ conversationId, userId, isTyping }) => {
    // Broadcast typing status to other participants in the conversation room
    socket.to(conversationId).emit('typing', { userId, isTyping });
    console.log(`Backend: User ${userId} is ${isTyping ? 'typing' : 'not typing'} in conversation ${conversationId}`);
  });

  socket.on('messageRead', async ({ messageId, readerId }) => {
    try {
      const message = await Message.findById(messageId);
      if (message && message.recipientId.toString() === readerId && !message.read) {
        message.read = true;
        await message.save();
        // Emit to the sender of the message that it has been read
        io.to(message.senderId.toString()).emit('messageRead', { messageId, conversationId: message.conversation.toString(), readerId });
        console.log(`Backend: Message ${messageId} marked as read by ${readerId}. Emitted to sender.`);
      }
    } catch (error) {
      console.error('Backend: Error marking message as read via socket:', error.stack);
    }
  });

  socket.on('disconnect', () => {
    console.log('Backend: User disconnected via socket:', socket.id);
    let disconnectedUserId = null;
    // Remove disconnected user from activeUsers map
    for (let [userId, userInfo] of activeUsers.entries()) {
      if (userInfo.socketId === socket.id) {
        activeUsers.delete(userId);
        disconnectedUserId = userId;
        console.log(`Backend: User ${userId} removed from active users.`);
        break;
      }
    }
    console.log('Backend: Current active users map after disconnect:', Array.from(activeUsers.entries()));
    if (disconnectedUserId) {
      // Broadcast offline status to all connected clients
      io.emit('userOnlineStatus', { userId: disconnectedUserId, isOnline: false });
    }
  });
});

// Make io and activeUsers available to routes
app.set('socketio', io);
app.set('activeUsers', activeUsers);