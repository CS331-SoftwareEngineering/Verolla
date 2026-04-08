# Test Plan — Verolla Server Monitoring System
**Document version:** 1.0
**Date:** 19 April 2026
**Prepared by:** Tejeshwar
**Project:** Verolla — AI-Driven Server Monitoring & Alerting Platform
**Repository path:** `C:\Users\tejes\OneDrive\Desktop\java codes\project_software\Modules_1\Modules`

---

## 1. Introduction

### 1.1 Purpose of this Document
This Test Plan describes the **strategy, scope, approach, resources, schedule, and acceptance criteria** for testing the Verolla Server Monitoring System. It is the master reference used by the testing team, developers and the project guide to ensure that the application meets its functional, non-functional and security requirements before release.

### 1.2 Project Background
Verolla is a web-based server-monitoring system built with **Node.js / Express** on the backend and a custom HTML / CSS / JavaScript frontend. It collects live system metrics (CPU, Memory, Network, Disk) using the `systeminformation` library, persists them in **SQLite** through a Data Access Layer (`dal.js`), raises **threshold-based alerts** that must be sustained for 1 minute before triggering, runs an **AI predictive engine** (`predictor.js` v2 — exponentially-weighted linear regression) to forecast capacity issues, and provides a **role-based admin console** for user management and audit-log review.

### 1.3 References
| Ref | Document |
|-----|----------|
| R-1 | Project SRS / Requirements document |
| R-2 | Verolla source repository (Modules_1/Modules) |
| R-3 | IEEE 829-2008 Standard for Test Documentation |
| R-4 | OWASP Top 10 — 2021 |
| R-5 | Jest official documentation (`https://jestjs.io`) |

### 1.4 Definitions & Acronyms
| Term | Meaning |
|------|---------|
| DAL | Data Access Layer (`dal.js`) — wraps SQLite calls in prepared statements |
| EWLR | Exponentially-Weighted Linear Regression — used by `predictor.js` |
| Sustain timer | A 60-second window during which a threshold breach must continue to qualify as an alert |
| Bootstrap admin | First user (or users matching `ADMIN_EMAILS`) auto-promoted to admin on server start |
| Audit log | Append-only table recording every administrative action |

---

## 2. Objectives of Testing

The testing effort has the following measurable objectives:

1. **Functional correctness** — Every endpoint listed in the API contract returns the documented status code, response shape and side-effects on the database.
2. **Authentication & Authorisation** — Validate that
   - Passwords are bcrypt-hashed (never stored or transmitted in plaintext),
   - Only authenticated users can access protected pages,
   - Only users with `role = 'admin'` can hit `/api/admin/*` endpoints,
   - Disabled accounts (`active = 0`) are blocked at login.
3. **Data integrity** — Verify that SQLite schema migrations run idempotently, that prepared statements prevent SQL injection, and that referential rules (e.g. an audit row per admin action) hold.
4. **Alerting accuracy** — Confirm that an alert is raised **only** after a threshold has been continuously breached for ≥ 60 seconds, and is auto-resolved after two consecutive cycles below 80 % of the threshold.
5. **AI predictor reliability** — Verify the v2 predictor:
   - Does not spam (10-minute cool-down after resolve),
   - Honours statistical gates (R² ≥ 0.65, slope ≥ 0.08 %/s, ETA between 45 s and 300 s),
   - Persists predictions to the `predictions` table.
6. **Usability** — Each HTML page (login, signup, dashboard, metrics, alerts, predictions, settings, admin) renders correctly in Chrome 120+ and Edge.
7. **Reliability** — The server runs continuously for **≥ 24 hours** without memory leaks or unhandled exceptions.
8. **Security** — Pass all security checklist items (Section 7.5).
9. **Regression safety** — The full Jest suite (61 + 8 new admin cases) passes after every code change.

---

## 3. Scope of Testing

