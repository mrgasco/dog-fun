const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// ── Schema ────────────────────────────────────────────────

async function initialize() {
    await db.execute(`
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

    await db.execute(`
        CREATE TABLE IF NOT EXISTS blocked_dates (
            date        TEXT PRIMARY KEY,
            reason      TEXT DEFAULT '',
            created_at  TEXT DEFAULT (datetime('now'))
        )
    `);
}

// ── Helpers ───────────────────────────────────────────────

const MAX_CAPACITY = 2;

function calculateDays(checkIn, checkOut) {
    const ms = new Date(checkOut) - new Date(checkIn);
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

async function isDateBlocked(dateStr) {
    const result = await db.execute({
        sql: 'SELECT 1 FROM blocked_dates WHERE date = ?',
        args: [dateStr],
    });
    return result.rows.length > 0;
}

async function checkAvailability(checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);

    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];

        if (await isDateBlocked(dateStr)) return false;

        const result = await db.execute({
            sql: `SELECT COUNT(*) AS cnt FROM bookings
                  WHERE status = 'confirmed'
                    AND check_in <= ? AND check_out > ?`,
            args: [dateStr, dateStr],
        });
        if (result.rows[0].cnt >= MAX_CAPACITY) return false;
    }
    return true;
}

async function createBooking(data) {
    const result = await db.execute({
        sql: `INSERT INTO bookings (owner_name, email, phone, dog_name, breed, check_in, check_out, days, total, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [data.ownerName, data.email, data.phone, data.dogName, data.breed, data.checkIn, data.checkOut, data.days, data.total, data.notes],
    });
    return { id: Number(result.lastInsertRowid), ...data, status: 'confirmed' };
}

async function getBookings(filter) {
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

    const result = await db.execute(sql);
    return result.rows;
}

async function cancelBooking(id) {
    await db.execute({
        sql: `UPDATE bookings SET status = 'cancelled' WHERE id = ?`,
        args: [id],
    });
}

async function getBookingsForMonth(year, month) {
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0);
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

    const result = await db.execute({
        sql: `SELECT * FROM bookings
              WHERE check_in <= ? AND check_out > ?
              ORDER BY status ASC, check_in ASC`,
        args: [lastDayStr, firstDay],
    });
    return result.rows;
}

async function blockDate(date, reason) {
    await db.execute({
        sql: 'INSERT OR REPLACE INTO blocked_dates (date, reason) VALUES (?, ?)',
        args: [date, reason || ''],
    });
}

async function unblockDate(date) {
    await db.execute({
        sql: 'DELETE FROM blocked_dates WHERE date = ?',
        args: [date],
    });
}

async function getBlockedDatesForMonth(year, month) {
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0);
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    const result = await db.execute({
        sql: 'SELECT * FROM blocked_dates WHERE date >= ? AND date <= ?',
        args: [firstDay, lastDayStr],
    });
    return result.rows;
}

async function getAvailabilityForMonth(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date().toISOString().split('T')[0];
    const result = {};

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        if (dateStr < today) {
            result[dateStr] = { spots: 0, blocked: false, past: true };
            continue;
        }

        const blocked = await isDateBlocked(dateStr);
        if (blocked) {
            result[dateStr] = { spots: 0, blocked: true, past: false };
            continue;
        }

        const row = await db.execute({
            sql: `SELECT COUNT(*) AS cnt FROM bookings
                  WHERE status = 'confirmed' AND check_in <= ? AND check_out > ?`,
            args: [dateStr, dateStr],
        });

        result[dateStr] = {
            spots: Math.max(0, MAX_CAPACITY - row.rows[0].cnt),
            blocked: false,
            past: false,
        };
    }
    return result;
}

module.exports = {
    initialize, calculateDays, checkAvailability, createBooking, getBookings, cancelBooking,
    getBookingsForMonth, blockDate, unblockDate, getBlockedDatesForMonth, getAvailabilityForMonth,
    MAX_CAPACITY,
};
