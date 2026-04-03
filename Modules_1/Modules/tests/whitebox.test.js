const path = require('path');
const os   = require('os');
const fs   = require('fs');

const TEST_DB = path.join(os.tmpdir(), `verolla_wb_${Date.now()}.db`);
process.env.DB_PATH = TEST_DB;

const { userDAL, alertDAL, notificationDAL } = require('../dal');
const {
    validateEmail,
    validatePassword,
    validateUsername,
    validateDOB
} = require('../server');

const { db } = require('../database');
afterAll(() => {
    try { 
        db.close(); 
        if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB); 
    } catch (_) {}
});

describe('Validators (White Box)', () => {
    describe('validateEmail', () => {
        test('valid email returns true', () => expect(validateEmail('admin@verolla.io')).toBe(true));
        test('email without @ returns false', () => expect(validateEmail('adminverolla.io')).toBe(false));
        test('email without domain returns false', () => expect(validateEmail('admin@')).toBe(false));
        test('empty string returns false', () => expect(validateEmail('')).toBe(false));
    });

    describe('validatePassword', () => {
        test('strong password passes all checks', () => {
            const result = validatePassword('Secret1');
            expect(result.valid).toBe(true);
        });
        test('too-short password fails minLength branch', () => {
            const result = validatePassword('Ab1');
            expect(result.valid).toBe(false);
            expect(result.errors.minLength).not.toBeNull();
        });
        test('no uppercase letter fails hasUppercase branch', () => {
            const result = validatePassword('secret1');
            expect(result.valid).toBe(false);
            expect(result.errors.hasUppercase).not.toBeNull();
        });
    });

    describe('validateUsername', () => {
        test('valid alphanumeric username passes', () => expect(validateUsername('john_doe99')).toBe(true));
        test('username too short fails', () => expect(validateUsername('jd')).toBe(false));
        test('username with special characters fails', () => expect(validateUsername('john-doe!')).toBe(false));
    });

    describe('validateDOB', () => {
        test('user aged 20 passes', () => {
            const dob = new Date();
            dob.setFullYear(dob.getFullYear() - 20);
            expect(validateDOB(dob.toISOString().split('T')[0])).toBe(true);
        });
        test('user aged 10 fails', () => {
            const dob = new Date();
            dob.setFullYear(dob.getFullYear() - 10);
            expect(validateDOB(dob.toISOString().split('T')[0])).toBe(false);
        });
    });
});

describe('DAL operations (White Box)', () => {
    const sample = {
        fullName: 'Alice Dev',
        username: 'alice_dev',
        org:      'Verolla',
        email:    'alice@verolla.io',
        phone:    '9876543210',
        dob:      '1995-06-15',
        password: 'Secret1'
    };

    let createdId;

    test('userDAL.insert and findById', () => {
        const user = userDAL.insert(sample);
        expect(user.id).toBeDefined();
        createdId = user.id;
        const found = userDAL.findById(createdId);
        expect(found.username).toBe('alice_dev');
    });

    test('userDAL.findByEmailOrUsername', () => {
        const found = userDAL.findByEmailOrUsername('alice@verolla.io');
        expect(found.id).toBe(createdId);
    });

    test('userDAL.findDuplicate detected', () => {
        const dup = userDAL.findDuplicate('alice@verolla.io', 'other');
        expect(dup).toBeDefined();
    });

    test('alertDAL.insert and findAll', () => {
        alertDAL.insert({ id: 'INC-1', service: 'CPU', threshold: '>85%', severity: 'high', status: 'Active', time: '12:00' });
        const alerts = alertDAL.findAll();
        expect(alerts.length).toBe(1);
    });

    test('notificationDAL.insert and count', () => {
        notificationDAL.insert({ time: '12:00', service: 'CPU', alert: 'High', severity: 'high', status: 'Sent', channel: 'Email', timestamp: Date.now() });
        expect(notificationDAL.count()).toBe(1);
    });
});
