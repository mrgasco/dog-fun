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

// ── Helpers ───────────────────────────────────────────────

const MAX_CAPACITY = 10;

function calculateDays(checkIn, checkOut) {
    const ms = new Date(checkOut) - new Date(checkIn);
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function checkAvailability(checkIn, checkOut) {
    // For each day in range, count active bookings and ensure < MAX_CAPACITY
    const start = new Date(checkIn);
    const end = new Date(checkOut);

    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
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

module.exports = { calculateDays, checkAvailability, createBooking, getBookings, cancelBooking };
