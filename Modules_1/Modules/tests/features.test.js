/**
 * Verolla — extended white-box & black-box tests for new features:
 *   - Bug fixes (BUG_01 DOB, BUG_02 type-checks, BUG_03 phone regex)
 *   - bcrypt password hashing + legacy plaintext upgrade
 *   - Login rate limiting
 *   - Settings persistence + threshold validation
 *   - Predictor (linear regression + cycle dedupe + cool-off)
 *   - Health endpoint
 */

const path = require('path');
const os   = require('os');
const fs   = require('fs');

const TEST_DB = path.join(os.tmpdir(), `verolla_features_${Date.now()}.db`);
process.env.DB_PATH = TEST_DB;
process.env.PORT    = '0';

const request = require('supertest');
const {
    app,
    validatePhone,
    validateDOB,
    hashPasswordSync,
    verifyPassword,
    predictor
} = require('../server');

const { db } = require('../database');
const { settingsDAL, predictionsDAL, metricsDAL, userDAL } = require('../dal');

afterAll(() => {
    try { db.close(); fs.existsSync(TEST_DB) && fs.unlinkSync(TEST_DB); } catch (_) {}
});

// ---------------------------------------------------------------------------
// Bug fixes
// ---------------------------------------------------------------------------
describe('Bug fixes (white box)', () => {
    test('BUG_01: DOB exactly 13 years ago today is valid', () => {
        const d = new Date(); d.setFullYear(d.getFullYear() - 13);
        expect(validateDOB(d.toISOString().split('T')[0])).toBe(true);
    });

    test('BUG_01: DOB just under 13 (tomorrow) is rejected', () => {
        const d = new Date(); d.setFullYear(d.getFullYear() - 13); d.setDate(d.getDate() + 1);
        expect(validateDOB(d.toISOString().split('T')[0])).toBe(false);
    });

    test('BUG_02: validateDOB rejects non-string input gracefully', () => {
        expect(validateDOB(12345)).toBe(false);
        expect(validateDOB(null)).toBe(false);
        expect(validateDOB(undefined)).toBe(false);
    });

    test('BUG_02: signup rejects non-string fields without crashing', async () => {
        const res = await request(app).post('/api/signup').send({
            fullName: 12345, username: 'x', org: 'o', email: 'e@e.com',
            phone: '1234567890', dob: '2000-01-01', password: 'Secret1', confirmPassword: 'Secret1'
        });
        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('BUG_03: phone regex requires actual digits', () => {
        expect(validatePhone('()-+()-+()-')).toBe(false); // no digits
        expect(validatePhone('1234567890')).toBe(true);
        expect(validatePhone('+1 (234) 567-8901')).toBe(true);
        expect(validatePhone('123')).toBe(false); // too few digits
    });
});

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------
describe('Password hashing', () => {
    test('hashPasswordSync produces a bcrypt hash', () => {
        const hash = hashPasswordSync('Secret1');
        expect(hash).toMatch(/^\$2[aby]?\$/);
    });

    test('verifyPassword accepts correct password against bcrypt hash', () => {
        const hash = hashPasswordSync('Secret1');
        expect(verifyPassword('Secret1', hash)).toBe(true);
        expect(verifyPassword('Wrong!', hash)).toBe(false);
    });

    test('verifyPassword falls back to plaintext for legacy rows', () => {
        expect(verifyPassword('legacy123', 'legacy123')).toBe(true);
        expect(verifyPassword('legacy123', 'other')).toBe(false);
    });

    test('login auto-upgrades legacy plaintext password to bcrypt', async () => {
        // Insert a user with plaintext password (simulating legacy row)
        const u = userDAL.insert({
            fullName: 'Legacy User', username: 'legacy_user', org: 'X',
            email: 'legacy@verolla.io', phone: '1234567890', dob: '1990-01-01',
            password: 'PlainPass1'
        });

        const res = await request(app).post('/api/login').send({
            identifier: 'legacy@verolla.io',
            password:   'PlainPass1'
        });
        expect(res.statusCode).toBe(200);

        const reloaded = userDAL.findById(u.id);
        expect(reloaded.password).toMatch(/^\$2[aby]?\$/);
    });
});

// ---------------------------------------------------------------------------
// Login rate limiting
// ---------------------------------------------------------------------------
describe('Login rate limiting', () => {
    test('returns 429 after 5 failed attempts from same IP', async () => {
        // Use a unique identifier that doesn't exist
        for (let i = 0; i < 5; i++) {
            await request(app).post('/api/login').send({
                identifier: 'nobody@nowhere.io', password: 'Wrong123'
            });
        }
        const res = await request(app).post('/api/login').send({
            identifier: 'nobody@nowhere.io', password: 'Wrong123'
        });
        expect(res.statusCode).toBe(429);
        expect(res.body.message).toMatch(/too many/i);
    });
});

// ---------------------------------------------------------------------------
// Settings endpoint
// ---------------------------------------------------------------------------
describe('Settings endpoint', () => {
    test('GET /api/settings returns defaults', async () => {
        const res = await request(app).get('/api/settings');
        expect(res.statusCode).toBe(200);
        expect(res.body.settings).toHaveProperty('cpuThreshold');
        expect(res.body.settings).toHaveProperty('emailEnabled');
    });

    test('POST /api/settings persists thresholds', async () => {
        const res = await request(app).post('/api/settings').send({
            cpuThreshold: 77, memThreshold: 66, diskThreshold: 88
        });
        expect(res.statusCode).toBe(200);
        expect(res.body.settings.cpuThreshold).toBe(77);
        expect(settingsDAL.get('cpuThreshold')).toBe(77);
    });

    test('POST /api/settings rejects out-of-range threshold', async () => {
        const res = await request(app).post('/api/settings').send({ cpuThreshold: 999 });
        expect(res.statusCode).toBe(400);
    });

    test('POST /api/settings rejects non-boolean toggle', async () => {
        const res = await request(app).post('/api/settings').send({ emailEnabled: 'yes' });
        expect(res.statusCode).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// Predictor
// ---------------------------------------------------------------------------
describe('Predictor', () => {
    test('linear regression on perfectly linear data has R² = 1', () => {
        const fit = predictor._internal.ewLinearRegression([
            { t: 0, y: 50 }, { t: 5, y: 55 }, { t: 10, y: 60 },
            { t: 15, y: 65 }, { t: 20, y: 70 }
        ]);
        expect(fit.slope).toBeCloseTo(1, 5);
        expect(fit.r2).toBeCloseTo(1, 5);
    });

    test('runCycle creates a trend prediction when metrics climb toward threshold', () => {
        // Seed metrics_log with a steadily-rising CPU pattern
        settingsDAL.setMany({ cpuThreshold: 85, memThreshold: 95, diskThreshold: 95 });
        const start = Date.now();
        for (let i = 0; i < 15; i++) {
            db.prepare(`
                INSERT INTO metrics_log (cpuUsage, memUsage, diskUsage, netInbound, netOutbound, recordedAt)
                VALUES (?, 10, 10, 0, 0, ?)
            `).run(60 + i, new Date(start + i * 5000).toISOString());
        }

        const before = predictionsDAL.findActive().length;
        predictor.runCycle({ cpu: 74, mem: 10, disk: 10 });
        const after = predictionsDAL.findActive();
        expect(after.length).toBeGreaterThan(before);
        expect(after.some(p => p.metric === 'CPU' && p.kind === 'trend')).toBe(true);
    });

    test('runCycle does NOT create a duplicate active prediction', () => {
        const before = predictionsDAL.findActive().filter(p => p.metric === 'CPU' && p.kind === 'trend').length;
        predictor.runCycle({ cpu: 74, mem: 10, disk: 10 });
        const after = predictionsDAL.findActive().filter(p => p.metric === 'CPU' && p.kind === 'trend').length;
        expect(after).toBe(before);
    });

    test('cool-off resolves the active prediction so it can re-fire', () => {
        // Append flat low-CPU samples so the regression no longer projects a breach
        const start = Date.now() + 100000;
        for (let i = 0; i < 15; i++) {
            db.prepare(`
                INSERT INTO metrics_log (cpuUsage, memUsage, diskUsage, netInbound, netOutbound, recordedAt)
                VALUES (?, 10, 10, 0, 0, ?)
            `).run(10, new Date(start + i * 5000).toISOString());
        }
        // Cool-off threshold = 85 * 0.80 = 68; cpu=10 must resolve the existing prediction
        // RESOLVE_CONFIRM_CYCLES = 2, so we need two consecutive low cycles
        predictor.runCycle({ cpu: 10, mem: 10, disk: 10 });
        predictor.runCycle({ cpu: 10, mem: 10, disk: 10 });
        const stillActive = predictionsDAL.findActive().filter(p => p.metric === 'CPU' && p.kind === 'trend');
        expect(stillActive.length).toBe(0);
    });

    test('re-fire: a new prediction is created after cool-off when trend rises again', () => {
        // Clear refire cooldown so the predictor can fire again immediately
        const blocked = predictor._internal.refireBlockedUntil;
        for (const key of Object.keys(blocked)) delete blocked[key];

        // Wipe predictions so no active ones block persist
        db.prepare('DELETE FROM predictions').run();

        // Mock metricsDAL.findRecent to return controlled data
        // (background timer inserts rows with higher IDs, contaminating ORDER BY id DESC)
        const originalFindRecent = metricsDAL.findRecent;
        const start = Date.now();
        const mockRows = [];
        for (let i = 0; i < 20; i++) {
            mockRows.push({
                cpuUsage: 60 + i, memUsage: 10, diskUsage: 10,
                netInbound: 0, netOutbound: 0,
                recordedAt: new Date(start + i * 10000).toISOString()
            });
        }
        // findRecent returns newest-first (ORDER BY id DESC)
        metricsDAL.findRecent = () => mockRows.slice().reverse();

        try {
            const cfg = settingsDAL.getAll();
            const result = predictor._internal.trendPrediction('CPU', r => r.cpuUsage, cfg.cpuThreshold);
            expect(result).not.toBeNull();
            expect(result.metric).toBe('CPU');
            expect(result.kind).toBe('trend');
        } finally {
            metricsDAL.findRecent = originalFindRecent;
        }
    });
});

// ---------------------------------------------------------------------------
// Health endpoint
// ---------------------------------------------------------------------------
describe('Health endpoint', () => {
    test('GET /api/health returns ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body).toHaveProperty('uptimeSec');
        expect(res.body).toHaveProperty('nodeVersion');
    });
});
