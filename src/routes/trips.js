const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');

const { generateDailyTrips } = require('../services/scheduler');

// Get all trips for today (24 hourly trips)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { prisma } = req;
    
    const todayISO = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata'
    }).format(new Date());
    
    let trips = await prisma.trip.findMany({
      where: {
        tripDate: todayISO,
      },
      include: {
        route: true,
        bus: true,
        _count: {
          select: { bookings: { where: { status: 'CONFIRMED' } } }
        }
      },
      orderBy: {
        departureTime: 'asc'
      }
    });

    // If trips for today don't exist yet, auto-generate all 24 hours immediately
    if (trips.length < 24) {
      await generateDailyTrips(prisma, todayISO);
      trips = await prisma.trip.findMany({
        where: {
          tripDate: todayISO,
        },
        include: {
          route: true,
          bus: true,
          _count: {
            select: { bookings: { where: { status: 'CONFIRMED' } } }
          }
        },
        orderBy: {
          departureTime: 'asc'
        }
      });
    }

    const now = new Date();

    // Map trips to include available capacity and booking window status
    const formattedTrips = trips.map(trip => {
      const bookedCount = trip._count.bookings;
      const availableSeats = Math.max(0, trip.capacity - bookedCount);
      
      const departureAt = new Date(`${trip.tripDate}T${trip.departureTime}:00+05:30`);
      const bookingOpenAt = new Date(departureAt.getTime() - 2 * 60 * 60 * 1000);
      const isBookingOpen = now >= bookingOpenAt && now <= departureAt;
      
      return {
        id: trip.id,
        route: trip.route ? trip.route.name : 'Institute → Sadar via Russel Chowk',
        origin: trip.route ? trip.route.origin : 'Institute Main Gate',
        destination: trip.route ? trip.route.destination : 'Sadar Cantt Market',
        busNumber: trip.bus ? trip.bus.busNumber : 'BUS-01',
        departureTime: trip.departureTime,
        tripDate: trip.tripDate,
        departureAt: departureAt.toISOString(),
        arrivalTime: trip.arrivalTime,
        tripType: trip.tripType,
        totalCapacity: trip.capacity,
        availableSeats,
        isBookingOpen,
        bookingOpenAt: bookingOpenAt.toISOString(),
        bookingCloseAt: departureAt.toISOString(),
        status: trip.status
      };
    });

    res.json(formattedTrips);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
