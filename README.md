# Dog Fun — Pensione per Cani

A booking website for a dog boarding service. Built with Node.js, Express, EJS, and SQLite.

## Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/mrgasco/dog-fun.git
   cd dog-fun
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:
   ```env
   PORT=3000
   SESSION_SECRET=your-secret-key
   ADMIN_USER=admin
   ADMIN_PASS=your-admin-password
   NOTIFY_EMAIL=your-email@example.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

4. Start the server:
   ```bash
   node server.js
   ```

   The app will be running at `http://localhost:3000`.

## How to Book

1. Go to the homepage at `http://localhost:3000`
2. Scroll down to the **Prenota il Soggiorno** section
3. Fill in the required fields: owner name, dog name, email, phone, check-in and check-out dates
4. Click **Verifica Disponibilità e Prenota**
5. If the dates are available, the booking is confirmed and a notification email is sent

The rate is **€15 per day**, all inclusive (boarding, meals, rest area).

## Admin Panel

1. Go to `http://localhost:3000/admin/login`
2. Log in with the `ADMIN_USER` and `ADMIN_PASS` credentials from your `.env` file
3. From the admin dashboard you can:
   - View upcoming, past, or all bookings
   - Cancel bookings
4. Log out at `http://localhost:3000/admin/logout`
