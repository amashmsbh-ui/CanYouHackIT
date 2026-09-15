const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGIN || '*',
  }
});
const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files statically
app.use(express.static(path.join(__dirname, 'frontend')));

// Inject IO into request object so routes can use it
app.use((req, res, next) => {
  req.io = io;
  req.prisma = prisma;
  next();
});

// Real-time connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Clients can join specific rooms (e.g. user-specific rooms for notifications)
  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`Socket ${socket.id} joined room user_${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Import Routes
const authRoutes = require('./src/routes/auth');
const tripsRoutes = require('./src/routes/trips');
const bookingsRoutes = require('./src/routes/bookings');
const paymentsRoutes = require('./src/routes/payments');
const conductorRoutes = require('./src/routes/conductor');
const notificationsRoutes = require('./src/routes/notifications');

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/conductor', conductorRoutes);
app.use('/api/notifications', notificationsRoutes);

// Cron Jobs / Scheduler
require('./src/services/scheduler')(prisma, io);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Fallback for SPA or static routing (serve index.html for root)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
    } else {
        next();
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
