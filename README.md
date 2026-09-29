# Linguist AI-Flow

O'zbek tilida so'zlashuvchilar uchun ingliz tili ilovasi: CEFR bo'yicha tartiblangan
kunlik kurs, 7 bosqichli oraliqli takrorlash, tinglab yozish, gap tahlili va
gapirish mashqlari.

## Stack

- **Client:** React 18, Vite, Redux Toolkit Query, Tailwind 4, redux-persist, Motion (animatsiya), Radix UI
- **Server:** Express 5, MongoDB (Mongoose 9), JWT + refresh cookie sessiyalari, Gemini, Stripe
- **Testlar:** `node:test` + `mongodb-memory-server` (brauzer talab qilmaydi), Playwright (e2e)

## Tez boshlash

```bash
cp server/.env.example server/.env   # MONGO_URI, JWT_SECRET, GEMINI_API_KEY
cp client/.env.example client/.env

npm run install:all
npm run dev          # ikkala serverni ko'taradi + telefon manzilini ko'rsatadi
```

Alohida ishga tushirish ham mumkin: `npm --prefix server run dev` va
`npm --prefix client run dev`.

Tekshiruv: `npm run check` (testlar + lint + build).

### Telefonda sinash

`npm run dev` lokal tarmoq manzilini chiqaradi (`http://192.168.x.x:5173`) —
bir xil Wi-Fi'dagi telefondan ochish uchun. Dev rejimida `/api` so'rovlari Vite
proxy orqali lokal backendga ketadi (`client/vite.config.js`), shuning uchun
`client/.env` da `VITE_API_URL` **yozmang** — aks holda telefon `127.0.0.1` ni
o'zi deb tushunadi va hech bir so'rov ishlamaydi.

**PWA va bildirishnomalarni sinash uchun bu yetarli emas:** service worker
faqat HTTPS yoki `localhost`da ishlaydi, `http://192.168.x.x` da esa
ro'yxatdan o'tmaydi. Chrome'ning USB port forwarding'idan foydalaning —
telefon manzilni `localhost` deb ko'radi va PWA to'liq ishlaydi:

1. Telefonda: Sozlamalar → Developer options → **USB debugging**
2. Kompyuterda Chrome: `chrome://inspect/#devices`
3. **Port forwarding** → `5173` → `localhost:5173` → Enable
4. Telefon Chrome'da: `http://localhost:5173`

