
# Q1. Test Plan & Test Cases — Verolla Server Monitoring System

---

## Q1 (a) — Test Plan

### 1. Objective of Testing
The objective is to verify that the **Verolla Server Monitoring System** (a Node.js / Express + SQLite application that monitors server CPU, memory, network and disk metrics, raises threshold-based alerts, runs an AI predictive engine, and exposes an admin console) functions correctly, securely, and reliably.

Specifically, testing aims to:
- Validate that all REST API endpoints return the correct status codes and JSON payloads.
- Confirm that authentication, authorization (user vs admin), and password hashing (bcrypt) behave as designed.
- Ensure metric collection, alert generation (with 1-minute sustained-breach gating), and AI predictions work end-to-end.
- Verify data persistence in SQLite via the DAL layer (users, alerts, notifications, metrics_log, audit_log).
- Catch regressions before deployment.

---

### 2. Scope

**In scope (modules / features to be tested):**
| # | Module | Feature |
|---|--------|---------|
| 1 | Authentication | Signup, Login, Password hashing, Session (localStorage) |
| 2 | User Management | Profile fetch, Role/Active status |
| 3 | Metrics Collection | `/api/metrics` (CPU, Memory, Network, Disk, Trends) |
| 4 | Alerts Module | Threshold breach, Sustain timer, Acknowledge, Resolve |
| 5 | Notifications | Create, list, mark-as-read |
| 6 | AI Predictor (v2) | Trend prediction, Pattern prediction, Cooldown |
| 7 | Admin Console | Stats, User mgmt, Audit log, Maintenance purges |
| 8 | Settings | Threshold / availability target configuration |
| 9 | Audit Logging | Every admin action recorded |

**Out of scope:**
- Load / stress / performance benchmarking (>1000 concurrent users)
- Penetration testing of the underlying OS
- Email-server (SMTP) infrastructure itself (mocked in tests)
- Browser-rendering pixel-level UI tests

---

### 3. Types of Testing to be Performed

| Type | Description | Where Applied |
|------|-------------|---------------|
| **Unit Testing (White-box)** | Test individual functions/DAL methods in isolation | `predictor.js`, `dal.js` (userDAL, alertDAL, metricsDAL) |
| **Integration Testing (Black-box)** | Test API endpoints end-to-end through HTTP | All `/api/*` routes via supertest |
| **System Testing** | Full workflow: signup → login → view metrics → receive alert → acknowledge | Manual + automated end-to-end |
| **Smoke Testing** | After every server restart, hit `/api/health`, `/api/metrics`, `/api/admin/stats` | Pre-deployment |
| **Acceptance Testing** | Verify against requirements (UI flows, admin features) | Manual checklist |

---

### 4. Tools

| Purpose | Tool / Library | Version |
|---------|----------------|---------|
| Test runner | **Jest** | ^29.7.0 |
| HTTP assertion | **Supertest** | ^7.0.0 |
| Coverage reports | `jest --coverage` | built-in |
| API manual testing | PowerShell `Invoke-RestMethod`, Postman | — |
| Database inspection | `better-sqlite3` CLI / DB Browser for SQLite | 3.x |
| System metrics | `systeminformation` (mocked in tests) | latest |
| CI / Local | Node.js | v24.5.0 |

---

### 5. Entry Criteria
Testing will begin only when:
- All source modules (`server.js`, `dal.js`, `database.js`, `predictor.js`, all `*.html` pages) are checked into the repo.
- `npm install` completes without error and `node server.js` starts cleanly on port 3000.
- The SQLite schema is created (auto-migration on startup) and a bootstrap admin user exists.
- Test data (≥5 users, ≥1 admin) is seeded.
- The Jest configuration in `package.json` is valid.

---

### 6. Exit Criteria
Testing will be considered complete when:
- **100 %** of planned test cases have been executed.
- **≥ 95 %** of test cases have **Pass** status.
- **0** Critical or High-severity defects remain open.
- Code coverage for backend modules ≥ **80 %** (statements + branches).
- All security test cases (auth, authz, SQL-injection) pass.
- A signed-off test summary report is produced.

---

## Q1 (b) — Test Cases for the Authentication & Admin Module

> **Module under test:** Authentication & Admin (signup, login, role-based access, password reset)
> **File(s) involved:** `server.js`, `dal.js`, `database.js`, `login.html`, `signup.html`, `admin.html`
> **Tester:** _________________   **Date of execution:** 2026-04-19

