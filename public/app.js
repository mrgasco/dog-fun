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

// ── Smooth scroll ─────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
    });
});
