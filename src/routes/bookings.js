const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');
const crypto = require('crypto');

// Direct booking without payment is no longer allowed.
// See src/routes/payments.js for the payment-verified booking flow.

// Get User's Active Tickets/Bookings
router.get('/my-tickets', authenticateToken, async (req, res) => {
  try {
    const { prisma } = req;
    const now = new Date();
    const tickets = await prisma.ticket.findMany({
      where: {
        userId: req.user.id,
        status: { in: ['ACTIVE', 'BOARDED'] }
      },
      include: {
        trip: {
          include: { route: true, bus: true }
        },
        booking: true
      },
      orderBy: { issuedAt: 'desc' }
    });

    const expiry = ticket => ticket.validUntil || new Date(
      new Date(`${ticket.trip.tripDate}T${ticket.trip.departureTime}:00+05:30`).getTime() + 30 * 60 * 1000
    );
    const expiredIds = tickets.filter(ticket => expiry(ticket) <= now).map(ticket => ticket.id);
    if (expiredIds.length) {
      await prisma.ticket.updateMany({ where: { id: { in: expiredIds } }, data: { status: 'EXPIRED' } });
      await prisma.booking.updateMany({
        where: { userId: req.user.id, ticket: { id: { in: expiredIds } } },
        data: { status: 'EXPIRED' }
      });
    }

    res.json(tickets.filter(ticket => expiry(ticket) > now));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
