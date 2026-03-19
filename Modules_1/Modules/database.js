const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'verolla.db');

function createDatabase(dbPath = DB_PATH) {
    const db = new Database(dbPath);

    db.pragma('journal_mode = WAL');

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            fullName    TEXT    NOT NULL,
            username    TEXT    NOT NULL UNIQUE,
            org         TEXT    NOT NULL,
            email       TEXT    NOT NULL UNIQUE,
            phone       TEXT    NOT NULL,
            dob         TEXT    NOT NULL,
            password    TEXT    NOT NULL,
            createdAt   TEXT    NOT NULL
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS alerts (
            id          TEXT    PRIMARY KEY,
            service     TEXT    NOT NULL,
            threshold   TEXT    NOT NULL,
            severity    TEXT    NOT NULL,
            status      TEXT    NOT NULL DEFAULT 'Active',
            time        TEXT    NOT NULL
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            time        TEXT    NOT NULL,
            service     TEXT    NOT NULL,
            alert       TEXT    NOT NULL,
            severity    TEXT    NOT NULL,
            status      TEXT    NOT NULL,
            channel     TEXT    NOT NULL,
            timestamp   INTEGER NOT NULL
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS metrics_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            cpuUsage    INTEGER NOT NULL,
            memUsage    INTEGER NOT NULL,
            diskUsage   INTEGER NOT NULL,
            netInbound  INTEGER NOT NULL,
            netOutbound INTEGER NOT NULL,
            recordedAt  TEXT    NOT NULL
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS availability_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            target      TEXT    NOT NULL,
            status      TEXT    NOT NULL,
            latencyMs   INTEGER,
            statusCode  INTEGER,
            checkedAt   TEXT    NOT NULL
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS predictions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            metric       TEXT    NOT NULL,
            kind         TEXT    NOT NULL,
            confidence   REAL    NOT NULL,
            etaSeconds   INTEGER,
            currentValue INTEGER NOT NULL,
            threshold    INTEGER NOT NULL,
            slope        REAL,
            reason       TEXT    NOT NULL,
            status       TEXT    NOT NULL DEFAULT 'Active',
            createdAt    INTEGER NOT NULL,
            resolvedAt   INTEGER
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            actor     TEXT    NOT NULL,
            action    TEXT    NOT NULL,
            target    TEXT,
            details   TEXT,
            ip        TEXT,
            createdAt TEXT    NOT NULL
        );
    `);

    // ── Migrations ──────────────────────────────────────────────────────────
    // Add `role` column to existing users tables if it doesn't already exist.
    const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    if (!userCols.includes('role')) {
        db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
    }
    if (!userCols.includes('active')) {
        db.exec("ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
    }
    if (!userCols.includes('lastLogin')) {
        db.exec("ALTER TABLE users ADD COLUMN lastLogin TEXT");
    }

    // Promote first user to admin if no admin exists yet (also accepts ADMIN_EMAILS env override)
    const hasAdmin = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
    if (!hasAdmin) {
        const envEmails = (process.env.ADMIN_EMAILS || '')
            .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        if (envEmails.length) {
            const placeholders = envEmails.map(() => '?').join(',');
            db.prepare(`UPDATE users SET role = 'admin' WHERE LOWER(email) IN (${placeholders})`).run(...envEmails);
        } else {
            // Fallback: promote the very first registered user
            db.exec("UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users)");
        }
    }

    return db;
}

const db = createDatabase();

module.exports = { db, createDatabase };
