
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

// Diagnostic route: Catch all POST requests to /api/auth/*
app.post('/api/auth/*', (req, res, next) => {
  console.log('Backend: Generic /api/auth/* POST route hit.');
  next(); // Pass control to the next matching route
});

app.use('/api/auth', authRoutes);
console.log('Backend: Auth routes mounted at /api/auth'); // Added log
app.use('/api/users', userRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/posts', postRoutes);

// 3) (Optional) Serve any static files you own, e.g. images
app.use('/img', express.static(path.join(__dirname, 'img')));

// 4) Finally, any routes you don’t recognize — return JSON 404, not HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

// 5) If you’re serving a frontend build (Next/React), do *that* last:
//    app.use(express.static(path.join(__dirname, '../frontend/build')));
//    app.get('*', (req, res) => {
//      res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
//    });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

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
  });

  socket.on('disconnect', () => {
    console.log('Backend: User disconnected via socket:', socket.id);
    // Remove disconnected user from activeUsers map
    for (let [userId, userInfo] of activeUsers.entries()) {
      if (userInfo.socketId === socket.id) {
        activeUsers.delete(userId);
        console.log(`Backend: User ${userId} removed from active users.`);
        break;
      }
    }
    console.log('Backend: Current active users map after disconnect:', Array.from(activeUsers.entries()));
  });
});

// Make io and activeUsers available to routes
app.set('socketio', io);
app.set('activeUsers', activeUsers);