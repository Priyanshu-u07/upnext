# Real-Time Queue Management System

A digital queue management system that replaces physical token/notebook workflows at clinics and service centers. Customers join a queue, receive a server-generated token, and get real-time position updates via WebSockets.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + TypeScript + Express |
| Database | PostgreSQL + Prisma ORM |
| Real-time | Socket.IO |

## Getting Started

### Prerequisites
- Node.js 18+
- Docker (for PostgreSQL)

### Setup

```bash
# Start PostgreSQL
docker compose up -d

# Backend
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

## Architecture

```
Customer UI ──── REST + WebSocket ──── Express Backend ──── PostgreSQL
Staff UI    ──── REST + WebSocket ──┘         │
Display     ──── WebSocket ────────┘      Socket.IO
                                              │
                                     ┌────────┼────────┐
                                  Customer  Staff   Display
```

## License

MIT
