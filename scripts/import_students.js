const xlsx = require('xlsx');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');

async function importStudents() {
  try {
    const filePath = path.join(__dirname, '../DATABASE 25 (3).xlsx');
    console.log(`Reading Excel file from ${filePath}...`);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet);
    
    console.log(`Found ${rawData.length} rows in the first sheet.`);
    if (rawData.length === 0) {
      console.log('Sheet is empty. Exiting.');
      return;
    }

    // Try to determine column mapping by looking at the first row keys
    const firstRow = rawData[0];
    let rollCol, nameCol, emailCol;
    for (let key of Object.keys(firstRow)) {
      const kLower = key.toLowerCase();
      if (kLower.includes('roll')) rollCol = key;
      else if (kLower.includes('name')) nameCol = key;
      else if (kLower.includes('email')) emailCol = key;
    }
    
    console.log(`Mapped Columns - Roll: ${rollCol}, Name: ${nameCol}, Email: ${emailCol}`);

    if (!rollCol || !nameCol || !emailCol) {
      console.log("Could not auto-detect columns. Please verify Excel headers. Trying fallbacks.");
      // fallback
      const keys = Object.keys(firstRow);
      nameCol = nameCol || keys[0];
      rollCol = rollCol || keys[1];
      emailCol = emailCol || keys[2];
    }

    let imported = 0, duplicates = 0, invalid = 0;
    
    // Hash password for default student password (roll number in lowercase, or generic)
    const genericPasswordHash = await bcrypt.hash('password123', 10);

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      let rollNumber = String(row[rollCol] || '').trim().toUpperCase();
      let name = String(row[nameCol] || '').trim();
      let email = String(row[emailCol] || '').trim().toLowerCase();

      if (!email || !rollNumber || !name) {
        invalid++;
        continue;
      }

      // Must be an IIITDMJ email
      if (!email.endsWith('@iiitdmj.ac.in')) {
        invalid++;
        continue;
      }

      // Check if user exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { rollNumber }
          ]
        }
      });

      if (existingUser) {
        duplicates++;
        continue;
      }

      // Use lower-cased roll number as default password
      const passwordHash = await bcrypt.hash(rollNumber.toLowerCase(), 10);

      await prisma.user.create({
        data: {
          rollNumber,
          name,
          email,
          passwordHash,
          role: 'STUDENT',
          active: true
        }
      });
      
      imported++;
      if (imported % 50 === 0) {
        console.log(`Imported ${imported} students...`);
      }
    }

    console.log(`\n--- IMPORT COMPLETE ---`);
    console.log(`Total Records: ${rawData.length}`);
    console.log(`Successfully Imported: ${imported}`);
    console.log(`Duplicates (Skipped): ${duplicates}`);
    console.log(`Invalid Records (Skipped): ${invalid}`);
    
    // Create conductor account
    const existingConductor = await prisma.user.findUnique({ where: { email: 'conductor@iiitdmj.ac.in' } });
    if (!existingConductor) {
      const conductorHash = await bcrypt.hash('124421', 10);
      await prisma.user.create({
        data: {
          name: 'Main Conductor',
          rollNumber: 'CONDUCTOR',
          email: 'conductor@iiitdmj.ac.in', // Using an internal valid-looking email
          passwordHash: conductorHash,
          role: 'CONDUCTOR',
          active: true
        }
      });
      console.log('Conductor account created.');
    }

  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importStudents();
