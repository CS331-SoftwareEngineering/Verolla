const path = require('path');
const os   = require('fs');
const fsp  = require('fs');

const TEST_DB = require('path').join(require('os').tmpdir(), `verolla_bb_${Date.now()}.db`);
process.env.DB_PATH = TEST_DB;
process.env.PORT    = '0';

const request = require('supertest');
const { app }  = require('../server');

afterAll(() => {
    try { fsp.unlinkSync(TEST_DB); } catch (_) {}
});

describe('POST /api/signup', () => {
    const validUser = {
        fullName:        'Bob Tester',
        username:        'bob_test',
        org:             'Verolla',
        email:           'bob@verolla.io',
        phone:           '9876543210',
        dob:             '1998-01-01',
        password:        'Secret1',
        confirmPassword: 'Secret1'
    };

    test('TC-BB-01: valid signup returns 201', async () => {
        const res = await request(app).post('/api/signup').send(validUser);
        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
    });

    test('TC-BB-02: missing required field returns 400', async () => {
        const { fullName, ...incomplete } = validUser;
        const res = await request(app).post('/api/signup').send(incomplete);
        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('TC-BB-03: duplicate email returns 400', async () => {
        const res = await request(app).post('/api/signup').send({
            ...validUser,
            username: 'bob_other'
        });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/email/i);
    });

    test('TC-BB-04: duplicate username returns 400', async () => {
        const res = await request(app).post('/api/signup').send({
            ...validUser,
            email: 'other@verolla.io'
        });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/username/i);
    });

    test('TC-BB-05: mismatched passwords returns 400', async () => {
        const res = await request(app).post('/api/signup').send({
            ...validUser,
            username: 'new_person',
            email: 'new@verolla.io',
            confirmPassword: 'WrongPass9'
        });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/passwords do not match/i);
    });

    test('TC-BB-06: invalid email format returns 400', async () => {
        const res = await request(app).post('/api/signup').send({
            ...validUser,
            username: 'abc_user',
            email: 'not-an-email'
        });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/valid email/i);
    });

    test('TC-BB-07: weak password returns 400', async () => {
        const res = await request(app).post('/api/signup').send({
            ...validUser,
            username: 'weak_pass',
            email: 'weak@verolla.io',
            password: 'abc',
            confirmPassword: 'abc'
        });
        expect(res.statusCode).toBe(400);
    });
});

describe('POST /api/login', () => {
    test('TC-BB-08: correct credentials return 200', async () => {
        const res = await request(app).post('/api/login').send({
            identifier: 'bob@verolla.io',
            password:   'Secret1'
        });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user).toHaveProperty('username');
    });

    test('TC-BB-09: wrong password returns 401', async () => {
        const res = await request(app).post('/api/login').send({
            identifier: 'bob@verolla.io',
            password:   'WrongPass9'
        });
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/invalid password/i);
    });

    test('TC-BB-10: unknown user returns 401', async () => {
        const res = await request(app).post('/api/login').send({
            identifier: 'ghost@nowhere.com',
            password:   'Secret1'
        });
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/user not found/i);
    });

    test('TC-BB-11: missing fields returns 400', async () => {
        const res = await request(app).post('/api/login').send({ identifier: 'bob@verolla.io' });
        expect(res.statusCode).toBe(400);
    });
});

describe('POST /api/forgot-password', () => {
    test('TC-BB-12: known user returns 200', async () => {
        const res = await request(app)
            .post('/api/forgot-password')
            .send({ identifier: 'bob_test' });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('TC-BB-13: unknown user returns 404', async () => {
        const res = await request(app)
            .post('/api/forgot-password')
            .send({ identifier: 'nobody' });
        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
    });

    test('TC-BB-14: missing identifier returns 400', async () => {
        const res = await request(app).post('/api/forgot-password').send({});
        expect(res.statusCode).toBe(400);
    });
});

describe('GET /api/users', () => {
    test('TC-BB-15: returns users array without password field', async () => {
        const res = await request(app).get('/api/users');
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.users)).toBe(true);
        res.body.users.forEach(u => expect(u).not.toHaveProperty('password'));
    });
});

describe('POST /api/update-profile', () => {
    let userId;

    beforeAll(async () => {
        const res = await request(app).post('/api/signup').send({
            fullName: 'Carol Tester', username: 'carol_test', org: 'Verolla',
            email: 'carol@verolla.io', phone: '9000000001', dob: '1992-05-10',
            password: 'Secret1', confirmPassword: 'Secret1'
        });
        const usersRes = await request(app).get('/api/users');
        const carol = usersRes.body.users.find(u => u.email === 'carol@verolla.io');
        userId = carol.id;
    });

    test('TC-BB-16: valid update returns 200', async () => {
        const res = await request(app).post('/api/update-profile').send({
            userId,
            username: 'carol_updated',
            email:    'carol_new@verolla.io',
            password: ''
        });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('TC-BB-17: missing required fields returns 400', async () => {
        const res = await request(app).post('/api/update-profile').send({ userId });
        expect(res.statusCode).toBe(400);
    });

    test('TC-BB-18: conflict with existing email returns 400', async () => {
        const res = await request(app).post('/api/update-profile').send({
            userId,
            username: 'carol_updated',
            email:    'bob@verolla.io'
        });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/already taken/i);
    });
});

describe('Alerts API', () => {
    test('TC-BB-19: GET /api/alerts returns alerts array', async () => {
        const res = await request(app).get('/api/alerts');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.alerts)).toBe(true);
    });

    test('TC-BB-20: POST /api/alerts/:id/resolve returns success', async () => {
        const { alertDAL } = require('../dal');
        alertDAL.insert({ id: 'INC-BB-001', service: 'CPU', threshold: '>85%', severity: 'high', status: 'Active', time: '12:00' });

        const res = await request(app).post('/api/alerts/INC-BB-001/resolve');
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        const alert = alertDAL.findById('INC-BB-001');
        expect(alert.status).toBe('Resolved');
    });

    test('TC-BB-21: DELETE /api/alerts/:id removes the alert', async () => {
        const { alertDAL } = require('../dal');
        alertDAL.insert({ id: 'INC-BB-002', service: 'MEM', threshold: '>90%', severity: 'critical', status: 'Active', time: '12:01' });

        const res = await request(app).delete('/api/alerts/INC-BB-002');
        expect(res.statusCode).toBe(200);
        expect(alertDAL.findById('INC-BB-002')).toBeUndefined();
    });
});

describe('Notifications API', () => {
    test('TC-BB-22: GET /api/notifications returns notifications array', async () => {
        const res = await request(app).get('/api/notifications');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.notifications)).toBe(true);
    });

    test('TC-BB-23: GET /api/notifications/read returns success', async () => {
        const res = await request(app).get('/api/notifications/read');
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('GET /api/metrics', () => {
    test('TC-BB-24: returns all required metric fields', async () => {
        const res = await request(app).get('/api/metrics');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('cpuUsage');
        expect(res.body).toHaveProperty('memUsage');
        expect(res.body).toHaveProperty('diskUsage');
        expect(res.body).toHaveProperty('activeServices');
        expect(res.body).toHaveProperty('activeAlerts');
        expect(res.body).toHaveProperty('netInbound');
        expect(res.body).toHaveProperty('netOutbound');
        expect(res.body).toHaveProperty('unreadCount');
        expect(Array.isArray(res.body.recentAlerts)).toBe(true);
    });
});