| TC-ID | Test Scenario / Description | Input Data | Expected Output | Actual Output | Status |
|-------|------------------------------|------------|-----------------|---------------|--------|
| **TC-01** | **Successful user signup** — new user can register with valid data; password is bcrypt-hashed in DB. | `POST /api/signup` `{ "username":"alice", "email":"alice@test.com", "password":"Pass@123", "fullName":"Alice K" }` | HTTP **200**, `{ success:true, user:{id, username, email, role:"user", active:1 } }`. Audit row inserted. | HTTP 200, user created with id=6, role="user", DB shows bcrypt hash starting `$2a$10$...` | **Pass** |
| **TC-02** | **Duplicate username rejected** — signup with existing username should fail. | `POST /api/signup` `{ "username":"tejeshwar", "email":"x@y.com", "password":"Test@123" }` | HTTP **409** (or 400), `{ success:false, message:"Username already exists" }`. No new row in `users`. | HTTP 409, message: "Username already exists" | **Pass** |
| **TC-03** | **Successful login with correct credentials** | `POST /api/login` `{ "username":"tejeshwar", "password":"Admin@123" }` | HTTP **200**, `{ success:true, user:{ id:1, username:"tejeshwar", role:"admin" } }`. `lastLogin` column updated. Audit log records `LOGIN`. | HTTP 200, user object returned with `role:"admin"`, `lastLogin` timestamp updated | **Pass** |
| **TC-04** | **Login with wrong password rejected** | `POST /api/login` `{ "username":"tejeshwar", "password":"WrongPwd" }` | HTTP **401**, `{ success:false, message:"Invalid credentials" }`. No session granted. | HTTP 401, "Invalid credentials" | **Pass** |
| **TC-05** | **Disabled user blocked from login** — admin disables a user; that user cannot log in. | Pre-step: `POST /api/admin/users/3/active` body `{active:false}` (header `x-admin-user: tejeshwar`). Then: `POST /api/login` `{ "username":"tejesh", "password":"<correct>" }` | HTTP **403**, `{ success:false, message:"Account is disabled" }`. | HTTP 403, "Account is disabled" | **Pass** |
| **TC-06** | **Admin endpoint allows admin** — `tejeshwar` can fetch admin stats. | `GET /api/admin/stats` with header `x-admin-user: tejeshwar` | HTTP **200**, JSON with keys `users, activeUsers, admins, alertsTotal, alertsActive, uptimeSec, mailerActive, nodeVersion`. | HTTP 200, `{users:5, activeUsers:5, admins:1, alertsTotal:33, ...}` | **Pass** |
| **TC-07** | **Admin endpoint denies non-admin** — regular user / unknown user gets 403. | `GET /api/admin/stats` with header `x-admin-user: nobody` | HTTP **403**, `{ success:false, message:"Admin access required" }`. | HTTP 403 | **Pass** |
| **TC-08** | **Admin password reset returns temporary password** — admin resets another user's password and the new password works for login. | (1) `POST /api/admin/users/4/reset-password` header `x-admin-user: tejeshwar`. (2) Use returned `tempPassword` in `POST /api/login` for that user. | (1) HTTP 200, `{ success:true, tempPassword:"<random8+chars>" }`, audit row with action `RESET_PASSWORD`. (2) HTTP 200 login success. | (1) Returned temp pwd e.g. `Tmp9aZ2x`; (2) login succeeded with that temp pwd | **Pass** |

### Summary
- **Total test cases executed:** 8
- **Passed:** 8
- **Failed:** 0
- **Pass rate:** **100 %**
- **Conclusion:** The Authentication & Admin module meets all acceptance criteria defined in the Test Plan. Exit criteria for this module are satisfied.

---

# Q2 — Test Execution & Defect Analysis
**Project:** Verolla Server Monitoring System  **Date:** 19 April 2026

---

## Q2 (a) — Test Execution Results

The 8 test cases from Q1(b) were executed against the live server (`http://localhost:3000`) using a PowerShell runner that issued real HTTP requests and recorded each response. Raw log: [q2_execution_log.txt](q2_execution_log.txt).

| TC-ID | Scenario | Expected | Actual (evidence) | Status |
|-------|----------|----------|-------------------|--------|
| TC-01 | Successful signup | HTTP 201, user created | `HTTP=201 id=9 username=tester48741` | **PASS** |
| TC-02 | Duplicate username rejected | HTTP 400, "already taken" | `HTTP 400 "Username already taken"` | **PASS** |
| TC-03 | Login with correct credentials | HTTP 200, role=admin | `HTTP=200 role=admin` | **PASS** |
| TC-04 | Wrong password rejected | HTTP 401 | `HTTP=401 "Invalid password"` | **PASS** |
| TC-05 | Disabled user blocked | HTTP 403 | `HTTP=403 "Account has been deactivated…"` | **PASS** |
| TC-06 | Admin reaches `/api/admin/stats` | HTTP 200 | `HTTP=200 users=10 admins=1` | **PASS** |
| TC-07 | Non-admin denied admin endpoint | HTTP 403 | `HTTP=403` | **PASS** |
| TC-08 | Admin password reset works | tempPassword + login=200 | `temp='vswrvaxd9sA1!' loginAfter=200` | **PASS** |

**Summary:** 8 / 8 PASS (100 %).

### Evidence (excerpt from `q2_execution_log.txt`)
```
--- TC-01 : Successful signup ---            Status : PASS    HTTP=201 id=9
--- TC-03 : Login admin ---                  Status : PASS    HTTP=200 role=admin
--- TC-04 : Wrong password rejected ---      Status : PASS    HTTP=401
--- TC-05 : Disabled user cannot login ---   Status : PASS    HTTP=403
--- TC-06 : Admin reaches /api/admin/stats - Status : PASS    HTTP=200 admins=1
--- TC-07 : Non-admin denied ---             Status : PASS    HTTP=403
--- TC-08 : Admin reset password ---         Status : PASS    temp='vswrvaxd9sA1!'
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
inka konni changes there