// Verolla defect probes
const base = 'http://127.0.0.1:3000';
const adminHdr = { 'Content-Type': 'application/json', 'x-admin-user': 'tejeshwar' };

async function hit(method, path, body, headers = adminHdr) {
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: r.status, body: parsed };
}

async function probe(label, fn) {
  try { const r = await fn(); console.log('---', label, '---\n  status:', r.status, '\n  body:', JSON.stringify(r.body)); }
  catch (e) { console.log('---', label, '--- ERROR:', e.message); }
}

(async () => {
  // Probe A — self-disable
  await probe('A. Self-disable (admin disables own account)',
    () => hit('POST', '/api/admin/users/1/active', { active: false }));

  // Probe B — self-demote
  await probe('B. Self-demote (admin demotes self to user)',
    () => hit('POST', '/api/admin/users/1/role', { role: 'user' }));

  // Probe C — self-delete
  await probe('C. Self-delete (admin deletes own account)',
    () => hit('DELETE', '/api/admin/users/1'));

  // Probe D — set arbitrary role string
  await probe('D. Invalid role value ("superadmin")',
    () => hit('POST', '/api/admin/users/2/role', { role: 'superadmin' }));

  // Probe E — admin endpoint with empty header
  await probe('E. Admin endpoint with EMPTY x-admin-user header',
    () => hit('GET', '/api/admin/stats', null, { 'x-admin-user': '' }));

  // Probe F — admin endpoint with NO header at all
  await probe('F. Admin endpoint with NO header at all',
    () => hit('GET', '/api/admin/stats', null, {}));

  // Probe G — Signup with very short password
  await probe('G. Signup with short password (3 chars)',
    () => hit('POST', '/api/signup', {
      fullName: 'Short', username: 'shortpwd' + Date.now(), org: 'O',
      email: 'sp' + Date.now() + '@x.com', phone: '9876543210', dob: '2000-01-01',
      password: 'abc', confirmPassword: 'abc'
    }, { 'Content-Type': 'application/json' }));

  // Probe H — Signup missing field
  await probe('H. Signup with missing fullName',
    () => hit('POST', '/api/signup', {
      username: 'nomiss' + Date.now(), org: 'O',
      email: 'nm' + Date.now() + '@x.com', phone: '9876543210', dob: '2000-01-01',
      password: 'StrongP@ss123', confirmPassword: 'StrongP@ss123'
    }, { 'Content-Type': 'application/json' }));

  // Probe I — XSS attempt in fullName
  await probe('I. Signup with XSS payload in fullName',
    () => hit('POST', '/api/signup', {
      fullName: '<script>alert(1)</script>', username: 'xss' + Date.now(), org: 'O',
      email: 'xss' + Date.now() + '@x.com', phone: '9876543210', dob: '2000-01-01',
      password: 'StrongP@ss123', confirmPassword: 'StrongP@ss123'
    }, { 'Content-Type': 'application/json' }));

  // Probe J — SQL-injection attempt in login identifier
  await probe('J. Login with SQL-injection payload as identifier',
    () => hit('POST', '/api/login', { identifier: "tejeshwar' OR '1'='1", password: 'anything' },
      { 'Content-Type': 'application/json' }));

  // Probe K — Reset password of non-existent user
  await probe('K. Reset password for non-existent user id 99999',
    () => hit('POST', '/api/admin/users/99999/reset-password'));

  // Probe L — Maintenance: purge metrics with negative days
  await probe('L. Purge metrics with negative days (-5)',
    () => hit('POST', '/api/admin/maintenance/purge-metrics', { days: -5 }));

  // Probe M — Verify audit log captured admin actions
  const audit = await hit('GET', '/api/admin/audit?limit=20');
  console.log('--- M. Audit log (latest 20) ---');
  console.log('  status:', audit.status, ' rows:', audit.body.entries ? audit.body.entries.length : 'n/a');
  if (audit.body.entries) {
    audit.body.entries.slice(0, 10).forEach(e =>
      console.log('   ', e.createdAt, '|', e.actor, '|', e.action, '|', e.target || '-'));
  }
})();
