const base = 'http://127.0.0.1:3000';

async function hit(method, path, body, headers = {}) {
  const r = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.text();
  let p; try { p = JSON.parse(t); } catch { p = t; }
  return { status: r.status, body: p };
}

(async () => {
  // BUG-02 verification
  console.log('=== BUG-02: XSS payload in fullName ===');
  let r = await hit('POST', '/api/signup', {
    fullName: '<script>alert(1)</script>', username: 'xsstest' + Date.now(),
    org: 'O', email: 'xss' + Date.now() + '@x.com', phone: '9876543210',
    dob: '2000-01-01', password: 'StrongP@ss123', confirmPassword: 'StrongP@ss123'
  });
  console.log('  status:', r.status, '(expected 400)');
  console.log('  message:', r.body.message);
  console.log('  RESULT:', r.status === 400 ? 'PASS ✓ — XSS blocked' : 'FAIL ✗');

  console.log('\n=== BUG-02: Valid fullName still works ===');
  r = await hit('POST', '/api/signup', {
    fullName: 'John O\'Brien', username: 'johntest' + Date.now(),
    org: 'O', email: 'john' + Date.now() + '@x.com', phone: '9876543210',
    dob: '2000-01-01', password: 'StrongP@ss123', confirmPassword: 'StrongP@ss123'
  });
  console.log('  status:', r.status, '(expected 201)');
  console.log('  RESULT:', r.status === 201 ? 'PASS ✓' : 'FAIL ✗');

  // BUG-03 verification
  console.log('\n=== BUG-03: Missing header → expect 403 (not 401) ===');
  r = await hit('GET', '/api/admin/stats', null, { 'x-admin-user': '' });
  console.log('  status:', r.status, '(expected 403)');
  console.log('  message:', r.body.message);
  console.log('  RESULT:', r.status === 403 ? 'PASS ✓ — consistent 403' : 'FAIL ✗');

  console.log('\n=== BUG-03: No header at all → expect 403 ===');
  r = await fetch(base + '/api/admin/stats');
  const t = await r.text(); let p; try { p = JSON.parse(t); } catch { p = t; }
  console.log('  status:', r.status, '(expected 403)');
  console.log('  RESULT:', r.status === 403 ? 'PASS ✓' : 'FAIL ✗');

  console.log('\n=== BUG-03: Unknown user → still 403 ===');
  r = await hit('GET', '/api/admin/stats', null, { 'x-admin-user': 'nobody_xyz' });
  console.log('  status:', r.status, '(expected 403)');
  console.log('  RESULT:', r.status === 403 ? 'PASS ✓' : 'FAIL ✗');

  console.log('\n=== Sanity: real admin still works ===');
  r = await hit('GET', '/api/admin/stats', null, { 'x-admin-user': 'tejeshwar' });
  console.log('  status:', r.status, '(expected 200)');
  console.log('  RESULT:', r.status === 200 ? 'PASS ✓' : 'FAIL ✗');
})();
