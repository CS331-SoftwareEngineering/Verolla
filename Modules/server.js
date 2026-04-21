const express = require('express');
const cors = require('cors');
const os = require('os');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const bcrypt = require('bcryptjs');
const si = require('systeminformation');

const { userDAL, alertDAL, notificationDAL, metricsDAL, settingsDAL, availabilityDAL, predictionsDAL, auditDAL, adminDAL } = require('./dal');
const predictor = require('./predictor');

// ---- Admin auth helper ----
// Lightweight: client sends `x-admin-user` header containing admin's username
// or email. Server checks the user exists, is active, and has role='admin'.
function requireAdmin(req, res, next) {
    // BUG-03 fix: always return 403 regardless of whether header is missing or user is not admin
    const id = (req.headers['x-admin-user'] || '').toString().trim();
    const user = id ? userDAL.findByEmailOrUsername(id) : null;
    if (!user || user.role !== 'admin' || user.active === 0) {
        return res.status(403).json({ success: false, message: 'Admin access denied' });
    }
    req.adminUser = user;
    next();
}

const BCRYPT_ROUNDS = 10;
const BCRYPT_PREFIX_RE = /^\$2[aby]?\$/;
function hashPasswordSync(plain) { return bcrypt.hashSync(plain, BCRYPT_ROUNDS); }
function verifyPassword(plain, stored) {
    if (!stored) return false;
    if (BCRYPT_PREFIX_RE.test(stored)) return bcrypt.compareSync(plain, stored);
    // Legacy plaintext fallback (kept so existing accounts still work; will be
    // upgraded to a bcrypt hash on first successful login).
    return plain === stored;
}

// Optional nodemailer integration (only active when SMTP env vars are set)
let mailTransporter = null;
try {
    const nodemailer = require('nodemailer');
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        mailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        console.log('[mail] Nodemailer transport initialized.');
    }
} catch (_) { /* nodemailer not installed */ }

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.use(express.static(__dirname));

// --- Per-IP login rate limiting -------------------------------------------
const LOGIN_WINDOW_MS  = 15 * 60 * 1000; // 15 min sliding window
const LOGIN_MAX_FAILS  = 5;
const loginAttempts = new Map(); // ip -> { count, firstAt }

function recordLoginFailure(ip) {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
        loginAttempts.set(ip, { count: 1, firstAt: now });
    } else {
        entry.count++;
    }
}
function clearLoginFailures(ip) { loginAttempts.delete(ip); }
function isRateLimited(ip) {
    const entry = loginAttempts.get(ip);
    if (!entry) return false;
    if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
        loginAttempts.delete(ip);
        return false;
    }
    return entry.count >= LOGIN_MAX_FAILS;
}

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePhone(phone) {
    if (typeof phone !== 'string') return false;
    // BUG_03 fix: must contain 10-15 digits in total; allow common separators
    const phoneRegex = /^(?=(?:.*\d){10,15}$)[\d\s\-+()]+$/;
    return phoneRegex.test(phone);
}

function validatePassword(password) {
    const minLength = password.length >= 6;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);

    return {
        valid: minLength && hasUppercase && hasLowercase && hasNumber,
        errors: {
            minLength:    !minLength    ? 'Password must be at least 6 characters' : null,
            hasUppercase: !hasUppercase ? 'Password must contain at least one uppercase letter' : null,
            hasLowercase: !hasLowercase ? 'Password must contain at least one lowercase letter' : null,
            hasNumber:    !hasNumber    ? 'Password must contain at least one number' : null
        }
    };
}

function validateUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
}

function validateDOB(dob) {
    if (typeof dob !== 'string' || !dob) return false;
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    // BUG_01 fix: subtract a year if birthday hasn't occurred yet this year
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age >= 13 && age <= 120;
}

