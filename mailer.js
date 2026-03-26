const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

async function sendBookingNotification(booking) {
    const to = process.env.NOTIFY_EMAIL;
    if (!to) {
        console.log('NOTIFY_EMAIL non configurata, email non inviata.');
        return;
    }

    const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
            <h2 style="color:#2c1810;border-bottom:3px solid #e8a020;padding-bottom:10px;">
                Nuova Prenotazione — Dog Fun
            </h2>
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
                <tr><td style="padding:8px 12px;font-weight:bold;color:#2c1810;">Proprietario</td>
                    <td style="padding:8px 12px;">${booking.ownerName}</td></tr>
                <tr style="background:#fdf6ec;"><td style="padding:8px 12px;font-weight:bold;color:#2c1810;">Email</td>
                    <td style="padding:8px 12px;">${booking.email}</td></tr>
                <tr><td style="padding:8px 12px;font-weight:bold;color:#2c1810;">Telefono</td>
                    <td style="padding:8px 12px;">${booking.phone}</td></tr>
                <tr style="background:#fdf6ec;"><td style="padding:8px 12px;font-weight:bold;color:#2c1810;">Cane</td>
                    <td style="padding:8px 12px;">${booking.dogName}${booking.breed ? ' (' + booking.breed + ')' : ''}</td></tr>
                <tr><td style="padding:8px 12px;font-weight:bold;color:#2c1810;">Arrivo</td>
                    <td style="padding:8px 12px;">${formatDate(booking.checkIn)}</td></tr>
                <tr style="background:#fdf6ec;"><td style="padding:8px 12px;font-weight:bold;color:#2c1810;">Partenza</td>
                    <td style="padding:8px 12px;">${formatDate(booking.checkOut)}</td></tr>
                <tr><td style="padding:8px 12px;font-weight:bold;color:#2c1810;">Durata</td>
                    <td style="padding:8px 12px;">${booking.days} giorni</td></tr>
                <tr style="background:#fdf6ec;"><td style="padding:8px 12px;font-weight:bold;color:#2c1810;">Totale</td>
                    <td style="padding:8px 12px;font-size:1.2em;font-weight:bold;color:#c4871a;">${booking.total}€</td></tr>
                ${booking.notes ? `<tr><td style="padding:8px 12px;font-weight:bold;color:#2c1810;">Note</td>
                    <td style="padding:8px 12px;">${booking.notes}</td></tr>` : ''}
            </table>
            <p style="margin-top:20px;color:#888;font-size:0.9em;">
                Gestisci le prenotazioni dalla <a href="http://localhost:${process.env.PORT || 3000}/admin">pagina admin</a>.
            </p>
        </div>
    `;

    await transporter.sendMail({
        from: `"Dog Fun" <${process.env.SMTP_USER}>`,
        to,
        subject: `Nuova prenotazione: ${booking.dogName} (${formatDate(booking.checkIn)} → ${formatDate(booking.checkOut)})`,
        html,
    });

    console.log(`Email inviata a ${to} per prenotazione #${booking.id}`);
}

module.exports = { sendBookingNotification };