### 3.1 Features / Modules **In Scope**
| # | Module | File(s) | Key behaviours to verify |
|---|--------|---------|--------------------------|
| 1 | Authentication | `server.js`, `signup.html`, `login.html` | Signup validation, bcrypt hashing, login, session in `localStorage`, blocked-user handling |
| 2 | User Profile | `server.js`, `dal.js` | `/api/me`, profile read |
| 3 | Metric Collection | `server.js`, `systeminformation` | `/api/metrics` returns real CPU/Mem/Net/Disk; hour-over-hour trend computed from `metrics_log` |
| 4 | Alerts | `server.js`, `dal.js`, `alerts.html` | 1-minute sustain gate, ack, resolve, persistence |
| 5 | Notifications | `server.js`, `notifications.html` | List, mark-as-read |
| 6 | AI Predictor | `predictor.js` | EWLR maths, gates, cool-down |
| 7 | Admin Console | `admin.html`, `/api/admin/*` | Stats, user CRUD, role/active toggles, password reset, audit log, maintenance purges |
| 8 | Settings | `settings.html`, `settingsDAL` | Threshold updates, availability targets |
| 9 | Audit Log | `auditDAL` | Every admin action recorded with actor, action, target, IP |
| 10 | Database Layer | `database.js`, `dal.js` | Schema migrations, prepared-statement parameterisation |

### 3.2 Items **Out of Scope**
- Load / stress testing beyond 100 concurrent users.
- Penetration testing of the Windows host OS or network.
- Real SMTP delivery (mailer is exercised in mock mode).
- Cross-browser pixel-perfect UI comparison (only functional UI checks performed).
- Mobile-app testing (the system is web-only at this stage).

### 3.3 Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| SQLite DB file lock during concurrent tests | Medium | Test failure / data corruption | Use temp DB per test suite; close DB handles after each run |
| Predictor produces false positives | Medium | Alert spam | Verified by TC covering cool-down and R² gate |
| `systeminformation` returns OS-specific quirks | Low | Wrong KB/s on certain Windows versions | Mock `systeminformation` in unit tests |
| Hard-coded admin bootstrap could clash with real users | Low | Unexpected promotion | Verified by TC-Admin-01 (only first user, only when no admin exists) |
| Browser `localStorage` cleared mid-session | Low | User redirected to login | Acceptable behaviour — verified |

---

## 4. Test Approach / Strategy

The testing approach combines **automated** and **manual** techniques across multiple levels of the V-model.

### 4.1 Levels of Testing

#### 4.1.1 Unit Testing (White-Box)
- **What:** Individual JavaScript functions inside `predictor.js`, `dal.js` and helper utilities.
- **How:** Jest test files in `tests/whitebox.test.js` and `tests/features.test.js`.
- **Coverage target:** ≥ 80 % statements, ≥ 75 % branches.
- **Examples:**
  - `ewLinearRegression()` returns correct slope/intercept/R² for a known dataset.
  - `userDAL.insert()` rejects a duplicate username with the expected SQLite constraint error.

#### 4.1.2 Integration Testing (Black-Box)
- **What:** REST endpoints exercised end-to-end through HTTP.
- **How:** Supertest hits the live Express app; assertions verify status code, JSON shape and DB side-effects.
- **Examples:**
  - `POST /api/signup` followed by `POST /api/login` for the same credentials.
  - `POST /api/admin/users/:id/role` with header `x-admin-user: tejeshwar` and verifying the audit row.

#### 4.1.3 System Testing
- **What:** Complete user journeys executed manually through the browser at `http://localhost:3000`.
- **Scenarios:** "New user signs up → logs in → simulates a CPU spike → sees alert → admin acknowledges → alert resolves automatically."

#### 4.1.4 Regression Testing
- **What:** Re-run the full Jest suite after every commit / refactor.
- **Trigger:** `npm test` from the project root before any push.

#### 4.1.5 Smoke Testing
- **What:** A 30-second sanity check after every server restart.
- **Checks:** `/api/health` → 200; `/api/metrics` → returns numeric values; `/api/admin/stats` (with admin header) → 200.

