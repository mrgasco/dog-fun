const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'dogfun.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────

db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_name  TEXT NOT NULL,
        email       TEXT NOT NULL,
        phone       TEXT NOT NULL,
        dog_name    TEXT NOT NULL,
        breed       TEXT DEFAULT '',
        check_in    TEXT NOT NULL,
        check_out   TEXT NOT NULL,
        days        INTEGER NOT NULL,
        total       REAL NOT NULL,
        notes       TEXT DEFAULT '',
        status      TEXT DEFAULT 'confirmed',
        created_at  TEXT DEFAULT (datetime('now'))
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS blocked_dates (
        date        TEXT PRIMARY KEY,
        reason      TEXT DEFAULT '',
        created_at  TEXT DEFAULT (datetime('now'))
    )
`);

// ── Helpers ───────────────────────────────────────────────

const MAX_CAPACITY = 2;

function calculateDays(checkIn, checkOut) {
    const ms = new Date(checkOut) - new Date(checkIn);
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function isDateBlocked(dateStr) {
    const row = db.prepare('SELECT 1 FROM blocked_dates WHERE date = ?').get(dateStr);
    return !!row;
}

function checkAvailability(checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);

    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];

        // Check if day is blocked by admin
        if (isDateBlocked(dateStr)) return false;

        // Check capacity
        const row = db
            .prepare(
                `SELECT COUNT(*) AS cnt FROM bookings
             WHERE status = 'confirmed'
               AND check_in <= ? AND check_out > ?`
            )
            .get(dateStr, dateStr);
        if (row.cnt >= MAX_CAPACITY) return false;
    }
    return true;
}

function createBooking(data) {
    const stmt = db.prepare(`
        INSERT INTO bookings (owner_name, email, phone, dog_name, breed, check_in, check_out, days, total, notes)
        VALUES (@ownerName, @email, @phone, @dogName, @breed, @checkIn, @checkOut, @days, @total, @notes)
    `);
    const result = stmt.run(data);
    return { id: result.lastInsertRowid, ...data, status: 'confirmed' };
}

function getBookings(filter) {
    const today = new Date().toISOString().split('T')[0];
    let sql = 'SELECT * FROM bookings';

    if (filter === 'upcoming') {
        sql += ` WHERE check_in >= '${today}' AND status = 'confirmed' ORDER BY check_in ASC`;
    } else if (filter === 'past') {
        sql += ` WHERE check_out < '${today}' ORDER BY check_in DESC`;
    } else if (filter === 'cancelled') {
        sql += ` WHERE status = 'cancelled' ORDER BY created_at DESC`;
    } else {
        sql += ' ORDER BY check_in DESC';
    }

    return db.prepare(sql).all();
}

function cancelBooking(id) {
    db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(id);
}

function getBookingsForMonth(year, month) {
    // Get all bookings (confirmed + cancelled) that overlap with the given month
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0);
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

    return db.prepare(`
        SELECT * FROM bookings
        WHERE check_in <= ? AND check_out > ?
        ORDER BY status ASC, check_in ASC
    `).all(lastDayStr, firstDay);
}

function blockDate(date, reason) {
    db.prepare('INSERT OR REPLACE INTO blocked_dates (date, reason) VALUES (?, ?)').run(date, reason || '');
}

function unblockDate(date) {
    db.prepare('DELETE FROM blocked_dates WHERE date = ?').run(date);
}

function getBlockedDatesForMonth(year, month) {
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0);
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    return db.prepare('SELECT * FROM blocked_dates WHERE date >= ? AND date <= ?').all(firstDay, lastDayStr);
}

function getAvailabilityForMonth(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date().toISOString().split('T')[0];
    const result = {};

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        if (dateStr < today) {
            result[dateStr] = { spots: 0, blocked: false, past: true };
            continue;
        }

        const blocked = isDateBlocked(dateStr);
        if (blocked) {
            result[dateStr] = { spots: 0, blocked: true, past: false };
            continue;
        }

        const row = db.prepare(
            `SELECT COUNT(*) AS cnt FROM bookings
             WHERE status = 'confirmed' AND check_in <= ? AND check_out > ?`
        ).get(dateStr, dateStr);

        result[dateStr] = {
            spots: Math.max(0, MAX_CAPACITY - row.cnt),
            blocked: false,
            past: false,
        };
    }
    return result;
}

module.exports = {
    calculateDays, checkAvailability, createBooking, getBookings, cancelBooking,
    getBookingsForMonth, blockDate, unblockDate, getBlockedDatesForMonth, getAvailabilityForMonth,
    MAX_CAPACITY,
};
