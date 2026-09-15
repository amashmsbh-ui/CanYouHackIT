const xlsx = require('xlsx');
const bcrypt = require('bcrypt');
const path = require('path');

function getISTDateString(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

async function autoInitDatabase(prisma) {
  try {
    console.log('[DB Init] Checking database state on startup...');

    // 1. Ensure Conductor Account exists
    const conductorEmail = 'conductor@iiitdmj.ac.in';
    const existingConductor = await prisma.user.findUnique({ where: { email: conductorEmail } });
    if (!existingConductor) {
      console.log('[DB Init] Creating default Conductor account...');
      const conductorHash = await bcrypt.hash('124421', 10);
      await prisma.user.create({
        data: {
          name: 'Main Conductor',
          rollNumber: 'CONDUCTOR',
          email: conductorEmail,
          passwordHash: conductorHash,
          role: 'CONDUCTOR',
          mustChangePassword: false,
          active: true
        }
      });
      console.log('[DB Init] Conductor account created (conductor@iiitdmj.ac.in / 124421).');
    }

    // 2. Check if students need to be imported
    const userCount = await prisma.user.count();
    if (userCount <= 2) {
      console.log(`[DB Init] Only ${userCount} user(s) found. Auto-importing students from Excel...`);
      const filePath = path.join(__dirname, '../../DATABASE 25 (3).xlsx');
      try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet);

        if (rawData.length > 0) {
          const firstRow = rawData[0];
          let rollCol, nameCol, emailCol;
          for (let key of Object.keys(firstRow)) {
            const kLower = key.toLowerCase();
            if (kLower.includes('roll')) rollCol = key;
            else if (kLower.includes('name')) nameCol = key;
            else if (kLower.includes('email')) emailCol = key;
          }

          if (!rollCol || !nameCol || !emailCol) {
            const keys = Object.keys(firstRow);
            nameCol = nameCol || keys[0];
            rollCol = rollCol || keys[1];
            emailCol = emailCol || keys[2];
          }

          let imported = 0;
          for (let row of rawData) {
            let rollNumber = String(row[rollCol] || '').trim().toUpperCase();
            let name = String(row[nameCol] || '').trim();
            let email = String(row[emailCol] || '').trim().toLowerCase();

            if (!email || !rollNumber || !name || !email.endsWith('@iiitdmj.ac.in')) continue;

            const existing = await prisma.user.findFirst({
              where: { OR: [{ email }, { rollNumber }] }
            });

            if (!existing) {
              const passwordHash = await bcrypt.hash(rollNumber.toLowerCase(), 10);
              await prisma.user.create({
                data: {
                  rollNumber,
                  name,
                  email,
                  passwordHash,
                  role: 'STUDENT',
                  mustChangePassword: true,
                  active: true
                }
              });
              imported++;
            }
          }
          console.log(`[DB Init] Successfully auto-imported ${imported} students from Excel.`);
        }
      } catch (excelErr) {
        console.warn('[DB Init] Could not read Excel file:', excelErr.message);
      }
    }

    // 3. Ensure Default Bus and Route exist
    const bus = await prisma.bus.upsert({
      where: { busNumber: 'BUS-01' },
      update: {},
      create: {
        busNumber: 'BUS-01',
        registrationNumber: 'MP20 ZL1297',
        capacity: 50
      }
    });

    let route = await prisma.route.findFirst({
      where: { name: 'Institute → Sadar via Russel Chowk' }
    });
    if (!route) {
      route = await prisma.route.create({
        data: {
          name: 'Institute → Sadar via Russel Chowk',
          origin: 'Institute Main Gate',
          destination: 'Sadar Cantt Market'
        }
      });
    }

    // 4. Check if trips exist for today
    const todayIST = getISTDateString(0);
    const tripsCount = await prisma.trip.count({
      where: { tripDate: todayIST }
    });

    if (tripsCount === 0) {
      console.log('[DB Init] No trips found for today. Generating hourly trips...');
      for (let d = 0; d <= 7; d++) {
        const dateStr = getISTDateString(d);
        for (let hour = 0; hour < 24; hour++) {
          const departureTime = `${hour.toString().padStart(2, '0')}:00`;
          const departureDT = new Date(`${dateStr}T${departureTime}:00+05:30`);
          const bookingOpenAt = new Date(departureDT.getTime() - 2 * 60 * 60 * 1000);
          const bookingCloseAt = departureDT;

          if (bookingCloseAt < new Date()) continue;

          await prisma.trip.create({
            data: {
              routeId: route.id,
              busId: bus.id,
              tripDate: dateStr,
              departureTime,
              arrivalTime: null,
              tripType: 'OUTBOUND',
              capacity: 50,
              fare: 2000,
              status: 'SCHEDULED',
              bookingOpenAt,
              bookingCloseAt
            }
          }).catch(() => {});
        }
      }
      console.log('[DB Init] Trips seeded for today + 7 days.');
    }

    console.log('[DB Init] Database initialization complete.');
  } catch (err) {
    console.error('[DB Init] Error during database initialization:', err);
  }
}

module.exports = autoInitDatabase;