#### 4.1.6 Security Testing
- See Section 7.5 for the full checklist.

#### 4.1.7 User Acceptance Testing (UAT)
- **What:** End-user (project guide / evaluator) walks through documented scenarios.
- **Sign-off:** Required before final submission.

### 4.2 Test Design Techniques Used
- **Equivalence Partitioning** — e.g. password length: < 8, 8–64, > 64.
- **Boundary Value Analysis** — e.g. CPU threshold exactly at 80 %, 79.99 %, 80.01 %.
- **Decision Table** — for login outcomes (active × role × correct-password combinations).
- **State Transition** — alert lifecycle: `none → triggered → acknowledged → resolved`.
- **Error Guessing** — empty body POSTs, malformed JSON, oversized payloads.

---

## 5. Test Environment

### 5.1 Hardware
| Item | Specification |
|------|--------------|
| Machine | Windows 11 laptop, Intel i5/i7, 8 GB RAM, SSD |
| Network | Local loopback (`localhost:3000`) |

### 5.2 Software Stack
| Layer | Software | Version |
|-------|----------|---------|
| OS | Windows 11 | 23H2 |
| Runtime | Node.js | v24.5.0 |
| Database | SQLite (via `better-sqlite3`) | 11.x |
| Web framework | Express | 4.x |
| Test runner | Jest | 29.7.0 |
| HTTP client (tests) | Supertest | 7.0.0 |
| Hashing | bcryptjs | 3.0.3 |
| Mailer | nodemailer (mock) | 8.0.4 |
| System metrics | systeminformation | latest |
| Browsers | Chrome 120+, Edge 120+ | — |

### 5.3 Test Data
- Pre-seeded users:
  | id | username | role | active |
  |----|----------|------|--------|
  | 1 | tejeshwar | admin | true |
  | 2 | kk1234 | user | true |
  | 3 | tejesh | user | true |
  | 4 | abbavaram | user | true |
  | 5 | laraxxx | user | true |
- Synthetic CPU/memory load injected via `simulate_cpu.js`.
- Threshold defaults: CPU 80 %, Memory 85 %, Disk 90 %.

### 5.4 Tools
| Purpose | Tool |
|---------|------|
| Test framework | Jest |
| HTTP assertions | Supertest |
| Coverage report | `jest --coverage` |
| Manual API testing | PowerShell `Invoke-RestMethod` / Postman |
| DB inspection | DB Browser for SQLite |
| Browser DevTools | Chrome DevTools (Network, Console) |
| Version control | Git |
| Editor | VS Code |

---

## 6. Roles and Responsibilities

| Role | Name | Responsibility |
|------|------|----------------|
| Test Manager / Lead | Tejeshwar | Owns this plan, signs off exit criteria |
| Test Engineer | Tejeshwar | Designs, executes and reports test cases |
| Developer | Tejeshwar | Fixes defects within agreed SLA |
| Reviewer / Guide | Project Guide | Reviews UAT and approves release |

---

## 7. Test Coverage

### 7.1 Functional Coverage Matrix (excerpt)
| Requirement ID | Covered by Test Case(s) |
|----------------|--------------------------|
| FR-AUTH-01 (Signup) | TC-01, TC-02 |
| FR-AUTH-02 (Login) | TC-03, TC-04, TC-05 |
| FR-ADMIN-01 (Stats) | TC-06, TC-07 |
| FR-ADMIN-02 (Reset Password) | TC-08 |
| FR-ALERT-01 (Sustain timer) | TC-A1, TC-A2 |
| FR-PRED-01 (Cool-down) | TC-P1 |
| FR-METRIC-01 (Real OS metrics) | TC-M1 |

### 7.2 Code Coverage Target
- **Statements:** ≥ 80 %
- **Branches:** ≥ 75 %
- **Functions:** ≥ 80 %
- **Lines:** ≥ 80 %
- Reported by `jest --coverage` on every CI run.

