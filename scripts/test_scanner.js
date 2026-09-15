// Test the conductor verify endpoint end-to-end
const http = require('http');

const QR_PAYLOAD = '{"ticketNumber":"TKT-6TSSJO7E","bookingReference":"BKG-ORTVKF","tripId":"d781ccdf-144c-41b2-964e-2b02d908826a"}';

async function testLogin(email, password) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email, password });
    const req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function testVerify(token, qrPayload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ qrPayload });
    const req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/conductor/verify', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== Testing Conductor Scanner Flow ===\n');

  // Test 1: Login as conductor
  console.log('1. Logging in as conductor...');
  const conductorLogin = await testLogin('conductor@iiitdmj.ac.in', 'conductor123');
  console.log(`   Status: ${conductorLogin.status}`);
  if (conductorLogin.status !== 200) {
    console.log(`   ERROR: ${JSON.stringify(conductorLogin.body)}`);
    console.log('\n   ⚠️  Conductor login failed! Trying student login instead...');
  } else {
    console.log(`   Token: ${conductorLogin.body.token ? 'OK' : 'MISSING'}`);
    console.log(`   Role: ${conductorLogin.body.user?.role}`);
  }

  const conductorToken = conductorLogin.body.token;

  // Test 2: Verify ticket as conductor
  console.log('\n2. Verifying ticket as conductor...');
  const verifyResult = await testVerify(conductorToken, QR_PAYLOAD);
  console.log(`   Status: ${verifyResult.status}`);
  console.log(`   Response: ${JSON.stringify(verifyResult.body, null, 2)}`);

  // Test 3: Also try as student (should fail role check)
  console.log('\n3. Logging in as student (amashmsbh@iiitdmj.ac.in)...');
  const studentLogin = await testLogin('amashmsbh@iiitdmj.ac.in', 'test123');
  console.log(`   Status: ${studentLogin.status}`);
  if (studentLogin.body.token) {
    const studentVerify = await testVerify(studentLogin.body.token, QR_PAYLOAD);
    console.log(`\n4. Verifying ticket as student...`);
    console.log(`   Status: ${studentVerify.status}`);
    console.log(`   Response: ${JSON.stringify(studentVerify.body)}`);
  } else {
    console.log(`   Could not login as student: ${JSON.stringify(studentLogin.body)}`);
  }
}

main().catch(console.error);