app.post('/api/signup', (req, res) => {
    const { fullName, username, org, email, phone, dob, password, confirmPassword } = req.body;

    if (!fullName || !username || !org || !email || !phone || !dob || !password || !confirmPassword)
        return res.status(400).json({ success: false, message: 'All fields are required' });

    // BUG_02 fix: reject non-string inputs gracefully instead of crashing on .trim()
    for (const [k, v] of Object.entries({ fullName, username, org, email, phone, dob, password, confirmPassword })) {
        if (typeof v !== 'string') {
            return res.status(400).json({ success: false, message: `Invalid value for ${k}` });
        }
    }

    if (fullName.trim().length < 2)
        return res.status(400).json({ success: false, message: 'Full name must be at least 2 characters' });

    // BUG-02 fix: reject HTML/script tags and unsafe characters in fullName
    const SAFE_NAME_RE = /^[\p{L}\p{N} .,'\-]{2,80}$/u;
    if (!SAFE_NAME_RE.test(fullName.trim()))
        return res.status(400).json({ success: false, message: 'Full name contains invalid characters' });

    if (!validateUsername(username))
        return res.status(400).json({ success: false, message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' });

    if (!validateEmail(email))
        return res.status(400).json({ success: false, message: 'Please enter a valid email address' });

    if (!validatePhone(phone))
        return res.status(400).json({ success: false, message: 'Please enter a valid phone number' });

    if (!validateDOB(dob))
        return res.status(400).json({ success: false, message: 'You must be at least 13 years old to sign up' });

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        const errorMessages = Object.values(passwordValidation.errors).filter(e => e !== null);
        return res.status(400).json({ success: false, message: errorMessages[0] });
    }

    if (password !== confirmPassword)
        return res.status(400).json({ success: false, message: 'Passwords do not match' });

    const existingUser = userDAL.findDuplicate(email, username);
    if (existingUser) {
        if (existingUser.email === email.toLowerCase())
            return res.status(400).json({ success: false, message: 'Email already registered' });
        return res.status(400).json({ success: false, message: 'Username already taken' });
    }

    const newUser = userDAL.insert({ fullName, username, org, email, phone, dob, password: hashPasswordSync(password) });
    auditDAL.log({ actor: newUser.username, action: 'signup', ip: req.ip || 'unknown' });

    res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        user: { id: newUser.id, username: newUser.username, email: newUser.email }
    });
});

app.post('/api/login', (req, res) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
        return res.status(429).json({
            success: false,
            message: `Too many failed attempts. Try again in ${Math.round(LOGIN_WINDOW_MS / 60000)} minutes.`
        });
    }

    const { identifier, password } = req.body;

    if (!identifier || !password)
        return res.status(400).json({ success: false, message: 'All fields are required' });

    if (typeof identifier !== 'string' || typeof password !== 'string')
        return res.status(400).json({ success: false, message: 'Invalid credentials format' });

    if (password.length < 6)
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const user = userDAL.findByEmailOrUsername(identifier);
    if (!user) {
        recordLoginFailure(ip);
        return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.active === 0) {
        recordLoginFailure(ip);
        return res.status(403).json({ success: false, message: 'Account has been deactivated. Contact an administrator.' });
    }

    if (!verifyPassword(password, user.password)) {
        recordLoginFailure(ip);
        return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    // Auto-upgrade legacy plaintext passwords to bcrypt on first successful login
    if (!BCRYPT_PREFIX_RE.test(user.password)) {
        try { userDAL.update(user.id, { username: user.username, email: user.email, password: hashPasswordSync(password) }); }
        catch (_) { /* best-effort upgrade */ }
    }

    clearLoginFailures(ip);
    userDAL.touchLogin(user.id);
    auditDAL.log({ actor: user.username, action: 'login', ip });
    res.json({
        success: true,
        message: 'Login successful!',
        user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role || 'user' }
    });
});

app.post('/api/forgot-password', (req, res) => {
    const { identifier } = req.body;

    if (!identifier)
        return res.status(400).json({ success: false, message: 'Please enter username or email' });

    const user = userDAL.findByEmailOrUsername(identifier);
    if (!user)
        return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'Email sent' });
});

