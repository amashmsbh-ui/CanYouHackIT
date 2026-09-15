const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { authenticateToken } = require('../routes/auth');

// Create a Razorpay Order
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.body;
    
    const trip = await req.prisma.trip.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.fare <= 0) {
      return res.status(400).json({ error: 'Invalid trip fare' });
    }

    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: trip.fare, // amount in smallest currency unit (paise)
      currency: "INR",
      receipt: `rcpt_${tripId}_${req.user.userId}`.substring(0, 40)
    };

    const order = await instance.orders.create(options);

    // Store payment in database
    await req.prisma.payment.create({
      data: {
        userId: req.user.userId,
        amount: order.amount,
        currency: order.currency,
        status: 'CREATED',
        gatewayOrderId: order.id,
      }
    });

    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Verify Payment and Create Booking
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { gatewayOrderId, gatewayPaymentId, gatewaySignature, tripId } = req.body;
    
    // Verify Signature
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                                    .update(gatewayOrderId + "|" + gatewayPaymentId)
                                    .digest('hex');
                                    
    if (expectedSignature !== gatewaySignature) {
      await req.prisma.payment.updateMany({
        where: { gatewayOrderId },
        data: { status: 'FAILED' }
      });
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const userId = req.user.id || req.user.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated or session invalid.' });
    }

    // Process Booking inside a transaction
    const result = await req.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { gatewayOrderId }
      });
      
      if (!payment || payment.status === 'PAID') {
        throw new Error('Invalid or already processed payment');
      }

      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: { bookings: { where: { status: 'CONFIRMED' } } }
      });

      if (!trip || trip.bookings.length >= trip.capacity) {
        throw new Error('Trip not found or fully booked');
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error('User account not found. Please log in again.');
      }

      const existingBooking = await tx.booking.findFirst({
        where: { userId, tripId, status: { in: ['CONFIRMED', 'BOARDED'] } }
      });

      if (existingBooking) {
         throw new Error('Already booked this trip');
      }

      // Assign seat
      const occupiedSeats = trip.bookings.map(b => b.seatNumber).filter(s => s !== null);
      let seatNumber = 1;
      while (occupiedSeats.includes(seatNumber)) {
        seatNumber++;
      }

      const bookingReference = 'BKG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const booking = await tx.booking.create({
        data: {
          bookingReference,
          userId,
          tripId,
          seatNumber
        }
      });

      // Update payment
      await tx.payment.update({
        where: { id: payment.id },
        data: { 
          status: 'PAID',
          gatewayPaymentId,
          gatewaySignature,
          bookingId: booking.id
        }
      });

      const ticketNumber = 'TKT-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const qrPayload = JSON.stringify({ ticketNumber, bookingReference, tripId });

      const ticket = await tx.ticket.create({
        data: {
          ticketNumber,
          bookingId: booking.id,
          userId,
          tripId,
          qrPayload
        }
      });

      // Create Notification
      await tx.notification.create({
        data: {
          userId,
          type: 'BOOKING_CONFIRMED',
          title: 'Booking Confirmed',
          message: `Your booking for trip is confirmed. Seat: ${seatNumber}`,
          bookingId: booking.id,
          tripId: trip.id
        }
      });

      return { booking, ticket, payment, trip, confirmedBookingsCount: occupiedSeats.length };
    });

    // Notify clients about capacity change (Real-time sync)
    const { trip, confirmedBookingsCount } = result;
    const availableSeats = trip.capacity - (confirmedBookingsCount + 1);
    req.io.emit('trip.capacity.updated', { tripId, availableSeats, totalCapacity: trip.capacity });
    req.io.to(`user_${userId}`).emit('notification.new');

    res.json({ success: true, booking: result.booking, ticket: result.ticket });

  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// Demo-mode confirm: creates a real Booking + Ticket after the Razorpay
// payment link is opened, without needing a signature (demo only).
router.post('/demo-confirm', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User session invalid. Please log in again.' });
    }

    const result = await req.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User session invalid. Please log in again.');

      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: { bookings: { where: { status: 'CONFIRMED' } } }
      });

      if (!trip) throw new Error('Trip not found or expired. Please refresh the dashboard.');
      if (trip.bookings.length >= trip.capacity) throw new Error('Trip is fully booked');

      // Prevent duplicate booking (use findFirst to avoid compound-key issues)
      const existing = await tx.booking.findFirst({
        where: { userId, tripId, status: { in: ['CONFIRMED', 'BOARDED'] } }
      });
      if (existing) throw new Error('You already have a booking for this trip');

      // Assign next available seat
      const occupied = trip.bookings.map(b => b.seatNumber).filter(Boolean);
      let seat = 1;
      while (occupied.includes(seat)) seat++;

      const bookingReference = 'BKG-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      const booking = await tx.booking.create({
        data: {
          bookingReference,
          userId,
          tripId,
          seatNumber: seat,
          status:     'CONFIRMED',
        }
      });

      // Record a demo payment
      await tx.payment.create({
        data: {
          userId,
          bookingId: booking.id,
          amount:    trip.fare || 2000,
          currency:  'INR',
          status:    'PAID',
          gateway:   'razorpay_demo_link',
        }
      });

      const ticketNumber = 'TKT-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const qrPayload = JSON.stringify({ ticketNumber, bookingReference, tripId });

      const ticket = await tx.ticket.create({
        data: {
          ticketNumber,
          bookingId: booking.id,
          userId,
          tripId,
          qrPayload,
          status:    'ACTIVE',
        }
      });

      await tx.notification.create({
        data: {
          userId,
          type:      'BOOKING_CONFIRMED',
          title:     'Booking Confirmed',
          message:   `Your seat (${seat}) is confirmed. Ticket: ${ticketNumber}`,
          bookingId: booking.id,
          tripId,
        }
      });

      return { booking, ticket };
    });

    // Real-time seat update
    req.io.emit('trip.capacity.updated', { tripId });
    req.io.to(`user_${req.user.id}`).emit('notification.new');

    res.json({ success: true, booking: result.booking, ticket: result.ticket });
  } catch (err) {
    console.error('demo-confirm error:', err.message);
    res.status(400).json({ error: err.message || 'Internal Server Error' });
  }
});

module.exports = router;
