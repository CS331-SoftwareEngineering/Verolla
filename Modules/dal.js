const { db } = require('./database');

const userDAL = {
    findAll() {
        return db.prepare('SELECT * FROM users').all();
    },

    findByEmailOrUsername(identifier) {
        const lower = identifier.toLowerCase();
        return db.prepare(
            'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?'
        ).get(lower, lower);
    },

    findById(id) {
        return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    },

    findDuplicate(email, username, excludeId = null) {
        if (excludeId) {
            return db.prepare(
                'SELECT * FROM users WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND id != ?'
            ).get(email.toLowerCase(), username.toLowerCase(), excludeId);
        }
        return db.prepare(
            'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?'
        ).get(email.toLowerCase(), username.toLowerCase());
    },

    insert({ fullName, username, org, email, phone, dob, password }) {
        const createdAt = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO users (fullName, username, org, email, phone, dob, password, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            fullName.trim(),
            username.toLowerCase(),
            org.trim(),
            email.toLowerCase(),
            phone,
            dob,
            password,
            createdAt
        );
        return this.findById(result.lastInsertRowid);
    },

    update(id, { username, email, password }) {
        if (password && password.length >= 6) {
            db.prepare(
                'UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?'
            ).run(username.toLowerCase(), email.toLowerCase(), password, id);
        } else {
            db.prepare(
                'UPDATE users SET username = ?, email = ? WHERE id = ?'
            ).run(username.toLowerCase(), email.toLowerCase(), id);
        }
        return this.findById(id);
    },

    remove(id) {
        return db.prepare('DELETE FROM users WHERE id = ?').run(id);
    },

    setRole(id, role) {
        return db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    },

    setActive(id, active) {
        return db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
    },

    setPassword(id, hashedPassword) {
        return db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, id);
    },

    touchLogin(id) {
        return db.prepare('UPDATE users SET lastLogin = ? WHERE id = ?').run(new Date().toISOString(), id);
    }
};

