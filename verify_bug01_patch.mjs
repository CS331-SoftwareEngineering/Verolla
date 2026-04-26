// Verify BUG-01 patch
const base = 'http://127.0.0.1:3000';
const adminHdr = { 'Content-Type': 'application/json', 'x-admin-user': 'tejeshwar' };

async function hit(method, path, body, headers = adminHdr) {
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let p; try { p = JSON.parse(t); } catch { p = t; }
  return { status: r.status, body: p };
}

(async () => {
  console.log('--- TEST 1: admin tries to demote SELF (id=1) → expect 400 ---');
  let r = await hit('POST', '/api/admin/users/1/role', { role: 'user' });
  console.log('  status:', r.status, '\n  body:', JSON.stringify(r.body));
  console.log('  RESULT:', (r.status === 400 ? 'PASS ✓' : 'FAIL ✗'));

  console.log('\n--- TEST 2: confirm tejeshwar still admin in DB ---');
  r = await hit('GET', '/api/admin/stats');
  console.log('  admins =', r.body.admins, ' → ', (r.body.admins === 1 ? 'PASS ✓' : 'FAIL ✗'));

  console.log('\n--- TEST 3: invalid role value → expect 400 ---');
  r = await hit('POST', '/api/admin/users/2/role', { role: 'superadmin' });
  console.log('  status:', r.status, '\n  body:', JSON.stringify(r.body));
  console.log('  RESULT:', (r.status === 400 ? 'PASS ✓' : 'FAIL ✗'));

  console.log('\n--- TEST 4: promote victim id=2 to admin (should succeed) ---');
  r = await hit('POST', '/api/admin/users/2/role', { role: 'admin' });
  console.log('  status:', r.status, '\n  body:', JSON.stringify(r.body));

  console.log('\n--- TEST 5: now demote victim back to user (should succeed, 2 admins exist) ---');
  r = await hit('POST', '/api/admin/users/2/role', { role: 'user' });
  console.log('  status:', r.status, '\n  body:', JSON.stringify(r.body));
  console.log('  RESULT:', (r.status === 200 ? 'PASS ✓' : 'FAIL ✗'));

  console.log('\n--- TEST 6: try to demote tejeshwar again — last admin guard → expect 400 ---');
  r = await hit('POST', '/api/admin/users/1/role', { role: 'user' });
  console.log('  status:', r.status, '\n  body:', JSON.stringify(r.body));
  console.log('  RESULT:', (r.status === 400 ? 'PASS ✓' : 'FAIL ✗'));

  console.log('\n--- Final admin count ---');
  r = await hit('GET', '/api/admin/stats');
  console.log('  admins =', r.body.admins, '(should be 1)');
})();
