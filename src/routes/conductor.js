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
    // Extract possible identifiers from payload
    let tkt = null;
    let bookingRef = null;
    let ticketId = null;

    if (typeof qrPayload === 'string') {
      const trimmed = qrPayload.trim();
      
      // Check if it's a URL like .../ticket-qr.html?id=xxx
      if (trimmed.includes('?id=')) {
        try {
          const u = new URL(trimmed.startsWith('http') ? trimmed : `http://dummy.com/${trimmed}`);
          ticketId = u.searchParams.get('id');
        } catch (e) {}
      }

      // Check if it's JSON
      if (!ticketId) {
        try {
          const parsed = JSON.parse(trimmed);
          tkt = parsed.ticketNumber || parsed.tkt || null;
          bookingRef = parsed.bookingReference || parsed.ref || null;
          ticketId = parsed.ticketId || parsed.id || null;
        } catch (e) {
          // Plain string - could be ticketNumber or bookingReference or UUID
          if (trimmed.startsWith('TKT-')) tkt = trimmed;
          else if (trimmed.startsWith('BKG-')) bookingRef = trimmed;
          else tkt = trimmed;
        }
      }
    } else if (typeof qrPayload === 'object' && qrPayload !== null) {
      tkt = qrPayload.ticketNumber || qrPayload.tkt || null;
      bookingRef = qrPayload.bookingReference || qrPayload.ref || null;
      ticketId = qrPayload.ticketId || qrPayload.id || null;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Find ticket using any matching identifier
      const orConditions = [];
      if (tkt) {
        orConditions.push({ ticketNumber: tkt });
        orConditions.push({ qrPayload: { contains: tkt } });
      }
      if (ticketId) {
        orConditions.push({ id: ticketId });
      }
      if (bookingRef) {
        orConditions.push({ booking: { bookingReference: bookingRef } });
        orConditions.push({ qrPayload: { contains: bookingRef } });
      }
      if (typeof qrPayload === 'string') {
        orConditions.push({ qrPayload: qrPayload.trim() });
      }

      const ticket = await tx.ticket.findFirst({
        where: {
          OR: orConditions.length > 0 ? orConditions : undefined
        },
        include: { user: true, trip: { include: { route: true, bus: true } }, booking: true }
      });

      if (!ticket) throw new Error('Ticket not found in system.');
      if (ticket.status === 'BOARDED') throw new Error(`Ticket already boarded on ${ticket.boardedAt ? new Date(ticket.boardedAt).toLocaleTimeString() : 'earlier'}.`);
      if (ticket.status !== 'ACTIVE') throw new Error(`Invalid ticket status: ${ticket.status}`);
      
      // Only block explicitly cancelled trips.
      if (ticket.trip.status === 'CANCELLED') {
        throw new Error('This trip has been cancelled.');
      }

      const now = new Date();

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
          details: `Conductor verified ticket ${ticket.ticketNumber} for student ${ticket.user.rollNumber}`
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
      trip: result.trip.route ? result.trip.route.name : 'Campus Transit'
    });

  } catch (error) {
    console.error(error);
    // Explicitly return a 200 with INVALID status for the conductor UX to show the error nicely
    res.json({ message: 'INVALID', reason: error.message });
  }
});

module.exports = router;