app.get('/api/users', (req, res) => {
    const users = userDAL.findAll();
    const safeUsers = users.map(({ password, ...user }) => user);
    res.json({ success: true, users: safeUsers });
});

app.post('/api/update-profile', (req, res) => {
    const { userId, username, email, password } = req.body;

    if (!userId || !username || !email)
        return res.status(400).json({ success: false, message: 'Username and email are required' });

    const existing = userDAL.findById(userId);
    if (!existing)
        return res.status(404).json({ success: false, message: 'User not found' });

    const duplicate = userDAL.findDuplicate(email, username, userId);
    if (duplicate)
        return res.status(400).json({ success: false, message: 'Username or email already taken' });

    userDAL.update(userId, { username, email, password: password ? hashPasswordSync(password) : undefined });
    res.json({ success: true, message: 'Profile updated successfully' });
});

let previousCpus = os.cpus();
let currentCPU = 0;
let currentMem = 0;
let currentDisk = 0;
let currentNetIn = 0;   // KB/s inbound
let currentNetOut = 0;  // KB/s outbound
let unreadNotifications = 0;

// Populate real disk + network stats every 5 seconds
async function refreshSysStats() {
    try {
        // Disk: pick the filesystem with the highest use% (usually the OS drive)
        const fsList = await si.fsSize();
        if (fsList && fsList.length > 0) {
            currentDisk = Math.round(fsList.reduce((a, b) => (b.use > a.use ? b : a)).use);
        }
        // Network: sum all active interfaces, convert bytes/s → KB/s
        const nets = await si.networkStats();
        if (nets && nets.length > 0) {
            currentNetIn  = Math.round(nets.reduce((s, n) => s + (n.rx_sec || 0), 0) / 1024);
            currentNetOut = Math.round(nets.reduce((s, n) => s + (n.tx_sec || 0), 0) / 1024);
        }
    } catch (_) { /* keep previous values on error */ }
}
refreshSysStats();
setInterval(() => { refreshSysStats().catch(() => {}); }, 5000).unref();

// Per-metric "high since" + "alert sent" tracking for sustained-breach detection
const breachState = {
    CPU:    { since: null, sent: false },
    Memory: { since: null, sent: false },
    Disk:   { since: null, sent: false }
};
const SUSTAIN_MS = 60000; // 60s sustained breach before alert fires

function evaluateMetric(name, value, threshold) {
    const state = breachState[name];
    if (value > threshold) {
        if (state.since === null) {
            state.since = Date.now();
            console.log(`[WARNING] ${name} crossed ${threshold}% (now ${value}%). Starting ${SUSTAIN_MS / 1000}s timer...`);
        } else if (!state.sent && Date.now() - state.since >= SUSTAIN_MS) {
            const durationSec = Math.round((Date.now() - state.since) / 1000);
            const incidentId = 'INC-' + Math.floor(1000 + Math.random() * 9000);
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            alertDAL.insert({
                id:        incidentId,
                service:   name,
                threshold: `>${threshold}% for ${durationSec}s`,
                severity:  'high',
                status:    'Active',
                time
            });

            triggerRegisteredMailAlert(name, value, threshold, durationSec);
            unreadNotifications++;
            state.sent = true;
        }
    } else {
        if (state.since !== null)
            console.log(`[RECOVERY] ${name} dropped back to normal: ${value}%`);
        state.since = null;
        state.sent = false;
    }
}

