const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');

// Get all notifications for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { prisma } = req;
    
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        trip: {
          include: { route: true, bus: true }
        }
      }
    });

    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { prisma } = req;

    const notification = await prisma.notification.updateMany({
      where: {
        id: parseInt(id, 10),
        userId: req.user.id
      },
      data: {
        read: true
      }
    });

    res.json({ message: 'Marked as read' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Mark all as read
router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    const { prisma } = req;
    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        read: false
      },
      data: {
        read: true
      }
    });
    res.json({ message: 'All marked as read' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