`GEMINI_API_KEY` bo'lmasa ilova ishlaydi. Kunlik sahna, mini-test va lug'at
to'liq ishlaydi; **takrorlash ham to'xtamaydi** — u mahalliy tekshiruvga tushadi
va buni foydalanuvchiga ochiq aytadi ("AI ishlamaganda" bo'limiga qarang).
Faqat gap tahlili va yangi so'zga avtomatik tarjima/misol ishlamaydi.

## Dizayn tizimi

Barcha ranglar `client/src/index.css` dagi tokenlardan keladi (OKLCH). Brend
rangi — **binafsha**: ikonka, PWA `theme_color` va logotip bilan bir xil.
Ilgari primary yashil, gradientlar binafsha→pushti edi — ilova uch xil brend
rangida gapirardi.

- **Semantik ranglar:** `success`, `warning`, `info`, `streak`, `xp` — sahifalarda
  `text-green-500` kabi xom ranglar o'rniga shular ishlatiladi.
- **Qorong'i rejim:** kartalar fondan yorug'roq (elevatsiya yorug'lik bilan).
  `destructive` yetarli kontrastda — ilgari xato matni qora fonda o'qilmasdi.
- **Umumiy bloklar:** `components/ui/primitives.jsx` — `PageHeader`,
  `EmptyState`, `Skeleton`, `StatTile`, `ProgressRing`, `Segmented`, `FadeIn`/`Stagger`.
  Yangi sahifa sarlavhasi va bo'sh holatni noldan chizmang.
- **Navigatsiya:** `components/Layout/nav.js` — sidebar (lg+), telefondagi pastki
  tab-bar va "Mashqlar" varag'i shu bitta ro'yxatdan quriladi.
- **Dialog'lar** telefonda pastdan chiqadigan varaq, desktopda markazdagi oyna.
- **Shrift:** Plus Jakarta Sans (paket ichida, oflayn ishlaydi). IPA uchun `font-ipa`.
- **Animatsiya:** `motion`; tizimda "harakatni kamaytirish" yoqilgan bo'lsa o'chadi
  (`MotionConfig reducedMotion="user"` + CSS media so'rovi).
- **Logotip** — `components/brand/Logo.jsx` (SVG). PWA ikonkalari shu shakldan
  `npm run icons` bilan chiziladi.

## Funksiyalar

### Landing sahifa

Tizimga kirmagan odam `/` da ilova haqida sahifani ko'radi (`pages/Landing.jsx`),
login formasini emas. Matnda faqat haqiqiy faktlar: kontent hajmi, metodika,
bepul tarif limitlari — o'ylab topilgan sharhlar yoki foydalanuvchilar soni yo'q.

### Sozlamalar (`/settings`)

Profil (ism), daraja/maqsad/reja, mavzu, eslatmalar, parol va hisobni o'chirish.

| Endpoint | Izoh |
|---|---|
| `PATCH /api/auth/profile` | Faqat yuborilgan maydonlar o'zgaradi; `.strict()` — XP kabi maydonni yuborib bo'lmaydi. Daraja o'zgarsa kurs qaytadan boshlanmaydi |
| `POST /api/auth/change-password` | Joriy parol tekshiriladi; boshqa qurilmalardagi sessiyalar yopiladi, joriy qurilma yangi token oladi |
| `DELETE /api/auth/account` | Parol bilan tasdiqlanadi; so'zlar, progress, sessiyalar va boshqa hamma narsa o'chadi. Faol pullik obuna bo'lsa 409 — aks holda Stripe pul yechishda davom etardi. `BillingEvent` moliyaviy hisobot uchun qoladi |

### Kunlik reja (2 qadam)
1. **Kunlik sahna** — mavzu dialogi, so'zlar, mini-test, **shadowing** (dialog
   qatorlarini eshitib takrorlash; o'tkazib yuborsa ham bo'ladi)
2. **Takrorlash** — "Bugun" sahifasining o'zida: tanib olish → eslash → gap tuzish

Ikkalasi bajarilgach streak oshadi — qaysi tartibda bajarilishidan qat'i nazar.
Sahna tugagach ixtiyoriy **"dialogni yoddan ayt"** qadami ochiladi: rol tanlanadi,
suhbatdosh qatorlari eshittiriladi, o'z qatorlari faqat o'zbekcha ko'rinadi.
Gapirish solishtiruvi brauzerda (`client/src/utils/speechMatch.js`) — AI limiti
yemaydi, audio serverga yuborilmaydi. Tinglash va Gap tahlili — ixtiyoriy
qo'shimchalar, ular rejani bloklamaydi.

Kunlik yangi so'zlar sonini **reja** belgilaydi: Yengil 5, Barqaror 7, Jadal 10
(`getDailyWordTarget`). Asosiy ko'rsatkich XP emas, **bilgan so'zlar** soni va
kursdagi CEFR yo'li (`course`: "B1 · 12/36 sahna", `utils/topicsData.js`).

Qadamlarni **faqat server** belgilaydi (`completeDailyStep`,
`utils/gamification.js`), mijoz emas:

- **Sahna** — `/topics/finish` da, mini-test serverda tekshirilgach. Sahna
  so'zlari shu yerda lug'atga **avtomatik** qo'shiladi (javobda `wordsAdded`) —
  ilgari har birini qo'lda saqlash kerak edi;
- **Takrorlash** — `/review/:id/check` da, navbat bo'shaganda yoki bugun 20 ta
  so'z takrorlanganda. Navbati umuman bo'sh foydalanuvchi uchun
  `POST /review/complete-day` — u navbatni o'zi tekshiradi (so'z bo'lsa 409).

Ilgari `/auth/sync-quest` bor edi: mijoz `{type}` yuborsa qadam yopilardi,
ya'ni ikki so'rov bilan XP va streak olish mumkin edi. U olib tashlandi.

**Mashq rejimi.** Muddati kelmagan so'z (masalan xato javobdan keyin "Qayta
urinish") tekshiriladi, lekin jadval o'zgarmaydi — javobda `practice: true`.
Busiz xatodan keyingi qayta urinish so'zni o'sha zahoti 2-bosqichga
ko'tarardi.

### Takrorlash: "Bugun" sahifasi

"Bugun" — takrorlashning o'zi. Ochilishi bilan bugun takrorlanishi kerak
bo'lgan so'zlar birin-ketin chiqadi. Topshiriq so'z bosqichiga qarab
qiyinlashadi (`server/utils/reviewModes.js`):

| Bosqich | Rejim | Topshiriq | AI |
|---|---|---|---|
| 0–1 | `recognize` | Inglizcha so'z → 4 ta o'zbekcha variant (klaviaturada 1–4) | yo'q |
| 2–3 | `recall` | O'zbekchasi, niqoblangan misol va birinchi harf → inglizcha so'zni yozish | yo'q |
| 4–6 | `sentence` | So'z ishtirokida gap — **yozib yoki mikrofonga aytib** | ha |

Rejimni **server** tanlaydi. `/review/due` javobni oshkor qiladigan
maydonlarni olib tashlaydi (tanib olishda tarjima, eslashda so'zning o'zi),
to'liq kartochka javobdan keyin `reveal` da keladi. Muddati kelgan so'zga
boshqa rejimda javob berilsa — 409 `MODE_MISMATCH`. Eslashda 5+ harfli so'zda
bitta harf xatosi kechiriladi (`nearMiss`), to'g'ri imlo ko'rsatiladi. AI
limiti faqat gap rejimida sarflanadi — ilgari 20 ta so'zlik navbat 20 ta AI
chaqiruvi edi.

Navbat bo'sh bo'lsa "Lug'atga o'tish" tugmasi ko'rsatiladi.

Nega o'z-o'zini baholash olib tashlandi: eski oqimda foydalanuvchi
"Esladim / Qiyin / Eslay olmadim" tugmalarini bosardi. Bu o'lchov emas edi —
bilmagan so'zga ham "Esladim" bosish mumkin. Gap tuzish esa bilimni ko'rsatadi.

Mikrofonli javob **talaffuzni baholamaydi**: brauzerning `SpeechRecognition`i
nutqni matnga aylantiradi va o'sha matn tekshiriladi. UI buni ochiq aytadi.

Tanilgan matn **darhol yuborilmaydi** — u maydonga tushadi, foydalanuvchi uni
tekshirib, kerak bo'lsa tuzatib yuboradi. Ilgari u avtomatik yuborilardi va
tanish xatosi ("I sea the see") so'zni foydalanuvchining aybisiz 1-bosqichga
tushirardi. Tuzatilgan matn `source: 'text'` bo'lib ketadi.

Tarmoq xatosi **noto'g'ri javob emas**: forma va yozilgan gap joyida qoladi,
qayta yuborish yoki so'zni keyinroqqa qoldirish taklif qilinadi. Natijadan
keyin fokus "Keyingi so'z" tugmasida — Enter bilan davom etiladi. Har javobdan
keyin so'z qachon qaytishi ko'rsatiladi ("3 kundan keyin yana chiqadi").

**AI limiti takrorlashni to'xtatmaydi.** Bepul tarifda kuniga 15 ta AI
chaqiruvi bor, kunlik maqsad esa 20 ta so'z. Limit tugasa `/review/:id/check`
402 o'rniga mahalliy tekshiruvga tushadi (`aiReason: 'QUOTA'`) va UI buni
aytadi (`trackAiUsageSoft`, `middleware/usageQuota.js`).

Javob yuborilgach "Gapimni tushuntir" tugmasi chiqadi — foydalanuvchi aynan
o'zi tuzgan gapning grammatik tahlilini ko'radi (quyiga qarang).

**Sessiya muzlatiladi.** Javob yuborilgach `checkReview` `Word` tegini bekor
qiladi va navbat qayta yuklanadi — so'z endi navbatda yo'q. Sessiya ro'yxati
holatda saqlanmasa, natija ekranga chiqishga ulgurmasdan oqim yopilib qolardi.

### Gap tahlili

`/analysis` — inglizcha gapni har bir so'zi bo'yicha tahlil qiladi: so'z
turkumi (ot, fe'l, sifat, ravish…) va gap bo'lagi (ega, kesim, to'ldiruvchi,
aniqlovchi, hol). Foydalanuvchining lug'atidagi so'zlarning misol gaplari
tayyor boshlang'ich nuqta sifatida taklif qilinadi.

Bu "Ustoz AI" ning o'rniga keldi. Eski Ustoz AI erkin savol-javob chati edi:
foydalanuvchi nima so'rashini bilmasdi, javob sifati savolga bog'liq edi va u
foydalanuvchining o'z lug'atiga hech qanday tarzda bog'lanmagan edi.

`partOfSpeech` va `role` model sxemasida **enum** bilan cheklangan — aks holda
model har safar boshqa atama qaytarardi ("fe'l", "verb", "harakat so'zi") va
UI ularni ajrata olmasdi.

Tahlil uchun mahalliy zaxira YO'Q va bo'lishi ham mumkin emas: gap bo'laklarini
qoidalar bilan aniqlash uchun to'liq sintaktik tahlilchi kerak. Yolg'on tahlil
ko'rsatgandan ko'ra hech narsa ko'rsatmagan yaxshi.

### Tinglash (diktant)
Kunlik dialog qatorlarini eshitib yozish — ilovadagi yagona **input** mashqi.
Baholash so'z darajasida (`server/utils/dictation.js`, LCS asosida): qaysi so'z
o'tkazib yuborilgani va qaysi biri ortiqcha yozilgani rangli ko'rsatiladi.
Qisqartmalar (`don't` = `do not`) teng qabul qilinadi.

Ovoz brauzerning `speechSynthesis`i orqali chiqariladi — tashqi TTS xizmati
talab qilinmaydi, lekin ovoz sifati qurilmaga bog'liq. Tezlikni sekinlashtirish
mumkin (0.6× / 0.95× / 1.15×).

Bu mashq kunlik rejaga **kirmaydi** va streak'ni bloklamaydi — kunlik yukni
oshirib, reja bajarilishini tushirmaslik uchun ataylab ixtiyoriy qoldirilgan.

### Mavzular kutubxonasi

Lug'at → **Mavzular** (`/vocabulary?view=topics`): daraja → mavzu → so'zlar.
Uch daraja: Elementary (A1–A2, 60 mavzu), Upper-intermediate (B2, 92 mavzu),
Advanced (C1, 98 mavzu) — jami 250 mavzu, 3813 so'z. Sahifa onboarding
darajasiga mos kitobni birinchi ochadi. Validator butun kutubxona bo'yicha bir
so'zning ikki mavzuda bo'lishiga yo'l qo'ymaydi (lug'atda so'z bitta yozuv).
Mavzular "English Vocabulary in Use" (Cambridge) unit'lariga tayanadi —
kitobdan faqat mavzu nomi va so'zlar olinadi (kitob indeksidan), tarjima va
misollar Linguist uchun yozilgan. Kitob matni, ta'riflari va mashqlari
ko'chirilmaydi. PDF manbalar `server/content/vocab-topics/` da, lekin
`.gitignore` (`*.pdf`) tufayli repo'ga kirmaydi.

- Kontent: `server/content/vocab-topics/<daraja>.js`, yozuv
  `[word, partOfSpeech, translation, example, exampleUz]`. Tekshiruv:
  `index.js` → `validateLevels` (testda ham ishlaydi): so'z turkumi, tarjima
  so'zning o'zi emas, misolda so'z (shakllari bilan) ishlatilgan.
- API: `GET /api/vocab-topics`, `GET /api/vocab-topics/:id`,
  `POST /api/vocab-topics/:id/add` (`{ words? }` — bo'lmasa hammasi). Faqat
  mavzudagi so'zlar qabul qilinadi; takroriy qo'shish dublikat yaratmaydi.
- Qo'shilgan so'z o'sha kuni takrorlashga tushadi (tanib olish rejimida).

### So'z qo'shish

Yangi so'zga **tarjima** va **darajaga mos misol gap** (o'zbekcha tarjimasi
bilan) yoziladi. Ta'rif manbai zanjiri: qo'lda yozilgan `dictionary.json` →
`dictionary-snapshot.json` → jonli API. Tarjima yoki misol yetishmasa AI
`generateWordContext` bilan to'ldiradi va **darajaga moslangan misol birinchi
o'ringa** qo'yiladi.

Nega snapshotdagi misol yetmaydi: u Wiktionary'dan keladi va A1 o'quvchisi
uchun ko'pincha og'ir ("He is a student of life"). Tarjima esa u yerda umuman
yo'q.

**Ma'no bitta manbadan olinadi.** AI javob bersa, ta'rif ham, misol ham undan
olinadi va snapshotdagilar tashlanadi. Sabab: snapshot Wiktionary'ning
BIRINCHI ma'nosini oladi, u esa eng keng tarqalgani bo'lmasligi mumkin —
"kids" uchun u *"A young goat"* beradi. Aralashtirsak kartochka o'z-o'ziga zid
bo'lardi: tarjima "bolalar", ta'rif esa echki bolasi.

**Ma'lumot topilmasa so'z SAQLANMAYDI.** Ilgari tarmoq uzilsa yozuv shunday
saqlanardi:

```
definition: "Definition unavailable (API failed). You can edit this later."
examples:   ["Example unavailable."]
```

Uch jihatdan yomon edi: inglizcha xizmat matni foydalanuvchiga ta'rif bo'lib
ko'rinardi, "edit later" yolg'on edi (tahrirlash oynasi yo'q), va buzuq
kartochka SRS navbatiga tushib har kuni qaytaverardi. Endi 503 va
`type: 'ENRICHMENT_FAILED'` qaytadi, foydalanuvchiga sabab aytiladi va qo'lda
ta'rif kiritish taklif qilinadi.

Jonli lug'at so'rovi **bir marta qayta uriniladi** (timeout/5xx uchun; 404
qayta urinilmaydi — bu javobning o'zi).

Bazada qolgan eski buzuq yozuvlar uchun lug'at kartochkasida
**"Ma'lumotni yuklash"** tugmasi bor (`POST /api/words/:id/refresh`). U faqat
kontent maydonlarini yangilaydi — bosqich, interval va lapses tegilmaydi.

### So'z takliflari (avtomatik to'ldirish)

Lug'atga so'z qo'shish maydonida bir-ikki harf yozilishi bilan shu harflar
bilan boshlanadigan so'zlar ro'yxati chiqadi (`components/WordForm.jsx`).

**Nega dictionaryapi.dev emas:** u prefiks bo'yicha qidira olmaydi, faqat aniq
so'zni topadi — `/entries/en/hel` → 404. Shuning uchun alohida ro'yxat kerak.

`src/data/wordlist.js` — 9822 ta so'z, **chastota bo'yicha tartiblangan**
(`first20hours/google-10000-english`, MIT, haqoratsiz variant). Tartib
xususiyatning butun sifatini belgilaydi: alifbo tartibida "ab" so'rovi
"abaca, abaci" berardi, chastota tartibida esa "about, above, able".
Faylni saralamang.

```bash
npm --prefix client run wordlist:fetch   # ro'yxatni yangilash
```

Ro'yxat **dinamik import** qilinadi: 75 KB (gzip 34 KB) alohida chunk bo'lib
ajraladi va faqat foydalanuvchi maydonga fokus qo'yganda yuklanadi —
boshlang'ich bundle'ga kirmaydi. Kontent-xesh bilan nomlangani uchun service
worker'ning `assets/` qoidasi (stale-while-revalidate) unga o'z-o'zidan
tegishli bo'ladi.

Xulq-atvori:

- foydalanuvchida allaqachon bor so'zlar taklif qilinmaydi (aks holda
  bosilganda serverdan `DUPLICATE` xatosi kelardi);
- aynan yozilgan so'zning o'zi ko'rsatilmaydi — uni bosish hech narsani
  o'zgartirmaydi, lekin 8 o'rinning birini egallardi;
- taklif bosilganda so'z **maydonga qo'yiladi**, avtomatik qo'shilmaydi:
  tasodifiy bosish keraksiz so'zni SRS navbatiga tushirmasligi kerak;
- klaviatura: ↑ ↓ Enter Escape. Escape `stopPropagation` qiladi — aks holda
  Radix Dialog butun modalni yopib yuborardi.

Ma'lum cheklov: ro'yxatda atoqli otlar ham bor ("helen", "helena"). Ular
korpusda chastotali va faqat katta harf bilan farqlanadi, lowercase ro'yxatda
esa buni aniqlab bo'lmaydi.

### Daraja aniqlash (placement)
Onboarding'ning birinchi qadami: adaptiv test, ~12 savol, 2 daqiqa.
A2 dan boshlanadi; har darajada 3 savol, 2/3 dan yuqori bo'lsa yuqoriga,
past bo'lsa pastga (`server/content/placement.js`).

Natija kursning **boshlanish kunini** belgilaydi: A1/A2 → 1-kun,
B1/B2 → 25-kun. Ilgari daraja tanlansa ham hamma 1-kundan boshlardi.

Savollar va to'g'ri javoblar serverda — natijani ko'tarib olish mumkin emas.
Testni o'tkazib yuborib darajani o'zi tanlash ham mumkin.

### Kontent
90 mavzu, 900 so'z, A1 → A2 → B1 → B2 (1–8: A1, 9–24: A2, 25–60: B1, 61–90: B2). Har bir mavzuda dialog (o'zbekcha tarjima
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
npm run content:validate    # faqat tekshirish
npm run dict:fetch          # lug'at snapshotini yangilash (tarmoq kerak)
```

Yangi mavzu qo'shish: `server/content/curriculum/` ichida kortej formatida yozing,
`npm run content:build`, so'ng `npm run dict:fetch` (yangi so'zlar snapshotga tushadi).

### Lug'at snapshoti

`data/dictionary-snapshot.json` — kurrikulum so'zlari uchun
[dictionaryapi.dev](https://api.dictionaryapi.dev) dan **build vaqtida** olingan
ma'lumot: IPA variantlari, inson ovozidagi talaffuz havolalari (285 so'zda),
ma'nolar, sinonim va antonimlar. Fayl repoga kommit qilinadi.

Nega runtime'da emas: ilgari foydalanuvchi so'z qo'shganda har safar tashqi
so'rov ketardi. Kurrikulum so'zlari hamma foydalanuvchida bir xil, ya'ni bu
bepul, SLA'siz va rate limit'li API'ga bir xil savolni minglab marta berish
degani edi. Endi qidiruv zanjiri: qo'lda yozilgan `dictionary.json` →
snapshot → (faqat begona so'z uchun) jonli API.

Skript inkremental: uzilib qolsa qayta ishga tushiring, faqat qolgani olinadi.
Hammasini yangilash uchun `npm run dict:fetch -- --force`.

**Litsenziya:** ma'lumot Wiktionary'dan keladi, **CC BY-SA 3.0**. Ta'riflarni
foydalanuvchiga ko'rsatganda atribusiya kerak — har yozuvdagi `sourceUrls`
shuning uchun saqlanadi.

### IPA va partOfSpeech tekshiruvi

`content/dictionaryCheck.js` kurrikulumning qo'lda yozilgan transkripsiyalarini
snapshot bilan solishtiradi. Bunga alohida ehtiyoj bor edi: bitta xato IPA
(`/wɜːk/` o'rniga `/wɔːk/`) hech qayerda ko'rinmaydi — dastur ishlaydi, testlar
o'tadi, faqat foydalanuvchi noto'g'ri o'rganadi.

Qiyinligi shundaki, farqlarning aksariyati **xato emas**. Solishtirish uch
bosqichda notatsiyani tenglashtiradi:

1. **Fold** — `ɹ`↔`r`, `ɛ`↔`e`, `ɑ`↔`a`, `ɫ`↔`l`, bog'lovchi yoy `t͡ʃ`↔`tʃ`,
   bo'g'in belgisi, urg'u va bo'g'in nuqtasi.
2. **Ixtiyoriy segmentlar** — `/ˈmʌðə(ɹ)/` rotik va norotik variantga yoyiladi.
3. **Og'irlikli tahrir masofasi** — kuchsiz unlilar (`ə ɪ ʊ ɐ`) orasidagi
   almashinuv va schwa'ning tushishi **bepul**, boshqa har qanday unli
   almashinuvi esa to'liq narxda. Aynan shu `/ˈkɪtʃɪn/`↔`/ˈkɪtʃən/` (to'g'ri)
   ni `/wɔːk/`↔`/wɜːk/` (xato) dan ajratadi — oddiy Levenshteinda ikkalasi
   ham 1 ga teng bo'lardi.

Shundan keyin ham 26 ta farq qoladi: kurrikulum izchil britancha RP yozadi,
Wiktionary esa ko'pincha amerikacha yoki tor transkripsiya beradi
(`/kəʊld/` va `/koʊld/`). Ular `content/phonetic-exceptions.json` da
**sabab bilan** ro'yxatga olingan — lint baseline'i kabi:

```bash
npm run content:validate -- --update-baseline   # yangi farqlarni ro'yxatga qo'shadi
```

Maqsad — ogohlantirishlar sonini **nolda** ushlab turish. 26 ta doimiy
ogohlantirish bo'lsa, 27-chisi — haqiqiy xato — ko'zga tashlanmasdi. Buni test
ham himoya qiladi (`tests/dictionary.test.js`). Flagni farqlarni o'qimasdan
ishlatish tekshiruvni ma'nosiz qilib qo'yadi; fayl kod ko'rigidan o'tishi kerak.

Qat'iylik darajalari:

| Holat | Natija |
|---|---|
| So'z ingliz lug'atida yo'q (`notFound`) | **Xato** — build to'xtaydi (imlo xatosi) |
| IPA yoki POS farqi, ro'yxatda yo'q | Ogohlantirish |
| Snapshotda yo'q so'z | Ogohlantirish (`dict:fetch` kerak) |
| Keraksiz qolgan istisno | Ogohlantirish |
| Snapshot fayli umuman yo'q | Tekshiruv o'tkazib yuboriladi |

Oxirgi qator muhim: yangi klon, offline build va tarmoqsiz CI ishlashda davom
etadi.

### Kunlik eslatmalar
Kunlik reja bajarilmagan bo'lsa, foydalanuvchining **mahalliy** soatida
(default 19:00) email yuboriladi. Xabar mazmunli: streak bor bo'lsa aynan
uning xavf ostida ekani, muzlatish qolgan-qolmagani va qaysi qadamlar
bajarilmagani aytiladi.

Yuborilmaydi: reja tugagan, kuniga ikkinchi marta, onboarding tugamagan,
30 kundan beri faol bo'lmagan (spam va pochta obro'si uchun).

Har bir xatda obunani bekor qilish havolasi bor va u **login talab qilmaydi** —
aks holda odam "spam" tugmasini bosadi va domen obro'si tushadi.

**Kanal tanlash:** Telegram → push → email, faqat **bittasi**. Hammasini
birga yuborish spam bo'lardi — bir xil eslatma ikki joydan kelsa
foydalanuvchi hammasini o'chirib qo'yadi. Telegram birinchi: O'zbekistonda
uni hamma kuniga bir necha marta ochadi, push esa iOS'da faqat o'rnatilgan
PWA'da ishlaydi.

#### Telegram bot

Ulash: Sozlamalar → Eslatmalar → **Ulash**. Server bir martalik havola
beradi (`t.me/<bot>?start=<kod>`, 15 daqiqa, bazada faqat hash). Foydalanuvchi
botda "Start" bosadi → webhook kodni tekshiradi → hisob ulanadi; sahifa holatni
3 soniyada bir so'raydi va o'zi yangilanadi. Bitta chat faqat bitta hisobga
ulanadi.

Bot buyruqlari: `/bugun` — bugungi reja va takrorlanadigan so'zlar, `/stop` —
uzish. Foydalanuvchi botni bloklasa (`my_chat_member: kicked` yoki
`sendMessage` 403) ulanish uziladi va eslatma keyingi kanalga o'tadi.

```bash
# server/.env: TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET
cd server && npm run telegram:webhook -- https://<backend>   # deploydan keyin bir marta
```

Lokal ishlab chiqishda tashqi https manzil yo'q, shuning uchun webhook o'rniga
long polling: `TELEGRAM_POLLING=true` (faqat production bo'lmaganda ishlaydi).
Webhook `X-Telegram-Bot-Api-Secret-Token` bilan himoyalangan; `/health` da
`telegram` va `telegramWebhook` sozlanganligi ko'rinadi.

Push uchun VAPID kalitlari kerak:

```bash
cd server && npm run push:keys   # kalitlarni generatsiya qiladi
```

Ruxsat **faqat foydalanuvchi tugmani bosgandan keyin** so'raladi. Sahifa
yuklanishida avtomatik so'rash — "block" bosilishining eng keng tarqalgan
sababi, va bir marta bloklangandan keyin qaytarish deyarli imkonsiz.

Push xizmati 404/410 qaytarsa obuna darhol o'chiriladi (brauzer uni bekor
qilgan); boshqa xatolarda 3 urinishdan keyin.

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

### Oraliqli takrorlash (7 bosqich)

`server/utils/srs.js`. Bosqich → keyingi takrorlashgacha kun:

| Bosqich | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Kun | 1 | 2 | 4 | 7 | 14 | 30 | — |

**7 ta muvaffaqiyatli takrorlash** so'zni yodlangan qiladi: `learned = true`,
`nextReviewDate = null` va u navbatdan chiqadi. 7-bosqichning 60 kuni hech
qachon kutilmaydi — jadvalda faqat ko'rsatish uchun turadi.

**Xato → 1-bosqich**, bir pog'ona pastga emas. 6-bosqichdan 5-ga tushgan so'z
baribir 14 kundan keyin qaytardi va ikkinchi marta ham unutilardi.

**Qayta yodlash** (lug'atdagi tugma) so'zni **4-bosqichdan** (7 kun) boshlaydi.
Bir marta yodlangan so'zni yangi so'z kabi 1 kundan boshlash keraksiz
takrorlash bo'lardi.

Takrorlash sanasi **foydalanuvchi zonasidagi** yarim tunga qo'yiladi. Ilgari
server zonasi (Render'da UTC) ishlatilardi va Toshkentda so'z yarim tunda emas,
ertalab 05:00 da navbatga tushardi.

Uzun intervallarga ±5% tasodifiy og'ish qo'shiladi — busiz bir kunda
qo'shilgan 20 ta so'z 30 kundan keyin ham aynan bir kunda qaytardi.

Nega SM-2 emas: ilgari ease factor foydalanuvchining 4 darajali o'z-o'zini
baholashiga tayanardi. Endi takrorlash topshiriq orqali o'tadi va natija
ikkilik — ease factor uchun kirish signali qolmadi. Eski maydonlar
(`easeFactor`, `repetitions`, `reviewStage`, `mastered`) sxemada qoldirilgan
va mavjud hujjatlar `readStage` orqali avtomatik ko'chiriladi.

### AI ishlamaganda

Takrorlash yagona yo'l bo'lgani uchun uni Gemini'ga qattiq bog'lab bo'lmaydi:
kvota tugagan kuni foydalanuvchi umuman ilgarilay olmasdi va streak uzilardi.
Shuning uchun `utils/sentenceCheck.js` mahalliy zaxira ishlaydi — so'z
ishlatilganmi (so'z shakllari bilan) va bu gapga o'xshaydimi. Javobda
`method: 'local'` qaytadi va UI "grammatika tekshirilmadi" deb ochiq aytadi.

Gap tahlili bunday zaxiraga ega emas (yuqoriga qarang).

### Xavfsizlik
- 15 daqiqalik access token + hash'langan refresh sessiyalar
- Parolni tiklash: bir martalik hash'langan token, 1 soat, sessiyalarni bekor qiladi
- Zod validatsiya, Helmet, hpp, CORS (aniq origin), rate limit
- Mini-test serverda baholanadi — mijoz natijaga ta'sir qila olmaydi

## Testlar

```bash
cd server && npm test     # 204 ta test; pretest kontentni validatsiya qiladi
cd client && npm test     # 13 ta test (so'z takliflari); brauzer talab qilmaydi
cd client && npm run lint
cd client && npm run build

# Brauzer testlari (ixtiyoriy) — @playwright/test client devDependency'da
cd client && npx playwright install chromium
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
| `VAPID_*` | push uchun | `npm run push:keys` |
| `CRON_SECRET` | eslatma uchun | Tashqi cron shu sir bilan chaqiradi |
| `STRIPE_*` | to'lov uchun | Quyidagi izohga qarang |

Maxfiy kalit generatsiya qilish:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`ALLOWED_ORIGIN` uchun `*` ishlatib bo'lmaydi — cookie bilan ishlaydigan CORS
aniq URL talab qiladi.

### Preview deploymentlar

Vercel har bir branch uchun alohida URL beradi va uni har safar
`ALLOWED_ORIGIN` ga qo'shish unutiladi — natijada brauzerda tushunarsiz
"Failed to fetch" chiqadi. Shuning uchun shablon qo'llab-quvvatlanadi:

```env
ALLOWED_ORIGIN_PATTERN=^https://<loyiha>-git-[a-z0-9-]+-<jamoa>\.vercel\.app$
```

Shablon quyidagi shartlarni bajarmasa server uni **e'tiborsiz qoldiradi** va
logga xato yozadi (`utils/corsConfig.js` → `compileOriginPattern`):

- `^` va `$` bilan bog'langan bo'lishi;
- begona manzilga (`https://evil.example`, `https://attacker.vercel.app`)
  mos kelmasligi.

Bu cookie bilan ishlaydigan CORS bo'lgani uchun juda ehtiyot bo'lish kerak:
haddan tashqari keng shablon istalgan saytga foydalanuvchi nomidan so'rov
yuborish imkonini berardi.

To'liq preview uchun backend ham o'sha branchdan turishi kerak —
`render.yaml` da `linguist-backend-preview` servisi shu uchun.
**`MONGO_URI` ga alohida test bazasi bering:** yangi kod sxemalarga maydon
qo'shadi va kontent almashadi.

## Ma'lum cheklovlar

Bu ro'yxat ataylab ochiq — mahsulot hali bularni qila olmaydi:

- **To'lov.** Stripe O'zbekiston kartalarini qabul qilmaydi. Payme/Click
  integratsiyasi hali yo'q, ya'ni mahalliy bozordan daromad olish imkonsiz.
- **Talaffuz bahosi.** Shadowing va "yoddan ayt" (`speechMatch.js`) talaffuzni
  emas, brauzer `SpeechRecognition` transkriptining dialog qatoriga mosligini
  o'lchaydi — UI buni ochiq aytadi. Haqiqiy baho uchun fonema darajasidagi xizmat kerak.
- **Kontent hajmi.** 90 kun (A1–B2). 31–90-kunlar AI yordamida yozilgan va validatordan o'tgan, lekin o'zbekcha tarjimalar hali ona tili egasi tomonidan ko'rib chiqilishi kerak (`docs/ROADMAP.md`).
- **iOS push** faqat o'rnatilgan PWA'da ishlaydi (Safari cheklovi). Foydalanuvchi
  avval "Bosh ekranga qo'shish" qilishi kerak.
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