### 7.5 Security Test Checklist
| # | Item | Expected |
|---|------|----------|
| S-1 | SQL injection on `username` field of `/api/login` | Rejected (parameterised statements) |
| S-2 | Plaintext password in DB | None — bcrypt hash only |
| S-3 | Admin endpoint accessed without header | 403 Forbidden |
| S-4 | Admin endpoint accessed with non-admin user | 403 Forbidden |
| S-5 | Disabled user logs in | 403 Forbidden |
| S-6 | XSS in audit-log details | Escaped via `escapeHtml()` in `admin.html` |
| S-7 | Self-disable / self-delete | UI prevents; server should reject |
| S-8 | Brute-force login (≥ 20 attempts) | Same 401 each time (no info leak) |

---

## 8. Entry Criteria
Testing of any module **starts** only when **all** of the following are satisfied:
1. The latest code is committed to the repository.
2. `npm install` completes without error.
3. `node server.js` starts cleanly on port 3000 — no uncaught exceptions in the first 10 seconds.
4. Database migrations have run (auto on startup) — verified by presence of `role`, `active`, `lastLogin` columns and `audit_log` table.
5. Bootstrap admin (`tejeshwar`) is present and reachable.
6. Test data is seeded (≥ 5 users, ≥ 1 admin).
7. The Jest configuration in `package.json` is valid and can discover test files.
8. The test environment has internet only when needed (for `npm install`).

---

## 9. Exit Criteria
Testing of a module is **considered complete** when **all** of the following are met:
1. **100 %** of planned test cases for that module are executed.
2. **≥ 95 %** of executed test cases pass.
3. **0** open defects of severity *Critical* or *High*.
4. Code coverage thresholds in Section 7.2 are met.
5. All Security Checklist items in Section 7.5 pass.
6. The server has run continuously for ≥ 24 hours under nominal load without crashing.
7. A signed-off Test Summary Report is produced.
8. Defect log is updated with status of every raised defect.

---

## 10. Suspension & Resumption Criteria

### 10.1 Suspension
Testing will be **suspended** if:
- The application fails to start (server crash on boot).
- The database is corrupted or unreadable.
- A blocker defect prevents > 30 % of planned cases from executing.

### 10.2 Resumption
Testing **resumes** once:
- The blocker defect is fixed and verified.
- A fresh smoke test passes.
- All Entry Criteria are re-satisfied.

---

## 11. Test Deliverables

| # | Deliverable | Owner | When |
|---|------------|-------|------|
| 1 | Test Plan (this document) | Test Lead | Start of test cycle |
| 2 | Test Cases (Q1-b sheet) | Test Engineer | Before execution |
| 3 | Automated test scripts (`tests/*.test.js`) | Developer | Before execution |
| 4 | Defect Log | Test Engineer | Throughout |
| 5 | Coverage report (`coverage/lcov-report`) | Test Engineer | After execution |
| 6 | Test Summary Report | Test Lead | End of cycle |
| 7 | UAT sign-off form | Project Guide | Before release |

---

## 12. Schedule (Indicative)

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Test Planning | 1 day | This document |
| Test Case Design | 2 days | Test case sheet |
| Test Environment Setup | 0.5 day | Working sandbox |
| Unit Test Execution | 1 day | Jest report |
| Integration Test Execution | 1 day | Supertest report |
| System Test Execution | 1 day | Manual log |
| Defect Fix & Re-test | 1 day | Updated defect log |
| UAT | 0.5 day | Sign-off |
| Test Closure | 0.5 day | Summary report |
| **Total** | **~8.5 days** | — |

---

## 13. Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Test Lead | Tejeshwar | __________________ | 2026-04-19 |
| Developer | Tejeshwar | __________________ | 2026-04-19 |
| Project Guide | __________ | __________________ | __________ |

---

*— End of Test Plan —*
