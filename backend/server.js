process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
    console.error(err.name, err.message, err.stack);
    process.exit(1);
});

process.on("unhandledRejection", (err) => {
    console.error("UNHANDLED REJECTION! 💥 Shutting down...");
    console.error(err.name, err.message, err.stack);
    process.exit(1);
});

const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Initialize Cloudinary SDK
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || (process.env.CLOUDINARY_URL ? process.env.CLOUDINARY_URL.split('@')[1] : ''),
  api_key: process.env.CLOUDINARY_API_KEY || (process.env.CLOUDINARY_URL ? process.env.CLOUDINARY_URL.split('://')[1].split(':')[0] : ''),
  api_secret: process.env.CLOUDINARY_API_SECRET || (process.env.CLOUDINARY_URL ? process.env.CLOUDINARY_URL.split(':')[2].split('@')[0] : ''),
  secure: true,
});

// Initialize Firebase Admin SDK for push notifications
const admin = require('firebase-admin');
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY.replace(/\s/g, ''), 'base64').toString('utf8')
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    }, 'ratedeedAdminApp');
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
  }
} else {
  console.warn('FIREBASE_SERVICE_ACCOUNT_KEY not set. Push notifications disabled.');
}

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const contractorRoutes = require('./routes/contractors');
const cloudinaryRoutes = require('./routes/cloudinary');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const postRoutes = require('./routes/posts');
const quoteRoutes = require('./routes/quotes');
const jobRoutes = require('./routes/jobs');
const leadRoutes = require('./routes/leads');

const app = express();
app.set('strict routing', false);
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const PORT = process.env.PORT || 5001;

// Connect to database
connectDB();

// JSON + CORS middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:19006', 'http://localhost:3000', 'capacitor://localhost', 'ionic://localhost'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Mount all API routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/cloudinary', cloudinaryRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/leads', leadRoutes);

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
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`Socket.IO CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store active users and their socket IDs
const activeUsers = new Map();

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('Backend: A user connected via socket:', socket.id, 'User:', socket.userId);

  socket.on('register', (userId) => {
    // Verify the user can only register as themselves
    if (socket.userId && socket.userId !== userId) {
      console.warn(`Backend: Socket register rejected - user ${socket.userId} tried to register as ${userId}`);
      return;
    }
    console.log(`Backend: User ${userId} registered with socket ID ${socket.id}`);
    activeUsers.set(userId, { socketId: socket.id, lastSeen: new Date() });
    socket.join(userId);
    io.emit('userOnlineStatus', { userId, isOnline: true });
  });

  socket.on('joinConversation', async (conversationId) => {
    // Verify user is a participant before joining
    try {
      const Conversation = require('./models/Conversation');
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.some(p => p.toString() === socket.userId)) {
        console.warn(`Backend: User ${socket.userId} blocked from joining conversation ${conversationId}`);
        return;
      }
      socket.join(conversationId);
    } catch (err) {
      console.error('Backend: Error verifying conversation participation:', err.message);
    }
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
