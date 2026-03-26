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

// Check availability for a date range
app.post('/api/availability', (req, res) => {
    const { checkIn, checkOut } = req.body;
    if (!checkIn || !checkOut) return res.status(400).json({ error: 'Date mancanti' });
    const available = db.checkAvailability(checkIn, checkOut);
    const days = db.calculateDays(checkIn, checkOut);
    res.json({ available, days, total: days * 15 });
});

// Create a booking
app.post('/api/bookings', async (req, res) => {
    const { ownerName, email, phone, dogName, breed, checkIn, checkOut, notes } = req.body;

    if (!ownerName || !email || !phone || !dogName || !checkIn || !checkOut) {
        return res.status(400).json({ error: 'Compila tutti i campi obbligatori.' });
    }

    if (!db.checkAvailability(checkIn, checkOut)) {
        return res.status(409).json({ error: 'Le date selezionate non sono disponibili.' });
    }

    const days = db.calculateDays(checkIn, checkOut);
    if (days <= 0) {
        return res.status(400).json({ error: 'Intervallo di date non valido.' });
    }

    const total = days * 15;

    const booking = db.createBooking({
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

function requireAdmin(req, res, next) {
    if (req.session.admin) return next();
    res.redirect('/admin/login');
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

app.get('/admin', requireAdmin, (req, res) => {
    const filter = req.query.filter || 'upcoming';
    const bookings = db.getBookings(filter);
    res.render('admin', { bookings, filter });
});

app.post('/admin/bookings/:id/cancel', requireAdmin, (req, res) => {
    db.cancelBooking(req.params.id);
    res.redirect('/admin');
});

// ── Start ─────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`Dog Fun avviato su http://localhost:${PORT}`);
});
