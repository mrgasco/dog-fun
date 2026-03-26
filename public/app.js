// ── Date setup ────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0];
const checkInEl = document.getElementById('checkIn');
const checkOutEl = document.getElementById('checkOut');

checkInEl.min = today;
checkOutEl.min = today;

checkInEl.addEventListener('change', () => {
    const next = new Date(checkInEl.value);
    next.setDate(next.getDate() + 1);
    checkOutEl.min = next.toISOString().split('T')[0];
    if (checkOutEl.value && checkOutEl.value <= checkInEl.value) {
        checkOutEl.value = '';
    }
    updateSummary();
});

checkOutEl.addEventListener('change', updateSummary);

// ── Price & availability ──────────────────────────────────
async function updateSummary() {
    const summaryEl = document.getElementById('price-summary');
    const msgEl = document.getElementById('availability-msg');

    if (!checkInEl.value || !checkOutEl.value) {
        summaryEl.hidden = true;
        msgEl.hidden = true;
        return;
    }

    try {
        const res = await fetch('/api/availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkIn: checkInEl.value, checkOut: checkOutEl.value }),
        });
        const data = await res.json();

        if (data.days <= 0) {
            summaryEl.hidden = true;
            msgEl.hidden = true;
            return;
        }

        document.getElementById('numDays').textContent = data.days;
        document.getElementById('totalPrice').textContent = data.total + '\u20AC';
        summaryEl.hidden = false;

        msgEl.hidden = false;
        if (data.available) {
            msgEl.className = 'available';
            msgEl.textContent = 'Disponibile! Puoi procedere con la prenotazione.';
        } else {
            msgEl.className = 'unavailable';
            msgEl.textContent =
                'Spiacenti, le date selezionate non sono disponibili. Prova con date diverse.';
        }
    } catch {
        /* ignore network errors during typing */
    }
}

// ── Form submit ───────────────────────────────────────────
document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Invio in corso...';

    const form = e.target;
    const body = {
        ownerName: form.ownerName.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        dogName: form.dogName.value.trim(),
        breed: form.breed.value.trim(),
        checkIn: form.checkIn.value,
        checkOut: form.checkOut.value,
        notes: form.notes.value.trim(),
    };

    try {
        const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
            showModal('Errore', `<p>${data.error}</p>`, false);
            return;
        }

        const fmt = (d) =>
            new Date(d).toLocaleDateString('it-IT', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });

        showModal(
            'Prenotazione Confermata!',
            `<p><strong>${data.booking.ownerName}</strong>, la prenotazione per
             <strong>${data.booking.dogName}</strong> è stata confermata.</p>
             <p>Arrivo: ${fmt(data.booking.checkIn)}</p>
             <p>Partenza: ${fmt(data.booking.checkOut)}</p>
             <p>Durata: ${data.booking.days} giorni</p>
             <p style="font-size:1.4rem;font-weight:700;color:#c4871a;margin-top:.8rem;">
                Totale: ${data.booking.total}\u20AC
             </p>
             <p style="margin-top:1rem;color:#666;">Riceverai una conferma via email.</p>`,
            true
        );

        form.reset();
        document.getElementById('price-summary').hidden = true;
        document.getElementById('availability-msg').hidden = true;
    } catch {
        showModal('Errore', '<p>Errore di connessione. Riprova più tardi.</p>', false);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Verifica Disponibilità e Prenota';
    }
});

// ── Modal ─────────────────────────────────────────────────
function showModal(title, bodyHtml, success) {
    const modal = document.getElementById('modal');
    const icon = success ? '\u2705' : '\u274C';
    document.getElementById('modal-body').innerHTML = `
        <div class="check-icon">${icon}</div>
        <h3>${title}</h3>
        ${bodyHtml}
    `;
    modal.hidden = false;
}

document.querySelector('.modal-close').addEventListener('click', () => {
    document.getElementById('modal').hidden = true;
});

document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.hidden = true;
});

// ── Public availability calendar ──────────────────────────
const MONTH_NAMES_IT = [
    'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'
];

let ucalYear = new Date().getFullYear();
let ucalMonth = new Date().getMonth() + 1;

document.getElementById('ucal-prev').addEventListener('click', () => {
    ucalMonth--;
    if (ucalMonth < 1) { ucalMonth = 12; ucalYear--; }
    loadUserCalendar();
});

document.getElementById('ucal-next').addEventListener('click', () => {
    ucalMonth++;
    if (ucalMonth > 12) { ucalMonth = 1; ucalYear++; }
    loadUserCalendar();
});

async function loadUserCalendar() {
    document.getElementById('ucal-title').textContent =
        `${MONTH_NAMES_IT[ucalMonth - 1]} ${ucalYear}`;

    try {
        const res = await fetch(`/api/calendar/month?year=${ucalYear}&month=${ucalMonth}`);
        const data = await res.json();
        renderUserCalendar(data);
    } catch { /* ignore */ }
}

function renderUserCalendar(data) {
    const container = document.getElementById('ucal-days');
    container.innerHTML = '';

    const todayStr = new Date().toISOString().split('T')[0];
    const daysInMonth = new Date(data.year, data.month, 0).getDate();
    let firstDow = new Date(data.year, data.month - 1, 1).getDay();
    firstDow = firstDow === 0 ? 6 : firstDow - 1;

    for (let i = 0; i < firstDow; i++) {
        const empty = document.createElement('div');
        empty.className = 'ucal-day ucal-day-empty';
        container.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${data.year}-${String(data.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const info = data.days[dateStr] || { spots: 0, blocked: false, past: false };
        const cell = document.createElement('div');
        cell.className = 'ucal-day';

        const isToday = dateStr === todayStr;
        if (isToday) cell.classList.add('ucal-day-today');
        if (info.past) cell.classList.add('ucal-day-past');

        let statusHtml = '';
        if (info.past) {
            statusHtml = '';
        } else if (info.blocked) {
            statusHtml = '<span class="ucal-status ucal-status-blocked">Chiuso</span>';
        } else if (info.spots === 0) {
            statusHtml = '<span class="ucal-status ucal-status-full">Completo</span>';
        } else if (info.spots === 1) {
            statusHtml = `<span class="ucal-status ucal-status-limited">1 posto</span>`;
        } else {
            statusHtml = `<span class="ucal-status ucal-status-available">${info.spots} posti</span>`;
        }

        cell.innerHTML = `<span class="ucal-day-num">${d}</span>${statusHtml}`;
        container.appendChild(cell);
    }
}

loadUserCalendar();

// ── Smooth scroll ─────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
    });
});
