const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey', async (err, decodedUser) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token.' });
    
    try {
      if (req.prisma) {
        const userId = decodedUser.id || decodedUser.userId;
        const dbUser = await req.prisma.user.findUnique({ where: { id: userId } });
        if (!dbUser) {
          return res.status(401).json({ error: 'Session expired or user account not found. Please log in again.' });
        }
        req.user = dbUser;
      } else {
        req.user = decodedUser;
      }
      next();
    } catch (dbErr) {
      req.user = decodedUser;
      next();
    }
  });
};

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { prisma } = req;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, rollNumber: user.rollNumber },
      process.env.JWT_SECRET || 'supersecretjwtkey',
      { expiresIn: '24h' }
    );

    // Audit Log
    await prisma.auditLog.create({
      data: {
        action: 'LOGIN',
        userId: user.id,
        details: `User ${user.email} logged in successfully.`
      }
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        rollNumber: user.rollNumber,
        role: user.role,
        mustChangePassword: user.mustChangePassword
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Self-Registration Route
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, rollNumber } = req.body;
    const { prisma } = req;

    if (!email || !password || !name || !rollNumber) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (!email.toLowerCase().endsWith('@iiitdmj.ac.in')) {
      return res.status(400).json({ error: 'Only @iiitdmj.ac.in emails are allowed.' });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { rollNumber }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or roll number already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        rollNumber,
        mustChangePassword: false, // Since they set it themselves
        role: 'STUDENT'
      }
    });

    res.status(201).json({ message: 'Registration successful. You can now log in.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const { prisma } = req;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (user) {
      const resetToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'supersecretjwtkey',
        { expiresIn: '15m' }
      );
      
      // Since nodemailer isn't fully set up in development to actually send emails to users yet
      // we'll just log it. A real integration would send an email here.
      console.log(`Password reset token for ${user.email}: ${resetToken}`);
    }

    // Always return success to prevent email enumeration
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Reset Password / Change Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, oldPassword, newPassword } = req.body;
    const { prisma } = req;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required.' });
    }

    let userId;

    if (token) {
      // Flow 1: Forgot password with reset token
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey');
        userId = decoded.id;
      } catch (err) {
        return res.status(400).json({ error: 'Invalid or expired reset token.' });
      }
    } else {
      // Flow 2: Authenticated user changing password (e.g., mustChangePassword)
      // For this, we expect the request to be authenticated or provide an email/oldPassword?
      // Since it's a reset/change, maybe they login and it forces a change.
      // So they need a regular auth token.
      const authHeader = req.headers['authorization'];
      const authToken = authHeader && authHeader.split(' ')[1];
      if (!authToken) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
      }

      try {
        const decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'supersecretjwtkey');
        userId = decoded.id;
      } catch (err) {
        return res.status(403).json({ error: 'Invalid token.' });
      }

      // Verify old password if provided (good practice)
      if (oldPassword) {
         const user = await prisma.user.findUnique({ where: { id: userId } });
         const validOld = await bcrypt.compare(oldPassword, user.passwordHash);
         if (!validOld) {
           return res.status(400).json({ error: 'Incorrect old password.' });
         }
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { 
        passwordHash,
        mustChangePassword: false
      }
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get Current User
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { prisma } = req;
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        rollNumber: true,
        role: true,
        active: true,
        mustChangePassword: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
