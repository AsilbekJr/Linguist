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

### Daraja aniqlash (placement)
Onboarding'ning birinchi qadami: adaptiv test, ~12 savol, 2 daqiqa.
A2 dan boshlanadi; har darajada 3 savol, 2/3 dan yuqori bo'lsa yuqoriga,
past bo'lsa pastga (`server/content/placement.js`).

Natija kursning **boshlanish kunini** belgilaydi: A1/A2 → 1-kun,
B1/B2 → 25-kun. Ilgari daraja tanlansa ham hamma 1-kundan boshlardi.

Savollar va to'g'ri javoblar serverda — natijani ko'tarib olish mumkin emas.
Testni o'tkazib yuborib darajani o'zi tanlash ham mumkin.

### Kontent
30 mavzu, 300 so'z, A1 → A2 → B1. Har bir mavzuda dialog (o'zbekcha tarjima
bilan), grammatika fokusi, IPA, ta'rif, misol va kollokatsiyalar.

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

### Kunlik eslatmalar
Kunlik reja bajarilmagan bo'lsa, foydalanuvchining **mahalliy** soatida
(default 19:00) email yuboriladi. Xabar mazmunli: streak bor bo'lsa aynan
uning xavf ostida ekani, muzlatish qolgan-qolmagani va qaysi qadamlar
bajarilmagani aytiladi.

Yuborilmaydi: reja tugagan, kuniga ikkinchi marta, onboarding tugamagan,
30 kundan beri faol bo'lmagan (spam va pochta obro'si uchun).

Har bir xatda obunani bekor qilish havolasi bor va u **login talab qilmaydi** —
aks holda odam "spam" tugmasini bosadi va domen obro'si tushadi.

Render bepul tarifida doimiy jarayon yo'q, shuning uchun tashqi cron
soatiga bir marta chaqiradi:

```bash
curl -X POST https://<backend>/api/notifications/run \
     -H "x-cron-secret: $CRON_SECRET"
```

### PWA
Ilova telefon bosh ekraniga o'rnatiladi va oflaynda ochiladi. Bu eslatma
zanjirini yopadi: xat keladi → bosiladi → ilova bir bosishda ochiladi
(brauzerdan qidirish shart emas).

Service worker uchta qat'iy qoida bilan ishlaydi:
1. **API javoblari hech qachon keshlanmaydi** — ular foydalanuvchi ma'lumoti;
2. navigatsiya — avval tarmoq, oflaynda keshdagi app shell;
3. `assets/` — kontent-xesh bilan nomlangani uchun stale-while-revalidate.

Birinchi qoida `npm run check:pwa` bilan build vaqtida tekshiriladi — bunday
regressiyani qo'lda sinovda payqash deyarli imkonsiz.

Ikonkalar `npm run icons` bilan generatsiya qilinadi: `sharp`/`canvas` kabi
native paket o'rniga zlib + CRC32 bilan yozilgan kichik PNG enkoder
(`scripts/generate-icons.js`).

iOS Safari `beforeinstallprompt` ni qo'llab-quvvatlamaydi, shuning uchun u
yerda "Share → Bosh ekranga qo'shish" ko'rsatmasi ko'rsatiladi.

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
cd server && npm test     # 132 ta test; pretest kontentni validatsiya qiladi
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
| `CRON_SECRET` | eslatma uchun | Tashqi cron shu sir bilan chaqiradi |
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
- **Kontent hajmi.** 30 kun (A1-B1). B2 hali yozilmagan — placement B2 desa ham
  kurs mavjud eng yuqori blokdan (B1) boshlanadi.
- **Push bildirishnoma yo'q** — eslatma faqat email orqali. Web Push VAPID
  kalitlari va `web-push` paketini talab qiladi; iOS'da esa faqat o'rnatilgan
  PWA'da ishlaydi.
- **i18n yo'q** — matnlar kodga qotirilgan, rus tiliga chiqish uchun refaktoring kerak.

## Analitika

Funnel hodisalari `client/src/lib/analytics.js` da. SDK ishlatilmaydi —
PostHog'ning HTTP capture endpointi to'g'ridan-to'g'ri chaqiriladi, shuning
uchun bundle hajmi oshmaydi. `VITE_POSTHOG_KEY` yo'q bo'lsa hech narsa
yuborilmaydi va foydalanuvchi qurilmasida identifikator ham qoldirilmaydi.

Kuzatiladigan asosiy nuqtalar: `registered` → `onboarding_completed` →
`topic_day_finished` → `daily_plan_completed` → `upgrade_clicked`.
Ayrim muhim signal: `ai_unavailable` — Gemini uzilishlari ko'rinib turadi.

Render xatolari `ErrorBoundary` orqali ushlanadi va shu quvurga tushadi.
