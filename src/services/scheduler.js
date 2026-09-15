const cron = require('node-cron');

/**
 * Returns IST date string (YYYY-MM-DD) with optional day offset.
 */
function getISTDateString(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

/**
 * Creates 24 hourly trips (00:00 – 23:00) for a given date using
 * the first active bus and route found in the DB.
 */
async function generateDailyTrips(prisma, dateString) {
  const bus = await prisma.bus.findFirst({ where: { active: true } });
  const route = await prisma.route.findFirst({ where: { active: true } });

  if (!bus || !route) {
    console.warn('[Scheduler] No active bus or route found – skipping trip generation.');
    return 0;
  }

  let created = 0;
  for (let hour = 0; hour < 24; hour++) {
    const departureTime  = `${hour.toString().padStart(2, '0')}:00`;
    const departureDT    = new Date(`${dateString}T${departureTime}:00+05:30`);
    const bookingOpenAt  = new Date(departureDT.getTime() - 2 * 60 * 60 * 1000);
    const bookingCloseAt = departureDT;

    // Only create if it doesn't already exist
    const existing = await prisma.trip.findFirst({
      where: { tripDate: dateString, departureTime, busId: bus.id }
    });
    if (existing) continue;

    await prisma.trip.create({
      data: {
        routeId:       route.id,
        busId:         bus.id,
        tripDate:      dateString,
        departureTime,
        arrivalTime:   null,
        tripType:      'OUTBOUND',
        capacity:      50,
        fare:          2000, // ₹20 in paise
        status:        'SCHEDULED',
        bookingOpenAt,
        bookingCloseAt,
      }
    });
    created++;
  }
  return created;
}

module.exports = function (prisma, io) {

  // ── Every minute: expire tickets & mark completed trips ─────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // 1. Mark past SCHEDULED/ACTIVE trips as COMPLETED
      await prisma.trip.updateMany({
        where: {
          status: { in: ['SCHEDULED', 'ACTIVE'] },
          bookingCloseAt: { lt: now }
        },
        data: { status: 'COMPLETED' }
      });

      // 2. Expire tickets past their valid window
      const expiredTickets = await prisma.ticket.updateMany({
        where: {
          status: { in: ['ACTIVE', 'BOARDED'] },
          validUntil: { lte: now }
        },
        data: { status: 'EXPIRED' }
      });

      // 3. Mark bookings whose tickets are expired
      await prisma.booking.updateMany({
        where: {
          status: { in: ['CONFIRMED', 'BOARDED'] },
          ticket: { status: 'EXPIRED' }
        },
        data: { status: 'EXPIRED' }
      });

      if (expiredTickets.count > 0) {
        console.log(`[Scheduler] Expired ${expiredTickets.count} ticket(s).`);
      }
    } catch (error) {
      console.error('[Scheduler] Expiry check failed:', error);
    }
  }, { scheduled: true, timezone: 'Asia/Kolkata' });

  // ── Every midnight IST: generate tomorrow's hourly trips ─────────────────
  cron.schedule('0 0 * * *', async () => {
    console.log('[Scheduler] Midnight – generating tomorrow\'s trips...');
    try {
      const tomorrow = getISTDateString(1);
      const count = await generateDailyTrips(prisma, tomorrow);
      console.log(`[Scheduler] Created ${count} trips for ${tomorrow}.`);
    } catch (error) {
      console.error('[Scheduler] Daily trip generation failed:', error);
    }
  }, { scheduled: true, timezone: 'Asia/Kolkata' });

  // ── On startup: ensure today AND tomorrow already have trips ─────────────
  (async () => {
    try {
      for (const offset of [0, 1]) {
        const dateStr = getISTDateString(offset);
        const existing = await prisma.trip.count({
          where: { tripDate: dateStr, status: 'SCHEDULED' }
        });
        if (existing === 0) {
          console.log(`[Scheduler] No trips found for ${dateStr} – auto-generating...`);
          const count = await generateDailyTrips(prisma, dateStr);
          console.log(`[Scheduler] Created ${count} trip(s) for ${dateStr}.`);
        } else {
          console.log(`[Scheduler] ${existing} scheduled trip(s) already exist for ${dateStr}.`);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Startup trip check failed:', err);
    }
  })();
};