setInterval(() => {
    const currentCpus = os.cpus();
    let totalIdleDiff = 0, totalTickDiff = 0;
    currentCpus.forEach((core, i) => {
        let prev = previousCpus[i].times, curr = core.times;
        let pTotal = 0, cTotal = 0;
        for (let t in curr) { cTotal += curr[t]; pTotal += prev[t]; }
        totalIdleDiff += (curr.idle - prev.idle);
        totalTickDiff += (cTotal - pTotal);
    });
    previousCpus = currentCpus;
    currentCPU = totalTickDiff === 0 ? 0 : Math.round(100 - (100 * totalIdleDiff / totalTickDiff));

    const totalMem = os.totalmem();
    currentMem = Math.round(((totalMem - os.freemem()) / totalMem) * 100);

    // currentDisk is now updated by refreshSysStats() interval

    const cfg = settingsDAL.getAll();
    evaluateMetric('CPU',    currentCPU,  cfg.cpuThreshold);
    evaluateMetric('Memory', currentMem,  cfg.memThreshold);
    evaluateMetric('Disk',   currentDisk, cfg.diskThreshold);

    // --- AI predictive layer: warn BEFORE thresholds are breached ----------
    try {
        const fired = predictor.runCycle(
            { cpu: currentCPU, mem: currentMem, disk: currentDisk },
            (p) => {
                unreadNotifications++;
                console.log(
                    `\n[PREDICTION] ${p.metric} (${p.kind}) conf=${p.confidence}` +
                    (p.etaSeconds ? ` eta=${p.etaSeconds}s` : '') +
                    `\n   ${p.reason}`
                );
            }
        );
        if (fired.length === 0) { /* nothing new */ }
    } catch (e) {
        console.error('[predictor] cycle failed:', e.message);
    }
}, 3000).unref();

function triggerRegisteredMailAlert(metricName, value, threshold, durationSec) {
    const cfg = settingsDAL.getAll();
    const users = userDAL.findAll();
    const subject = `[Verolla] ${metricName} sustained critical load`;
    const body =
        `CRITICAL SYSTEM ALERT\n` +
        `${metricName} has been above ${threshold}% for ${durationSec} continuous seconds.\n` +
        `Current value: ${value}%\n` +
        `Time: ${new Date().toISOString()}\n`;

    console.log('\n======================================================');
    console.log(subject);
    console.log(body);

    if (cfg.emailEnabled) {
        users.forEach(u => {
            if (mailTransporter && process.env.SMTP_FROM) {
                mailTransporter.sendMail({
                    from:    process.env.SMTP_FROM,
                    to:      u.email,
                    subject,
                    text:    body
                }).then(() => console.log(`-> Email delivered to ${u.email}`))
                  .catch(err => console.error(`-> Email FAILED for ${u.email}: ${err.message}`));
            } else {
                console.log(`-> [mock] Email to ${u.email} (configure SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM to deliver)`);
            }
        });
    }
    if (cfg.smsEnabled) {
        users.forEach(u => console.log(`-> [mock] SMS to ${u.phone}`));
    }
    console.log('======================================================\n');

    const now = new Date();
    notificationDAL.insert({
        time:      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        service:   metricName,
        alert:     `Sustained Critical Load (>${threshold}% for ${durationSec}s)`,
        severity:  'high',
        status:    'Sent',
        channel:   cfg.emailEnabled ? 'Email' : (cfg.smsEnabled ? 'SMS' : 'Console'),
        timestamp: now.getTime()
    });
}

// ---------------------------------------------------------------------------
// Application availability monitoring (HTTP/HTTPS reachability ping)
// ---------------------------------------------------------------------------
function pingTarget(target) {
    return new Promise(resolve => {
        let url;
        try { url = new URL(target); }
        catch { return resolve({ target, status: 'DOWN', latencyMs: null, statusCode: null, error: 'Invalid URL' }); }

        const lib = url.protocol === 'https:' ? https : http;
        const start = Date.now();
        const req = lib.get(url, { timeout: 5000 }, res => {
            const latencyMs = Date.now() - start;
            // Drain response
            res.on('data', () => {});
            res.on('end', () => {
                const ok = res.statusCode >= 200 && res.statusCode < 500;
                resolve({ target, status: ok ? 'UP' : 'DOWN', latencyMs, statusCode: res.statusCode });
            });
        });
        req.on('timeout', () => { req.destroy(new Error('timeout')); });
        req.on('error', err => {
            resolve({ target, status: 'DOWN', latencyMs: Date.now() - start, statusCode: null, error: err.message });
        });
    });
}

