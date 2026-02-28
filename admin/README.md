# Sonia Admin Panel

A React + Vite admin panel for managing the Sonia AI assistant system.

## Features

- 🔐 **Password-protected login** (password: `1234`, matching the mobile app)
- 📋 **Commands** — view all commands, add new ones (creates a Vapi assistant via the backend)
- 📞 **Calls** — see the last-called date for each assistant
- 🔔 **Notifications** — send push notifications to all registered devices

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example env file and set the backend URL:
   ```bash
   cp .env.example .env.local
   # Edit VITE_API_BASE_URL to point to your Django backend
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5175](http://localhost:5175) in your browser.

## Build

```bash
npm run build
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Django backend URL |
