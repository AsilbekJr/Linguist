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

**Render → Environment** (service `linguist-backend`):

| Variable | Required | Example |
|----------|----------|---------|
| `JWT_SECRET` | Yes | Long random string (32+ chars) |
| `MONGO_URI` | Yes | `mongodb+srv://...` from MongoDB Atlas |
| `GEMINI_API_KEY` | Yes (AI features) | Google AI Studio key |
| `ALLOWED_ORIGIN` | Yes | `https://linguist-eight.vercel.app` |
| `CLIENT_URL` | Yes | `https://linguist-eight.vercel.app` |

Generate a secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not use `*` for `ALLOWED_ORIGIN` — credentialed CORS needs the exact frontend URL.

After saving env vars, click **Manual Deploy**.

**Vercel env:**

```env
VITE_API_URL=https://linguist-backend.onrender.com
```

Redeploy both services after changing env vars.