const availabilityState = {}; // target -> { downSince, alerted }
async function runAvailabilityChecks() {
    const cfg = settingsDAL.getAll();
    const targets = Array.isArray(cfg.availabilityTargets) ? cfg.availabilityTargets : [];
    for (const t of targets) {
        const result = await pingTarget(t);
        availabilityDAL.log(result);

        const state = availabilityState[t] || { downSince: null, alerted: false };
        if (result.status === 'DOWN') {
            if (state.downSince === null) state.downSince = Date.now();
            if (!state.alerted && Date.now() - state.downSince >= 30000) {
                const incidentId = 'INC-' + Math.floor(1000 + Math.random() * 9000);
                const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                alertDAL.insert({
                    id:        incidentId,
                    service:   'Availability',
                    threshold: `${t} unreachable >=30s`,
                    severity:  'high',
                    status:    'Active',
                    time
                });
                triggerRegisteredMailAlert('Availability', 0, 0, Math.round((Date.now() - state.downSince) / 1000));
                unreadNotifications++;
                state.alerted = true;
            }
        } else {
            if (state.alerted) console.log(`[RECOVERY] ${t} is reachable again.`);
            state.downSince = null;
            state.alerted = false;
        }
        availabilityState[t] = state;
    }
}
setInterval(() => { runAvailabilityChecks().catch(() => {}); }, 15000).unref();

app.get('/api/metrics', (req, res) => {
    const diskUsage   = currentDisk;
    const netInbound  = currentNetIn;
    const netOutbound = currentNetOut;

    // Active services = number of availability targets that are currently UP
    // (always includes the server itself, so minimum is 1)
    const availSummary = availabilityDAL.summary();
    const upCount = availSummary.filter(s => {
        const last = availabilityDAL.findRecent(1).find(r => r.target === s.target);
        return last && last.status === 'UP';
    }).length;
    const activeServicesCount = Math.max(1, upCount + 1); // +1 for this server process

    metricsDAL.logEntry({ cpuUsage: currentCPU, memUsage: currentMem, diskUsage, netInbound, netOutbound });

    // Compute real hour-over-hour deltas
    const hourAgo = metricsDAL.findHourAgo();
    const cpuTrend = hourAgo && hourAgo.cpuAvg != null
        ? Math.round((currentCPU - hourAgo.cpuAvg) * 10) / 10
        : null;  // null = not enough history yet
    const memTrend = hourAgo && hourAgo.memAvg != null
        ? Math.round((currentMem - hourAgo.memAvg) * 10) / 10
        : null;

    const allAlerts = alertDAL.findAll();
    res.json({
        success:        true,
        cpuUsage:       currentCPU,
        memUsage:       currentMem,
        diskUsage,
        cpuTrend,
        memTrend,
        activeServices: activeServicesCount,
        activeAlerts:   allAlerts.filter(a => a.status === 'Active').length,
        netInbound,
        netOutbound,
        unreadCount:    unreadNotifications,
        recentAlerts:   allAlerts.slice(0, 4)
    });
});

app.get('/api/alerts', (req, res) => {
    res.json({ success: true, alerts: alertDAL.findAll() });
});

app.post('/api/alerts/:id/resolve', (req, res) => {
    alertDAL.resolve(req.params.id);
    res.json({ success: true });
});

app.delete('/api/alerts/:id', (req, res) => {
    alertDAL.remove(req.params.id);
    res.json({ success: true });
});

app.get('/api/notifications', (req, res) => {
    const now = Date.now();
    const notifications = notificationDAL.findAll().map(n => ({
        ...n,
        hoursAgo: (now - n.timestamp) / (1000 * 60 * 60)
    }));
    res.json({ success: true, notifications });
});

