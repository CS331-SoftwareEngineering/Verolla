# Q2 — Test Execution & Defect Analysis
**Project:** Verolla Server Monitoring System  **Date:** 19 April 2026

---

## Q2 (a) — Test Execution Results

All 8 test cases from Q1(b) were executed against the live server using real HTTP requests.

| TC-ID | Scenario | Expected | Actual Result | Status |
|-------|----------|----------|---------------|--------|
| TC-01 | Successful signup | HTTP 201, user created | HTTP 201, user created with role="user", password stored as bcrypt hash | **PASS** |
| TC-02 | Duplicate username rejected | HTTP 400, "Username already taken" | HTTP 400, "Username already taken" | **PASS** |
| TC-03 | Login with correct credentials | HTTP 200, role=admin | HTTP 200, role="admin", `lastLogin` updated | **PASS** |
| TC-04 | Wrong password rejected | HTTP 401 | HTTP 401, "Invalid password" | **PASS** |
| TC-05 | Disabled user blocked | HTTP 403 | HTTP 403, "Account has been deactivated" | **PASS** |
| TC-06 | Admin reaches `/api/admin/stats` | HTTP 200 | HTTP 200, stats object returned (`users:10, admins:1`) | **PASS** |
| TC-07 | Non-admin denied admin endpoint | HTTP 403 | HTTP 403, "Admin access denied" | **PASS** |
| TC-08 | Admin password reset works | HTTP 200, tempPassword + login succeeds | HTTP 200, temp password returned; login with temp password succeeded | **PASS** |

**Summary: 8 / 8 PASS (100%).**

### Evidence (from execution log)
```
--- TC-01 : Successful signup ---            Status : PASS    HTTP 201
--- TC-02 : Duplicate username ---           Status : PASS    HTTP 400
--- TC-03 : Login admin ---                  Status : PASS    HTTP 200  role=admin
--- TC-04 : Wrong password rejected ---      Status : PASS    HTTP 401
--- TC-05 : Disabled user cannot login ---   Status : PASS    HTTP 403
--- TC-06 : Admin reaches /api/admin/stats - Status : PASS    HTTP 200  admins=1
--- TC-07 : Non-admin denied ---             Status : PASS    HTTP 403
--- TC-08 : Admin reset password ---         Status : PASS    HTTP 200  login with temp password OK
Total: 8    Pass: 8    Fail: 0
```

---

## Q2 (b) — Defect Analysis

Three defects were uncovered during exploratory testing.

### BUG-01 — Admin can demote themselves and lock the system out
- **Description:** `POST /api/admin/users/:id/role` does not stop an admin from changing their own role to `user`. If they were the only admin, the system is left with **0 administrators** and the admin console becomes permanently inaccessible through the API.
- **Steps to reproduce:**
  1. Start server with a single admin (`tejeshwar`, id = 1).
  2. `POST /api/admin/users/1/role` with header `x-admin-user: tejeshwar`, body `{"role":"user"}`.
  3. Try `GET /api/admin/stats` with the same header.
- **Expected vs Actual:**
  | | |
  |---|---|
  | Expected | HTTP 400 "Cannot change your own role"; user remains admin |
  | Actual | HTTP 200 `{"success":true}`; user demoted; subsequent admin requests return 403 (lockout). Required direct DB UPDATE to recover. |
- **Severity:** **HIGH**
- **Suggested fix:** Add a self-check and last-admin guard:
  ```js
  if (target.id === req.adminUser.id && role !== 'admin')
      return res.status(400).json({ success:false, message:'Cannot change your own role' });
  if (role === 'user' && adminDAL.stats().admins <= 1)
      return res.status(400).json({ success:false, message:'Cannot demote the last remaining admin' });
  ```

### BUG-02 — Stored XSS via signup `fullName` field
- **Description:** `POST /api/signup` accepts arbitrary HTML/JS in `fullName` without sanitisation. The payload `<script>alert(1)</script>` is persisted to `users.fullName`, opening a Stored-XSS vector for any page that renders the name through `innerHTML`.
- **Steps to reproduce:**
  1. Send signup with `fullName: "<script>alert(1)</script>"` and otherwise valid data.
  2. Inspect the response and the database row.
- **Expected vs Actual:**
  | | |
  |---|---|
  | Expected | HTTP 400 "Full name contains invalid characters"; no row inserted |
  | Actual | HTTP 201 success; row stored verbatim with `<script>` tag intact |
- **Severity:** **MEDIUM**
- **Suggested fix:** Validate input server-side and always escape on render:
  ```js
  const SAFE_NAME_RE = /^[\p{L}\p{N} .,'\-]{2,80}$/u;
  if (!SAFE_NAME_RE.test(fullName.trim()))
      return res.status(400).json({ success:false, message:'Full name contains invalid characters' });
  ```

### BUG-03 — Inconsistent 401 vs 403 in `requireAdmin` middleware
- **Description:** The middleware returns **401 "Admin auth required"** when the `x-admin-user` header is missing/empty but **403 "Admin access denied"** when the header is present with an unknown username. This inconsistency leaks information about whether a username exists and violates RFC 7235 (401 = bad credentials, 403 = authenticated but unauthorised).
- **Steps to reproduce:**
  1. `GET /api/admin/stats` with no `x-admin-user` header.
  2. `GET /api/admin/stats` with `x-admin-user: nonexistent_user`.
- **Expected vs Actual:**
  | | |
  |---|---|
  | Expected | Both cases return HTTP 403 with the same generic message |
  | Actual | Step 1 → HTTP 401 "Admin auth required"; Step 2 → HTTP 403 "Admin access denied" |
- **Severity:** **LOW**
- **Suggested fix:** Collapse both branches in `requireAdmin` to a single 403 response:
  ```js
  if (!u || u.active === 0 || u.role !== 'admin')
      return res.status(403).json({ success:false, message:'Admin access denied' });
  ```

---

## Defect Summary

| Bug ID | Severity | Title |
|--------|----------|-------|
| BUG-01 | **HIGH** | Self-demote causes complete admin lockout |
| BUG-02 | MEDIUM | Stored XSS in signup `fullName` |
| BUG-03 | LOW | Inconsistent 401/403 leaks user existence |
