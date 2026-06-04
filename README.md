# Linguist AI-Flow

Kunlik ingliz tili o'rganish ilovasi: lug'at, SRS takrorlash, mavzuli so'zlar, AI roleplay, Speaking Lab va 100 kunlik challenge.

## Stack

- **Client:** React, Vite, Redux Toolkit Query, Tailwind, redux-persist
- **Server:** Express, MongoDB, JWT + refresh cookies, Gemini AI, Stripe billing

## Quick start

### Server

```bash
cd server
cp .env.example .env
# Fill MONGO_URI, JWT_SECRET, GEMINI_API_KEY
npm install
npm run dev
```

### Client

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

## Features

- **TodayHub** — 3 qadamli kunlik reja (Topic → Review → Roleplay)
- **Ustoz AI** — grammatika, so'z va iboralarni o'qituvchi sifatida tushuntirish
- **Caching** — RTK Query persist, server LRU for dictionary/topics
- **Security** — Helmet, rate limits, Zod validation, 15m access tokens
- **Billing** — Stripe checkout (Payme/Click stub for phase 2)

## Deploy

- Frontend: Vercel (`client/`)
- Backend: Render (`render.yaml`, `server/`)

Set `ALLOWED_ORIGIN` and `CLIENT_URL` to your production URLs.