app.get('/api/notifications/read', (req, res) => {
    unreadNotifications = 0;
    res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Settings endpoints (persist user thresholds + notification preferences)
// ---------------------------------------------------------------------------
app.get('/api/settings', (req, res) => {
    res.json({ success: true, settings: settingsDAL.getAll() });
});

app.post('/api/settings', (req, res) => {
    const allowed = ['cpuThreshold', 'memThreshold', 'diskThreshold', 'emailEnabled', 'smsEnabled', 'availabilityTargets'];
    const incoming = req.body || {};
    const update = {};

    for (const key of allowed) {
        if (!(key in incoming)) continue;
        const v = incoming[key];

        if (key.endsWith('Threshold')) {
            const n = Number(v);
            if (!Number.isFinite(n) || n < 1 || n > 100)
                return res.status(400).json({ success: false, message: `${key} must be 1-100` });
            update[key] = Math.round(n);
        } else if (key === 'emailEnabled' || key === 'smsEnabled') {
            if (typeof v !== 'boolean')
                return res.status(400).json({ success: false, message: `${key} must be boolean` });
            update[key] = v;
        } else if (key === 'availabilityTargets') {
            if (!Array.isArray(v) || v.some(x => typeof x !== 'string'))
                return res.status(400).json({ success: false, message: 'availabilityTargets must be an array of URLs' });
            update[key] = v;
        }
    }

    const merged = settingsDAL.setMany(update);
    res.json({ success: true, settings: merged });
});

// ---------------------------------------------------------------------------
// Availability endpoint (status of monitored URLs)
// ---------------------------------------------------------------------------
app.get('/api/availability', (req, res) => {
    res.json({
        success: true,
        summary: availabilityDAL.summary(),
        recent:  availabilityDAL.findRecent(50)
    });
});

// ---------------------------------------------------------------------------
// AI predictions endpoint (early-warning forecasts)
// ---------------------------------------------------------------------------
app.get('/api/predictions', (req, res) => {
    res.json({
        success: true,
        active:  predictionsDAL.findActive(),
        recent:  predictionsDAL.findRecent(25)
    });
});

// ---------------------------------------------------------------------------
// Health/liveness endpoint (for load balancers, uptime monitors, k8s probes)
// ---------------------------------------------------------------------------
const SERVER_STARTED_AT = Date.now();
app.get('/api/health', (req, res) => {
    let dbOk = false;
    try { require('./database').db.prepare('SELECT 1').get(); dbOk = true; } catch (_) {}
    res.status(dbOk ? 200 : 503).json({
        success:    dbOk,
        status:     dbOk ? 'ok' : 'degraded',
        uptimeSec:  Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
        nodeVersion: process.version,
        cpuUsage:   currentCPU,
        memUsage:   currentMem,
        mailer:     !!mailTransporter,
        time:       new Date().toISOString()
    });
});

// ---------------------------------------------------------------------------
// ADMIN API  (all routes below require x-admin-user header w/ admin role)
// ---------------------------------------------------------------------------

// Used by the client to discover the current user's role (no admin gate)
app.get('/api/me', (req, res) => {
    const id = (req.headers['x-admin-user'] || req.query.user || '').toString().trim();
    if (!id) return res.json({ success: true, user: null });
    const u = userDAL.findByEmailOrUsername(id);
    if (!u) return res.json({ success: true, user: null });
    res.json({
        success: true,
        user: {
            id: u.id, username: u.username, email: u.email, fullName: u.fullName,
            role: u.role || 'user', active: u.active === 1
        }
    });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
    res.json({
        success: true,
        uptimeSec: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
        startedAt: new Date(SERVER_STARTED_AT).toISOString(),
        nodeVersion: process.version,
        mailerActive: !!mailTransporter,
        ...adminDAL.stats()
    });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
    const rows = userDAL.findAll().map(u => ({
        id: u.id, fullName: u.fullName, username: u.username, email: u.email,
        org: u.org, role: u.role || 'user', active: u.active === 1,
        lastLogin: u.lastLogin || null, createdAt: u.createdAt
    }));
    res.json({ success: true, users: rows });
});

app.post('/api/admin/users/:id/role', requireAdmin, (req, res) => {
    const { role } = req.body || {};
    if (!['admin', 'user'].includes(role))
        return res.status(400).json({ success: false, message: 'role must be admin or user' });
    const target = userDAL.findById(Number(req.params.id));
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    // BUG-01 fix: prevent self-demote
    if (target.id === req.adminUser.id && role !== 'admin')
        return res.status(400).json({ success: false, message: 'Cannot change your own role' });

    // BUG-01 fix: never allow demoting the LAST remaining admin (system-lockout guard)
    if (role === 'user' && target.role === 'admin') {
        const adminCount = adminDAL.stats().admins;
        if (adminCount <= 1)
            return res.status(400).json({ success: false, message: 'Cannot demote the last remaining admin' });
    }

    userDAL.setRole(target.id, role);
    auditDAL.log({ actor: req.adminUser.username, action: 'set_role', target: target.username, details: role });
    res.json({ success: true });
});

app.post('/api/admin/users/:id/active', requireAdmin, (req, res) => {
    const { active } = req.body || {};
    if (typeof active !== 'boolean')
        return res.status(400).json({ success: false, message: 'active must be boolean' });
    const target = userDAL.findById(Number(req.params.id));
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.id === req.adminUser.id && !active)
        return res.status(400).json({ success: false, message: 'Cannot deactivate yourself' });
    userDAL.setActive(target.id, active);
    auditDAL.log({ actor: req.adminUser.username, action: active ? 'activate' : 'deactivate', target: target.username });
    res.json({ success: true });
});

app.post('/api/admin/users/:id/reset-password', requireAdmin, (req, res) => {
    const target = userDAL.findById(Number(req.params.id));
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    // Generate temp password (returned once to admin to share with the user)
    const temp = Math.random().toString(36).slice(-10) + 'A1!';
    userDAL.setPassword(target.id, hashPasswordSync(temp));
    auditDAL.log({ actor: req.adminUser.username, action: 'reset_password', target: target.username });
    res.json({ success: true, tempPassword: temp });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const target = userDAL.findById(Number(req.params.id));
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.id === req.adminUser.id)
        return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    userDAL.remove(target.id);
    auditDAL.log({ actor: req.adminUser.username, action: 'delete_user', target: target.username });
    res.json({ success: true });
});

