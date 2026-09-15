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
 * the active bus and route in the DB.
 */
async function generateDailyTrips(prisma, dateString) {
  let bus = await prisma.bus.findFirst({ where: { active: true } });
  if (!bus) {
    bus = await prisma.bus.upsert({
      where: { busNumber: 'BUS-01' },
      update: { active: true },
      create: {
        busNumber: 'BUS-01',
        registrationNumber: 'MP20 ZL1297',
        capacity: 50,
        active: true
      }
    });
  }

  let route = await prisma.route.findFirst({ where: { active: true } });
  if (!route) {
    route = await prisma.route.create({
      data: {
        name: 'Institute → Sadar via Russel Chowk',
        origin: 'Institute Main Gate',
        destination: 'Sadar Cantt Market',
        active: true
      }
    });
  }

  let created = 0;
  for (let hour = 0; hour < 24; hour++) {
    const departureTime  = `${hour.toString().padStart(2, '0')}:00`;
    const departureDT    = new Date(`${dateString}T${departureTime}:00+05:30`);
    const bookingOpenAt  = new Date(departureDT.getTime() - 2 * 60 * 60 * 1000);
    const bookingCloseAt = departureDT;

    const existing = await prisma.trip.findFirst({
      where: { tripDate: dateString, departureTime, busId: bus.id }
    });
    if (existing) continue;

    const isPast = departureDT < new Date();

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
        status:        isPast ? 'COMPLETED' : 'SCHEDULED',
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
    console.log('[Scheduler] Midnight – generating upcoming trips...');
    try {
      for (let offset = 0; offset <= 7; offset++) {
        const dateStr = getISTDateString(offset);
        await generateDailyTrips(prisma, dateStr);
      }
    } catch (error) {
      console.error('[Scheduler] Daily trip generation failed:', error);
    }
  }, { scheduled: true, timezone: 'Asia/Kolkata' });

  // ── On startup: ensure today + next 7 days have all 24 hourly trips ─────────
  (async () => {
    try {
      for (let offset = 0; offset <= 7; offset++) {
        const dateStr = getISTDateString(offset);
        const count = await generateDailyTrips(prisma, dateStr);
        if (count > 0) {
          console.log(`[Scheduler] Generated ${count} hourly trips for ${dateStr}.`);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Startup trip check failed:', err);
    }
  })();
};

module.exports.generateDailyTrips = generateDailyTrips;
module.exports.getISTDateString = getISTDateString;