const alertDAL = {
    findAll() {
        return db.prepare('SELECT * FROM alerts ORDER BY rowid DESC').all();
    },

    findById(id) {
        return db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
    },

    insert({ id, service, threshold, severity, status = 'Active', time }) {
        db.prepare(`
            INSERT INTO alerts (id, service, threshold, severity, status, time)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, service, threshold, severity, status, time);
        return this.findById(id);
    },

    resolve(id) {
        db.prepare("UPDATE alerts SET status = 'Resolved' WHERE id = ?").run(id);
        return this.findById(id);
    },

    remove(id) {
        return db.prepare('DELETE FROM alerts WHERE id = ?').run(id);
    }
};

const notificationDAL = {
    findAll() {
        return db.prepare('SELECT * FROM notifications ORDER BY timestamp DESC').all();
    },

    count() {
        return db.prepare('SELECT COUNT(*) as cnt FROM notifications').get().cnt;
    },

    insert({ time, service, alert, severity, status, channel, timestamp }) {
        db.prepare(`
            INSERT INTO notifications (time, service, alert, severity, status, channel, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(time, service, alert, severity, status, channel, timestamp);

        const count = this.count();
        if (count > 50) {
            db.prepare(`
                DELETE FROM notifications WHERE id IN (
                    SELECT id FROM notifications ORDER BY timestamp ASC LIMIT ?
                )
            `).run(count - 50);
        }
    }
};

const metricsDAL = {
    logEntry({ cpuUsage, memUsage, diskUsage, netInbound, netOutbound }) {
        db.prepare(`
            INSERT INTO metrics_log (cpuUsage, memUsage, diskUsage, netInbound, netOutbound, recordedAt)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(cpuUsage, memUsage, diskUsage, netInbound, netOutbound, new Date().toISOString());
    },

    findRecent(n = 20) {
        return db.prepare(
            'SELECT * FROM metrics_log ORDER BY id DESC LIMIT ?'
        ).all(n);
    },

    // Returns the average CPU and memory from rows recorded ~1 hour ago (55–65 min window)
    findHourAgo() {
        const now = Date.now();
        const from = new Date(now - 65 * 60 * 1000).toISOString();
        const to   = new Date(now - 55 * 60 * 1000).toISOString();
        return db.prepare(
            'SELECT AVG(cpuUsage) as cpuAvg, AVG(memUsage) as memAvg FROM metrics_log WHERE recordedAt BETWEEN ? AND ?'
        ).get(from, to);
    }
};

const DEFAULT_SETTINGS = {
    cpuThreshold:    85,
    memThreshold:    80,
    diskThreshold:   90,
    emailEnabled:    true,
    smsEnabled:      false,
    availabilityTargets: ['http://localhost:3000/api/metrics']
};

const settingsDAL = {
    getAll() {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const stored = {};
        for (const r of rows) {
            try { stored[r.key] = JSON.parse(r.value); }
            catch { stored[r.key] = r.value; }
        }
        return { ...DEFAULT_SETTINGS, ...stored };
    },

    get(key) {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        if (!row) return DEFAULT_SETTINGS[key];
        try { return JSON.parse(row.value); } catch { return row.value; }
    },

    set(key, value) {
        const serialized = JSON.stringify(value);
        db.prepare(`
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(key, serialized);
        return value;
    },

    setMany(obj) {
        const stmt = db.prepare(`
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        const tx = db.transaction((entries) => {
            for (const [k, v] of entries) stmt.run(k, JSON.stringify(v));
        });
        tx(Object.entries(obj));
        return this.getAll();
    }
};

const availabilityDAL = {
    log({ target, status, latencyMs, statusCode }) {
        db.prepare(`
            INSERT INTO availability_log (target, status, latencyMs, statusCode, checkedAt)
            VALUES (?, ?, ?, ?, ?)
        `).run(target, status, latencyMs, statusCode, new Date().toISOString());

        const total = db.prepare('SELECT COUNT(*) as cnt FROM availability_log').get().cnt;
        if (total > 500) {
            db.prepare(`
                DELETE FROM availability_log WHERE id IN (
                    SELECT id FROM availability_log ORDER BY id ASC LIMIT ?
                )
            `).run(total - 500);
        }
    },

    findRecent(n = 50) {
        return db.prepare(
            'SELECT * FROM availability_log ORDER BY id DESC LIMIT ?'
        ).all(n);
    },

    summary() {
        const rows = db.prepare(`
            SELECT target,
                   SUM(CASE WHEN status = 'UP'   THEN 1 ELSE 0 END) AS up,
                   SUM(CASE WHEN status = 'DOWN' THEN 1 ELSE 0 END) AS down,
                   AVG(latencyMs) AS avgLatency,
                   MAX(checkedAt) AS lastChecked
            FROM availability_log
            GROUP BY target
        `).all();
        return rows.map(r => ({
            ...r,
            uptimePct: r.up + r.down === 0 ? 100 : Math.round((r.up / (r.up + r.down)) * 1000) / 10
        }));
    }
};

const predictionsDAL = {
    findActive() {
        return db.prepare("SELECT * FROM predictions WHERE status = 'Active' ORDER BY id DESC").all();
    },

    findRecent(n = 50) {
        return db.prepare('SELECT * FROM predictions ORDER BY id DESC LIMIT ?').all(n);
    },

    findActiveByKey(metric, kind) {
        return db.prepare(
            "SELECT * FROM predictions WHERE metric = ? AND kind = ? AND status = 'Active' ORDER BY id DESC LIMIT 1"
        ).get(metric, kind);
    },

    insert({ metric, kind, confidence, etaSeconds, currentValue, threshold, slope, reason }) {
        const stmt = db.prepare(`
            INSERT INTO predictions (metric, kind, confidence, etaSeconds, currentValue, threshold, slope, reason, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
        `);
        const r = stmt.run(metric, kind, confidence, etaSeconds, currentValue, threshold, slope, reason, Date.now());
        return db.prepare('SELECT * FROM predictions WHERE id = ?').get(r.lastInsertRowid);
    },

    resolveByKey(metric, kind) {
        db.prepare(
            "UPDATE predictions SET status = 'Resolved', resolvedAt = ? WHERE metric = ? AND kind = ? AND status = 'Active'"
        ).run(Date.now(), metric, kind);
    },

    // Pull breach events from notifications table for pattern analysis
    historicalBreachHours(metric) {
        const rows = db.prepare(
            "SELECT timestamp FROM notifications WHERE service = ? ORDER BY timestamp DESC LIMIT 200"
        ).all(metric);
        return rows.map(r => {
            const d = new Date(r.timestamp);
            return { hour: d.getHours(), dow: d.getDay(), ts: r.timestamp };
        });
    },

    pruneOld(maxRows = 500) {
        const cnt = db.prepare('SELECT COUNT(*) as c FROM predictions').get().c;
        if (cnt > maxRows) {
            db.prepare(`
                DELETE FROM predictions WHERE id IN (
                    SELECT id FROM predictions ORDER BY id ASC LIMIT ?
                )
            `).run(cnt - maxRows);
        }
    }
};

// ─── Audit log ───────────────────────────────────────────────────────────────
const auditDAL = {
    log({ actor, action, target = null, details = null, ip = null }) {
        db.prepare(`
            INSERT INTO audit_log (actor, action, target, details, ip, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(actor, action, target, details, ip, new Date().toISOString());
    },

    findRecent(limit = 100) {
        return db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit);
    },

    pruneOld(maxRows = 1000) {
        const cnt = db.prepare('SELECT COUNT(*) as c FROM audit_log').get().c;
        if (cnt > maxRows) {
            db.prepare(`
                DELETE FROM audit_log WHERE id IN (
                    SELECT id FROM audit_log ORDER BY id ASC LIMIT ?
                )
            `).run(cnt - maxRows);
        }
    }
};

// ─── Admin aggregate stats ────────────────────────────────────────────────────
const adminDAL = {
    stats() {
        return {
            users:           db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
            activeUsers:     db.prepare('SELECT COUNT(*) AS n FROM users WHERE active = 1').get().n,
            admins:          db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n,
            alertsTotal:     db.prepare('SELECT COUNT(*) AS n FROM alerts').get().n,
            alertsActive:    db.prepare("SELECT COUNT(*) AS n FROM alerts WHERE status = 'Active'").get().n,
            predictionsTotal:db.prepare('SELECT COUNT(*) AS n FROM predictions').get().n,
            predictionsActive:db.prepare("SELECT COUNT(*) AS n FROM predictions WHERE status = 'Active'").get().n,
            metricsRows:     db.prepare('SELECT COUNT(*) AS n FROM metrics_log').get().n,
            availabilityRows:db.prepare('SELECT COUNT(*) AS n FROM availability_log').get().n,
            auditRows:       db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n
        };
    },

    purgeMetricsOlderThan(days) {
        const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
        return db.prepare('DELETE FROM metrics_log WHERE recordedAt < ?').run(cutoff);
    },

    purgeResolvedAlerts() {
        return db.prepare("DELETE FROM alerts WHERE status = 'Resolved'").run();
    }
};

module.exports = { userDAL, alertDAL, notificationDAL, metricsDAL, settingsDAL, availabilityDAL, predictionsDAL, auditDAL, adminDAL };
