const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');

// Middleware to ensure the user is a conductor or admin
const requireConductor = (req, res, next) => {
  if (req.user.role !== 'CONDUCTOR' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Conductor role required.' });
  }
  next();
};

// Get today's trips and their passenger lists
router.get('/trips', authenticateToken, requireConductor, async (req, res) => {
  try {
    const { prisma } = req;
    
    const todayISO = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata'
    }).format(new Date());
    
    const trips = await prisma.trip.findMany({
      where: {
        status: { in: ['SCHEDULED', 'ACTIVE'] },
        tripDate: todayISO
      },
      include: {
        route: true,
        bus: true,
        tickets: {
          where: { status: { in: ['ACTIVE', 'BOARDED'] } },
          include: { user: true, booking: true }
        }
      },
      orderBy: { departureTime: 'asc' }
    });

    res.json(trips);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Verify and Board a Ticket
router.post('/verify', authenticateToken, requireConductor, async (req, res) => {
  const { qrPayload } = req.body;
  const { prisma, io } = req;

  if (!qrPayload) {
    return res.status(400).json({ error: 'QR Payload is required.' });
  }

  try {
    // Accept full QR JSON payload or a bare ticket number string.
    let payloadData;
    try {
      payloadData = JSON.parse(qrPayload);
    } catch (e) {
      payloadData = { ticketNumber: String(qrPayload).trim() };
    }

    // QR payload stores key as `ticketNumber`; support legacy `tkt` too.
    const tkt = payloadData.ticketNumber || payloadData.tkt || String(qrPayload).trim();
    const bookingRef = payloadData.bookingReference || payloadData.ref || null;

    const result = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { ticketNumber: tkt },
        include: { user: true, trip: { include: { route: true } }, booking: true }
      });

      if (!ticket) throw new Error('Ticket not found in system.');
      if (bookingRef && ticket.booking.bookingReference !== bookingRef) throw new Error('Ticket signature mismatch.');
      if (ticket.status === 'BOARDED') throw new Error('Ticket already boarded.');
      if (ticket.status !== 'ACTIVE') throw new Error(`Invalid ticket status: ${ticket.status}`);
      
      const now = new Date();
      // Expiry window: 90 minutes after scheduled departure (demo-friendly).
      const departureMs = new Date(`${ticket.trip.tripDate}T${ticket.trip.departureTime}:00+05:30`).getTime();
      const expiresAt = ticket.validUntil
        ? new Date(ticket.validUntil)
        : new Date(departureMs + 90 * 60 * 1000);
      if (now > expiresAt) {
        await tx.ticket.update({ where: { id: ticket.id }, data: { status: 'EXPIRED' } });
        await tx.booking.update({ where: { id: ticket.bookingId }, data: { status: 'EXPIRED' } });
        throw new Error('Ticket expired: boarding window has closed.');
      }
      // Only block explicitly cancelled trips.
      if (ticket.trip.status === 'CANCELLED') {
        throw new Error('This trip has been cancelled.');
      }

      // Mark as boarded
      const seatNumber = ticket.booking.seatNumber;
      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'BOARDED',
          boardedAt: now,
          verifiedAt: now,
          verifiedBy: req.user.id
        }
      });

      await tx.booking.update({
        where: { id: ticket.bookingId },
        data: { status: 'BOARDED' }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          action: 'TICKET_BOARDED',
          userId: req.user.id,
          details: `Conductor verified ticket ${tkt} for student ${ticket.user.rollNumber}`
        }
      });

      return { ticket: updatedTicket, seatNumber, passenger: ticket.user, trip: ticket.trip };
    });

    // Notify client via websocket
    io.to(`user_${result.passenger.id}`).emit('ticket.boarded', { ticketId: result.ticket.id });
    io.emit('trip.passengers.updated', { tripId: result.trip.id }); // Tell conductor screens to update

    res.json({
      message: 'VALID',
      passenger: result.passenger.name,
      rollNumber: result.passenger.rollNumber,
      seat: result.seatNumber,
      trip: result.trip.route.name
    });

  } catch (error) {
    console.error(error);
    // Explicitly return a 200 with INVALID status for the conductor UX to show the error nicely
    res.json({ message: 'INVALID', reason: error.message });
  }
});

module.exports = router;
