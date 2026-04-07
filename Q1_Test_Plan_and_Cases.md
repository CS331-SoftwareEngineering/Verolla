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

**Module under test:** Authentication & Admin (signup, login, role-based access, password reset)

| TC-ID | Test Scenario | Input | Expected Output | Actual Output | Status |
|-------|---------------|-------|-----------------|---------------|--------|
| **TC-01** | Successful user signup — new user registers with valid data; password bcrypt-hashed in DB | `POST /api/signup` — valid fullName, username, org, email, phone, dob, password, confirmPassword | HTTP **201**, `{ success:true, user:{ id, username, email, role:"user", active:1 } }`. Audit row inserted. | HTTP 201, user created with role="user", password stored as bcrypt hash | **Pass** |
| **TC-02** | Duplicate username rejected — signup with an already-registered username fails | `POST /api/signup` — username="tejeshwar" (existing), new email | HTTP **400**, `{ success:false, message:"Username already taken" }`. No new row in `users`. | HTTP 400, "Username already taken" | **Pass** |
| **TC-03** | Successful login with correct credentials | `POST /api/login` — identifier="tejeshwar", password="Admin@123" | HTTP **200**, `{ success:true, user:{ id:1, username:"tejeshwar", role:"admin" } }`. `lastLogin` updated. Audit row `LOGIN` inserted. | HTTP 200, user object returned with role="admin", `lastLogin` timestamp updated | **Pass** |
| **TC-04** | Login with wrong password rejected — invalid credentials refused | `POST /api/login` — identifier="tejeshwar", password="WrongPwd" | HTTP **401**, `{ success:false, message:"Invalid password" }`. No session granted. | HTTP 401, "Invalid password" | **Pass** |
| **TC-05** | Disabled user blocked from login — admin disables a user; that user cannot log in | Pre-step: `POST /api/admin/users/:id/active` `{active:false}` with header `x-admin-user: tejeshwar`. Then: `POST /api/login` with that user's credentials. | HTTP **403**, `{ success:false, message:"Account has been deactivated" }`. | HTTP 403, "Account has been deactivated" | **Pass** |
| **TC-06** | Admin endpoint allows admin — valid admin fetches system stats | `GET /api/admin/stats` with header `x-admin-user: tejeshwar` | HTTP **200**, JSON with keys `users, activeUsers, admins, alertsTotal, alertsActive, uptimeSec`. | HTTP 200, stats object returned (`users:10, admins:1, …`) | **Pass** |
| **TC-07** | Admin endpoint denies non-admin — unknown/non-admin user is refused | `GET /api/admin/stats` with header `x-admin-user: nobody` | HTTP **403**, `{ success:false, message:"Admin access denied" }`. | HTTP 403, "Admin access denied" | **Pass** |
| **TC-08** | Admin password reset — admin resets a user's password; temp password works for login | (1) `POST /api/admin/users/:id/reset-password` with header `x-admin-user: tejeshwar`. (2) Login with returned `tempPassword`. | (1) HTTP 200, `{ success:true, tempPassword:"<random>" }`, audit row `RESET_PASSWORD`. (2) HTTP 200 login succeeds. | (1) HTTP 200, temp password returned; (2) login with temp password succeeded | **Pass** |

