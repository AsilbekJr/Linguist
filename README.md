# Linguist AI-Flow

O'zbek tilida so'zlashuvchilar uchun ingliz tili ilovasi: CEFR bo'yicha tartiblangan
kunlik kurs, SM-2 oraliqli takrorlash, tinglab yozish, AI o'qituvchi va gapirish mashqlari.

## Stack

- **Client:** React 18, Vite, Redux Toolkit Query, Tailwind 4, redux-persist
- **Server:** Express 5, MongoDB (Mongoose 9), JWT + refresh cookie sessiyalari, Gemini, Stripe
- **Testlar:** `node:test` + `mongodb-memory-server` (brauzer talab qilmaydi), Playwright (e2e)

## Tez boshlash

```bash
# Server
cd server
cp .env.example .env      # MONGO_URI, JWT_SECRET, GEMINI_API_KEY ni to'ldiring
npm install
npm run dev               # :5000

# Client
cd client
cp .env.example .env
npm install
npm run dev               # :5173
```

`GEMINI_API_KEY` bo'lmasa ilova ishlaydi — AI'ga bog'liq bo'lmagan barcha
funksiyalar (kunlik sahna, mini-test, flashcard, SRS) to'liq ishlaydi, AI
funksiyalari esa 503 qaytaradi va **foydalanuvchi progressiga tegmaydi**.

## Funksiyalar

### Kunlik reja (3 qadam)
1. **Kunlik sahna** — mavzu dialogi, so'zlar, mini-test
2. **Takrorlash** — SM-2 jadvali bo'yicha, 4 darajali baholash
3. **Amaliyot** — o'rganilgan so'zlardan gap tuzish, AI tekshiradi

### Tinglash (diktant)
Kunlik dialog qatorlarini eshitib yozish — ilovadagi yagona **input** mashqi.
Baholash so'z darajasida (`server/utils/dictation.js`, LCS asosida): qaysi so'z
o'tkazib yuborilgani va qaysi biri ortiqcha yozilgani rangli ko'rsatiladi.
Qisqartmalar (`don't` = `do not`) teng qabul qilinadi.

Ovoz brauzerning `speechSynthesis`i orqali chiqariladi — tashqi TTS xizmati
talab qilinmaydi, lekin ovoz sifati qurilmaga bog'liq. Tezlikni sekinlashtirish
mumkin (0.6× / 0.95× / 1.15×).

Bu mashq kunlik 3 qadamga **kirmaydi** va streak'ni bloklamaydi — kunlik yukni
oshirib, reja bajarilishini tushirmaslik uchun ataylab ixtiyoriy qoldirilgan.

### Kontent
24 mavzu, 240 so'z, A1 → A2. Har bir mavzuda dialog (o'zbekcha tarjima bilan),
grammatika fokusi, IPA, ta'rif, misol va kollokatsiyalar.

Kontent **validator** bilan himoyalangan (`server/content/schema.js`):
- so'z mavzu dialogida haqiqatan ishlatilishi shart;
- unikal so'zlar ulushi ≥ 85%;
- CEFR daraja pasaymasligi kerak;
- boshlang'ich kunlarda C1 leksika bo'lmasligi kerak.

Xato topilsa build to'xtaydi va yaroqsiz kontent `data/topics.json` ga yetib bormaydi.

```bash
cd server
npm run content:build       # curriculum/*.js  →  data/topics.json (validatsiya bilan)
npm run content:challenges  # topics.json      →  data/challenges.json
npm run content:validate    # faqat tekshirish
```

Yangi mavzu qo'shish: `server/content/curriculum/` ichida kortej formatida yozing
va `npm run content:build` ni ishga tushiring.

### Oraliqli takrorlash (SM-2)
`server/utils/srs.js` — har so'z uchun individual ease factor, 4 darajali baholash
(Eslay olmadim / Qiyin / Esladim / Juda oson), lapse mantiqi. So'z hech qachon
takrorlashdan butunlay chiqib ketmaydi.

### Xavfsizlik
- 15 daqiqalik access token + hash'langan refresh sessiyalar
- Parolni tiklash: bir martalik hash'langan token, 1 soat, sessiyalarni bekor qiladi
- Zod validatsiya, Helmet, hpp, CORS (aniq origin), rate limit
- Mini-test serverda baholanadi — mijoz natijaga ta'sir qila olmaydi

## Testlar

```bash
cd server && npm test     # 78 ta test; pretest kontentni validatsiya qiladi
cd client && npm run lint
cd client && npm run build

# Brauzer testlari (ixtiyoriy)
npm i -D @playwright/test && npx playwright install chromium
npx playwright test
```

## Deploy

- **Frontend:** Vercel (`client/`) — `VITE_API_URL=https://<backend>.onrender.com`
- **Backend:** Render (`render.yaml`, `server/`)

**Render → Environment:**

| O'zgaruvchi | Majburiy | Izoh |
|---|---|---|
| `JWT_SECRET` | ha | 32+ belgi tasodifiy satr |
| `MONGO_URI` | ha | MongoDB Atlas |
| `ALLOWED_ORIGIN` | ha | Aniq frontend URL (`*` ishlamaydi) |
| `CLIENT_URL` | ha | Xatlardagi havolalar uchun ham kerak |
| `GEMINI_API_KEY` | AI uchun | Yo'q bo'lsa AI funksiyalari 503 qaytaradi |
| `DEFAULT_TIMEZONE` | yo'q | Default `Asia/Tashkent` |
| `MAIL_PROVIDER` + kalit | tiklash uchun | `resend` yoki `brevo`; yo'q bo'lsa xat logga chiqadi |
| `STRIPE_*` | to'lov uchun | Quyidagi izohga qarang |

Maxfiy kalit generatsiya qilish:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`ALLOWED_ORIGIN` uchun `*` ishlatib bo'lmaydi — cookie bilan ishlaydigan CORS
aniq URL talab qiladi.

## Ma'lum cheklovlar

Bu ro'yxat ataylab ochiq — mahsulot hali bularni qila olmaydi:

- **To'lov.** Stripe O'zbekiston kartalarini qabul qilmaydi. Payme/Click
  integratsiyasi hali yo'q, ya'ni mahalliy bozordan daromad olish imkonsiz.
- **Talaffuz bahosi.** `evaluateSpokenAccuracy` talaffuzni emas, brauzer
  `SpeechRecognition` transkriptining matnga mosligini o'lchaydi. Natija
  `method: 'transcript_match'` bilan belgilanadi va UI uni "talaffuz bahosi"
  deb ko'rsatmasligi kerak. Haqiqiy baho uchun fonema darajasidagi xizmat kerak.
- **Daraja aniqlash.** Foydalanuvchi darajasini o'zi tanlaydi; adaptiv
  placement test yo'q.
- **Kontent hajmi.** 24 kun (A1-A2). B1+ hali yozilmagan.
- **i18n yo'q**, **PWA yo'q**, **analitika/xato monitoringi yo'q**.
