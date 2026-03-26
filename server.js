require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');
const mailer = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 1000 * 60 * 60 * 4 }, // 4 hours
    })
);

// ── Public routes ──────────────────────────────────────────

app.get('/', (_req, res) => res.render('index'));

// Public monthly availability for calendar
app.get('/api/calendar/month', async (req, res) => {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const availability = await db.getAvailabilityForMonth(year, month);
    res.json({ year, month, maxCapacity: db.MAX_CAPACITY, days: availability });
});

// Check availability for a date range
app.post('/api/availability', async (req, res) => {
    const { checkIn, checkOut } = req.body;
    if (!checkIn || !checkOut) return res.status(400).json({ error: 'Date mancanti' });
    const available = await db.checkAvailability(checkIn, checkOut);
    const days = db.calculateDays(checkIn, checkOut);
    res.json({ available, days, total: days * 15 });
});

// Create a booking
app.post('/api/bookings', async (req, res) => {
    const { ownerName, email, phone, dogName, breed, checkIn, checkOut, notes } = req.body;

    if (!ownerName || !email || !phone || !dogName || !checkIn || !checkOut) {
        return res.status(400).json({ error: 'Compila tutti i campi obbligatori.' });
    }

    if (!(await db.checkAvailability(checkIn, checkOut))) {
        return res.status(409).json({ error: 'Le date selezionate non sono disponibili.' });
    }

    const days = db.calculateDays(checkIn, checkOut);
    if (days <= 0) {
        return res.status(400).json({ error: 'Intervallo di date non valido.' });
    }

    const total = days * 15;

    const booking = await db.createBooking({
        ownerName,
        email,
        phone,
        dogName,
        breed: breed || '',
        checkIn,
        checkOut,
        days,
        total,
        notes: notes || '',
    });

    // Send email notification (fire-and-forget)
    mailer.sendBookingNotification(booking).catch((err) => {
        console.error('Errore invio email:', err.message);
    });

    res.json({ success: true, booking });
});

// ── Admin auth middleware ──────────────────────────────────

async function requireAdmin(req, res, next) {
    if (req.session.admin) return next();
    await res.redirect('/admin/login');
}

// ── Admin routes ──────────────────────────────────────────

app.get('/admin/login', (_req, res) => res.render('admin-login'));

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        req.session.admin = true;
        return res.redirect('/admin');
    }
    res.render('admin-login', { error: 'Credenziali non valide.' });
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

app.get('/admin', requireAdmin, async (req, res) => {
    const filter = req.query.filter || 'upcoming';
    const bookings = await db.getBookings(filter);
    res.render('admin', { bookings, filter });
});

app.post('/admin/bookings/:id/cancel', requireAdmin, async (req, res) => {
    await db.cancelBooking(req.params.id);
    res.redirect('/admin');
});

app.get('/admin/calendar', requireAdmin, (req, res) => {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    res.render('admin-calendar', { year, month });
});

app.get('/api/admin/calendar', requireAdmin, async (req, res) => {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const bookings = await db.getBookingsForMonth(year, month);
    const blockedDates = await db.getBlockedDatesForMonth(year, month);
    res.json({ year, month, bookings, blockedDates });
});

app.post('/api/admin/block-dates', requireAdmin, async (req, res) => {
    const { dates, reason } = req.body;
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({ error: 'Date mancanti' });
    }
    for (const date of dates) {
        await db.blockDate(date, reason || '');
    }
    res.json({ success: true, count: dates.length });
});

app.post('/api/admin/unblock-dates', requireAdmin, async (req, res) => {
    const { dates } = req.body;
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({ error: 'Date mancanti' });
    }
    for (const date of dates) {
        await db.unblockDate(date);
    }
    res.json({ success: true, count: dates.length });
});

// ── 404 ───────────────────────────────────────────────────

app.use((_req, res) => {
    res.status(404).render('404');
});

// ── Error handler ─────────────────────────────────────────

app.use((err, _req, res, _next) => {
    console.error('Errore server:', err);
    res.status(500).json({ error: 'Errore interno del server' });
});

// ── Start ─────────────────────────────────────────────────

db.initialize().then(() => {
    app.listen(PORT, () => {
        console.log(`Dog Fun avviato su http://localhost:${PORT}`);
    });
}).catch((err) => {
    console.error('Errore inizializzazione database:', err);
    process.exit(1);
});