app.get('/api/admin/audit', requireAdmin, (req, res) => {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    res.json({ success: true, entries: auditDAL.findRecent(limit) });
});

app.post('/api/admin/maintenance/purge-metrics', requireAdmin, (req, res) => {
    const days = Math.max(1, Number(req.body?.days) || 7);
    const r = adminDAL.purgeMetricsOlderThan(days);
    auditDAL.log({ actor: req.adminUser.username, action: 'purge_metrics', details: `older than ${days}d`, target: `${r.changes} rows` });
    res.json({ success: true, deleted: r.changes });
});

app.post('/api/admin/maintenance/purge-resolved-alerts', requireAdmin, (req, res) => {
    const r = adminDAL.purgeResolvedAlerts();
    auditDAL.log({ actor: req.adminUser.username, action: 'purge_resolved_alerts', target: `${r.changes} rows` });
    res.json({ success: true, deleted: r.changes });
});

module.exports = { app, validateEmail, validatePassword, validateUsername, validateDOB, validatePhone, predictor, hashPasswordSync, verifyPassword };

if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Login page:  http://localhost:${PORT}/login.html`);
        console.log(`Signup page: http://localhost:${PORT}/signup.html`);
    });

    // Graceful shutdown — close the HTTP server and SQLite handle cleanly.
    function shutdown(signal) {
        console.log(`\n[${signal}] Shutting down gracefully...`);
        server.close(() => {
            try { require('./database').db.close(); } catch (_) {}
            console.log('[shutdown] HTTP server + DB closed. Bye.');
            process.exit(0);
        });
        // Hard exit if cleanup hangs
        setTimeout(() => process.exit(1), 5000).unref();
    }
    process.on('SIGINT',  () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
