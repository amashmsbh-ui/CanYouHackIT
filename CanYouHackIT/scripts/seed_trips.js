const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Generates the IST date string (YYYY-MM-DD) for a given offset from today.
 */
function getISTDateString(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

/**
 * Creates 24 hourly trips (00:00 – 23:00) for a given date, route, and bus.
 */
async function createHourlyTripsForDate(route, bus, dateString) {
  const trips = [];

  for (let hour = 0; hour < 24; hour++) {
    const departureTime = `${hour.toString().padStart(2, '0')}:00`;

    // Booking opens 2 hours before departure; closes at departure
    const departureDT  = new Date(`${dateString}T${departureTime}:00+05:30`);
    const bookingOpenAt  = new Date(departureDT.getTime() - 2 * 60 * 60 * 1000);
    const bookingCloseAt = departureDT;

    // Skip creating if the trip is already in the past (departure already happened)
    if (bookingCloseAt < new Date()) continue;

    trips.push(
      prisma.trip.create({
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
      })
    );
  }

  await Promise.all(trips);
  console.log(`  → Created ${trips.length} trip(s) for ${dateString}`);
}

async function seedTrips() {
  try {
    console.log('=== Seeding Hourly Trips ===\n');

    // ── 1. Ensure base Bus & Route exist (upsert pattern) ──────────────────

    const bus = await prisma.bus.upsert({
      where:  { busNumber: 'BUS-01' },
      update: {},
      create: {
        busNumber:          'BUS-01',
        registrationNumber: 'MP20 ZL1297',
        capacity:           50,
      }
    });

    let route = await prisma.route.findFirst({
      where: { name: 'Institute → Sadar via Russel Chowk' }
    });
    if (!route) {
      route = await prisma.route.create({
        data: {
          name:        'Institute → Sadar via Russel Chowk',
          origin:      'Institute Main Gate',
          destination: 'Sadar Cantt Market',
        }
      });
    }

    console.log(`Bus  : ${bus.busNumber} (${bus.registrationNumber})`);
    console.log(`Route: ${route.name}\n`);

    // ── 2. Delete only future SCHEDULED trips (preserve completed/active) ──

    const todayIST = getISTDateString(0);
    await prisma.trip.deleteMany({
      where: {
        status:   'SCHEDULED',
        tripDate: { gte: todayIST },
      }
    });
    console.log('Cleared future SCHEDULED trips.\n');

    // ── 3. Create hourly trips for today + next 7 days ─────────────────────

    for (let d = 0; d <= 7; d++) {
      const dateStr = getISTDateString(d);
      process.stdout.write(`Generating trips for ${dateStr} ...`);
      await createHourlyTripsForDate(route, bus, dateStr);
    }

    console.log('\n=== Seeding Complete! ===');
    console.log('Hourly buses scheduled from 00:00 to 23:00 for today + 7 days.');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seedTrips();
