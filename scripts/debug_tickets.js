const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Get the 3 most recent tickets
  const tickets = await p.ticket.findMany({
    take: 3,
    orderBy: { issuedAt: 'desc' },
    include: {
      booking: { select: { bookingReference: true, seatNumber: true, status: true } },
      user:    { select: { name: true, email: true, role: true } },
      trip:    { select: { tripDate: true, departureTime: true, status: true } },
    }
  });

  console.log('=== Latest Tickets ===');
  for (const t of tickets) {
    console.log(`\nTicket: ${t.ticketNumber}`);
    console.log(`Status: ${t.status}`);
    console.log(`qrPayload: ${t.qrPayload}`);
    console.log(`User: ${t.user.name} (${t.user.role})`);
    console.log(`Trip: ${t.trip.tripDate} ${t.trip.departureTime} [${t.trip.status}]`);
    console.log(`Booking: ref=${t.booking.bookingReference}, seat=${t.booking.seatNumber}, status=${t.booking.status}`);
  }
  await p.$disconnect();
}

main().catch(console.error);
