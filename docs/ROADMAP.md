# Linguist — mahsulot yo'l xaritasi

> Ish shu tartibda bajariladi. Har bosqich tugagach bu yerda belgilanadi.
> Tartibni o'zgartirishdan oldin sababini "Qarorlar jurnali"ga yozing.

Oxirgi yangilanish: 2026-09-29

## Asosiy tashxis

Loyiha g'oyasi kuchli (o'zbek tilida izohli, CEFR bo'yicha kurs; takrorlashda
"Esladim" tugmasi emas, **so'z bilan gap tuzish**), lekin:

1. **Kontent 30 kunda tugaydi** (30 mavzu, 300 so'z, A1–B1). Placement B2 desa ham
   B2 kontent yo'q. Faol foydalanuvchi bir oyda ilovani "tugatadi".
2. **Takrorlash og'ir:** har so'z uchun gap tuzish → 20 so'z ≈ 20–30 daqiqa,
   va'da qilingan "kuniga 15 daqiqa"ga sig'maydi.
3. **Daromad yopiq:** Stripe O'zbekiston kartalarini qabul qilmaydi, narx ($9.99) baland.
4. **Funksiyalar tarqoq:** 6 ta bo'lim, ular ostida 300 ta so'z.

Shuning uchun ustuvorlik: **kontent va asosiy kunlik tsikl**, yangi bo'limlar emas.

## Tartib

### Gapirish va mahsulot yaxlitligi (2026-10-01)
Kunlik reja: **Sahna → Suhbat → Takrorlash**. Suhbatsiz streak oshmaydi.

- [x] **Suhbat** (`feat/speak`): bugungi sahna qahramoni bilan ovozli rolli o'yin; bugungi so'zni aytganda belgi yonadi (server `containsWord` bilan aniqlaydi); AI rejimi (Gemini) + ssenariy rejimi (AI yo'q/uzilsa — sahna dialogi, majburiy qadam bloklanmaydi); yakunda 0-3 tuzatish; bepul — kuniga 1 suhbat, Pro — 20
- [x] **Yod olish** (`feat/memorize`): sahnaning gapirish qadami — kunning 3-5 kalit gapi (bugungi so'zlar bor qatorlar, serverda `pickKeyLines`) bosqichma-bosqich yashiriladi: 1 to'liq → 2 bo'shliqlar → 3 birinchi harflar → 4 faqat ma'nosi. 1-2-davralar majburiy, 3-4 ixtiyoriy; o'tolmagan gap davra oxirida qaytadi. Eski "rol bilan yoddan aytish" (DialoguePractice) olib tashlandi
- [x] Yodlangan iboralar Suhbatga ulangan: "Yordam" ularni birinchi taklif qiladi, AI qahramon ularni ishlatishga imkon yaratadi
- [x] **Ibora kartalari** (`feat/phrase-cards`): sahna yakunlanganda kalit gaplar `Phrase` bo'lib ertangi takrorlashga tushadi (ertaga → 3 → 7 → 14 → 30 kun → yodlangan; kuniga ≤ 5). Karta: o'zbekcha ma'no (+ ixtiyoriy birinchi harflar) → butun gap ovoz bilan; baho serverda (`utils/phraseMatch.js`). "Takrorlash" qadami iboralar ham tugaganda yopiladi
- [ ] Tuzatishlar takrorlash navbatiga (so'z kartasida "Suhbatda shunday dedingiz…")
- [x] **"Bugun" sahifasi** (`feat/today-redesign`): bitta katta tugma doim keyingi qadamni ochadi (Sahna → Suhbat → Takrorlash), qadamlarda daqiqalar; "Bugungi suhbat" kartasi (qahramon, vaziyat, so'zlar); "Oxirgi suhbatdan" — 2 ta tuzatish eshitish bilan; hafta tasmasi (serverda `activity.planDays/frozenDays`, profil `week`); CEFR gacha sahnalar soni. Iqtibos (`quotes.json`), maqsad-tavsiya va alohida streak/muzlatish plitkalari olib tashlandi
- [x] **Tozalash** (`chore/cleanup`): Mavzular kutubxonasi client'dan olindi (server kontenti va `/api/vocab-topics` 91+ kunlar uchun saqlanadi); Gap tahlili menyudan olindi — takrorlashda "Gapimni tushuntir", Suhbat natijasida "Gapni tahlil qilish" (`/analysis?s=`); "Mashqlar" → "Ko'proq" (Tinglash bonus mashq); onboarding maqsadi Suhbat qahramoni uslubini belgilaydi (`GOAL_STYLE`); Landing yangi oqimga moslandi
- [ ] **Ovoz kundaligi:** har suhbatdan eng yaxshi gap qurilmada (IndexedDB) saqlanadi; 7/30-kunda "1-kun va bugun"

### Auth: production darajasi
Tahlil (2026-09-30): asos to'g'ri (qisqa access token, hash'langan refresh/reset
tokenlar, umumiy forgot-javob), lekin token localStorage'da edi, refresh
almashtirilmasdi va logout access tokenni darhol bekor qilmasdi.

- [x] **A. Xavfsizlik asosi** (`feat/auth-hardening`)
  - [x] Access token faqat xotirada; sahifa ochilganda refresh cookie orqali tiklanadi
  - [x] Refresh rotation + qayta ishlatishni aniqlash (oila yopiladi), parallel so'rovlar uchun 20 s oraliq
  - [x] JWT'da `sid`; `protect` sessiyani tekshiradi — logout/parol almashtirish tokenni darhol bekor qiladi
  - [x] JWT: HS256, `iss`, `aud` qat'iy
  - [x] Login javob vaqti tenglashtirildi; email trim + kichik harf; bcrypt 12 (eskilar login'da yangilanadi); parol ≤ 72 bayt
  - [x] Logout access token talab qilmaydi; `COOKIE_SAMESITE`, `TRUST_PROXY_HOPS` sozlamalari
  - [x] Vercel `/api` proxy (`client/vercel.json`) — domen shart emas, proxy 120 s kutadi (Render sovuq starti sig'adi)
  - [x] **Deploy tartibi:** (1) Vercel'dan `VITE_API_URL`ni o'chirib client'ni deploy qilish → (2) Render'da `COOKIE_SAMESITE=lax`, `TRUST_PROXY_HOPS=4` → (3) `/health`dagi `clientIp` haqiqiy IP ekanini tekshirish. Bajarildi 2026-10-01: Chrome, Android, parol o'zgartirish tekshirildi
  - [ ] Keyinroq: Linguist uchun alohida domen (proxy o'rniga `app.` + `api.`)
- [ ] **B. Hisob hayotiy sikli**
  - [x] Email tasdiqlash (`feat/email-verification`): bloklamaydi — banner + "Qayta yuborish" (60 s oraliq); havola 24 soat, bir martalik, login'siz ishlaydi; parol tiklash ham tasdiqlaydi; yopiq: to'lov va email eslatmalar
  - [ ] Faol qurilmalar ro'yxati (Session'da userAgent/ip/lastUsedAt allaqachon yoziladi)
  - [ ] Yangi kirish / parol o'zgargani haqida xabar
  - [ ] Hisob bo'yicha urinish cheklovi (IP'dan tashqari)
  - [ ] HIBP parol tekshiruvi
- [ ] **C. Ijtimoiy kirish**
  - [x] Google (`feat/google-signin`): ID token serverda `aud` bilan tekshiriladi; yangi hisob parolsiz va tasdiqlangan; mavjud hisobga bog'lash — tasdiqlanmagan bo'lsa begona parol va sessiyalar o'chiriladi (oldindan egallashdan himoya); Google hisobi Sozlamalar'da parol o'rnata oladi, o'chirish emailni yozib tasdiqlanadi
  - [ ] Telegram Login Widget
- [ ] **D. Ixtiyoriy:** TOTP 2FA, auth hodisalari jurnali, passkey

### 1. Kontent: 30 → 90 kun (A1–B2) — asosan bajarildi
- [x] Kontent yaratish usuli: AI qoralama → validator (`content:build`) → inson tahriri
- [x] Mavzular rejasi (31–90-kunlar) — quyida
- [x] 31–60-kunlar (B1) — `curriculum/05-b1.js` … `07-b1.js`
- [x] 61–90-kunlar (B2) — `curriculum/08-b2.js` … `10-b2.js`

  Mavzular (kun · mavzu · grammatika):

  | B1 | | B2 | |
  |---|---|---|---|
  | 31 Ijara kvartira | Present Perfect / Past Simple | 61 Ish va hayot muvozanati | although / despite |
  | 32 Oilaviy retsept | first, then, after that | 62 Maosh bo'yicha kelishuv | unless / as long as |
  | 33 To'y va bayramlar | Past Continuous | 63 Qo'ldan boy berilgan imkoniyat | 3-shart gap |
  | 34 Aeroportda | when / while | 64 Afsus va orzular | wish / if only |
  | 35 Avtosayohat | 1-shart gap | 65 Masofaviy ish | Future Continuous / Perfect |
  | 36 Onlayn xarid | just / already / yet | 66 Investitsiya va kredit | aniqlovchi ergash gap (, which) |
  | 37 Qo'shnilar va mahalla | who / which / that | 67 Sun'iy intellekt | modal + passive |
  | 38 Dorixonada | must / have to / don't have to | 68 Sirli voqealar | must have / can't have |
  | 39 Ko'ngillilik | -ing / to + fe'l | 69 Ta'mirlatish | have something done |
  | 40 Film va seriallar | prefer / would rather | 70 Taqdimot | bog'lovchilar (moreover…) |
  | 41 Pul tejash | too / enough | 71 Sog'liqni saqlash | advise / suggest / recommend |
  | 42 Kichik biznes | plan to / hope to | 72 Shahar va qishloq | the more…, the better |
  | 43 Transport muammolari | Past Perfect | 73 Buxoro va Xiva | sifatdosh oborotlari |
  | 44 Sport musobaqalari | superlatives | 74 Ijtimoiy tarmoqlar ta'siri | few / a few / little |
  | 45 Samarqand tarixi | Past Passive | 75 Ekologik faollik | stop to / stop doing |
  | 46 Til o'rganish | Present Perfect Continuous | 76 Murakkab suhbat (ish) | Perfect Simple / Continuous |
  | 47 Do'stlik | ko'chirma gap (said that) | 77 Chet elga ko'chish | be / get used to |
  | 48 Telefon va maxfiylik | might / may / could | 78 Ta'lim bo'yicha bahs | rasmiy fikr bildirish |
  | 49 Favqulodda holatlar | 0-shart gap | 79 Barqaror moda | cleft sentences |
  | 50 Iqlim o'zgarishi | will / be likely to | 80 Ilmiy kashfiyotlar | Past Perfect Continuous |
  | 51 Ish qidirish | bilvosita savol | 81 Ishdagi nizo | frazali fe'llar |
  | 52 Ofis va yig'ilishlar | Let's / How about | 82 Iste'molchi huquqlari | should have |
  | 53 Qo'llab-quvvatlash xizmati | muloyim iltimos | 83 Sog'liq afsonalari | It is believed that |
  | 54 Musiqa va konsertlar | so / such | 84 Yetakchilik | whose / whom |
  | 55 Sog'lom uyqu | be used to + -ing | 85 Sayohatdagi ko'ngilsizliklar | hikoya zamonlari |
  | 56 Yo'l harakati | mustn't / don't have to | 86 Raqamli xavfsizlik | be supposed to |
  | 57 Ota-ona va farzand | 2-shart gap | 87 Film taqrizi | -ed / -ing sifatlar |
  | 58 Yangiliklar va OAV | ko'chirma savol | 88 Nutq so'zlash | Not only… but also |
  | 59 Navro'z | Present Passive | 89 Kelajak shaharlari | bound to / likely to |
  | 60 Yarim yo'l sarhisobi | aralash takror | 90 O'quv yo'lingiz | aralash takror |
- [ ] `npm --prefix server run dict:fetch` — 600 ta yangi so'z snapshotga. 2026-09-29 da dictionaryapi.dev ishlamadi (Cloudflare 522). Shu bajarilmaguncha 2 ta test (`dictionary.test.js`) qizil — bu to'g'ri: IPA hali Wiktionary bilan solishtirilmagan. Fetch'dan keyin chiqqan IPA farqlarini tuzatish yoki `phonetic-exceptions.json` ga sababi bilan yozish
- [x] Placement B2 natijasi haqiqiy B2 kontentga olib boradi (advanced → 61-kun, avval 25-kun edi)
- [ ] **31–90-kunlarning o'zbekcha tarjimalarini ona tili egasi ko'rib chiqishi** (dialog va misollar)
- Mezon: validator 0 xato, IPA ogohlantirishlari 0 yoki `phonetic-exceptions.json` da sababi bilan

### 2. Takrorlashni bosqichli qilish + sahnada avtomatik saqlash — bajarildi
- [x] 1–2-bosqich: **tanib olish** — 4 variantdan tarjima (AI kerak emas); chalg'ituvchilar avval foydalanuvchining o'z so'zlaridan
- [x] 3–4-bosqich: **eslash** — o'zbekchasidan inglizcha so'zni yozish (AI kerak emas); uzun so'zda 1 harf xatosi kechiriladi
- [x] 5–7-bosqich: **gap tuzish** (hozirgi rejim, AI bilan)
- [x] Server rejimni bosqichga qarab tanlaydi; noto'g'ri rejimdagi javob — 409 `MODE_MISMATCH`; navbatda javob oshkor qilinmaydi; AI limiti faqat gap rejimida sarflanadi
- [x] Kunlik sahna so'zlari "Yakunlash"da avtomatik lug'atga qo'shiladi ("kamida 3 ta saqlang" qadami olib tashlanadi)
- Mezon: 20 so'zlik navbat ≤ 10–12 daqiqa; AI chaqiruvlari soni sezilarli kamayadi

### 3. Telegram eslatmalari — bajarildi (bot yaratilishi kutilmoqda)
- [x] Telegram bot: hisobni bog'lash (bir martalik kod, 15 daqiqa, bazada hash), kunlik eslatma, `/bugun`, `/stop`
- [x] Kanal tanlash: Telegram > push > email (bittasi, dublikatsiz); bot bloklansa ulanish uziladi va keyingi kanalga o'tadi
- [x] Sozlamalar → Eslatmalar: "Ulash"/"Uzish", ulanish holati o'zi yangilanadi
- [ ] @BotFather'da bot yaratish, env'ga yozish, `npm run telegram:webhook -- https://<backend>` (foydalanuvchi)
- [ ] Keyin: Telegram Mini App (ilova Telegram ichida)

### 4. Mavzular kutubxonasi (Vocabulary in Use asosida) — bajarildi (A1–C1)
- Manba: 4 ta kitob (Elementary → A1–A2, Pre-int/Intermediate → B1, Upper-int → B2, Advanced → C1). PDF'lar `server/content/vocab-topics/` da, lekin `.gitignore` (`*.pdf`) tufayli repo'ga kirmaydi
- **Mualliflik huquqi:** kitobdan faqat mavzu nomlari va so'zlar olinadi. Ta'rif, misol, matn va mashqlar ko'chirilmaydi — tarjima, ta'rif va misollarni o'zimiz yozamiz (validator bilan)
- [x] `server/content/vocab-topics/` — daraja → mavzu → so'zlar; validator (`index.js`) va testlar
- [x] Lug'at sahifasida "Mavzular" bo'limi (yangi tab emas): "+ Lug'atga" va "Hammasini qo'shish"; qo'shilgan so'z odatdagi takrorlashga tushadi
- [x] Elementary 1–15-unit'lar: 15 mavzu, 236 so'z (so'zlar kitob indeksidan tanlangan, tarjima va misollar o'zimizniki)
- [x] Elementary 16–60-unit'lar (`elementary-2/3/4.js`): **Elementary to'liq — 60 mavzu, 844 so'z**, mavzular orasida takroriy so'z yo'q
- [ ] Pre-intermediate/Intermediate — PDF shikastlangan (`pdftotext`: xref xatosi), matn chiqmadi; boshqa nusxa kerak
- [x] Upper-intermediate (B2) — `upper-intermediate-1…6.js`: **92 mavzu, 1413 so'z** (5–101-unit'lar). Kiritilmagan: 1–4 (o'rganish ko'nikmalari), 80 (talaffuz), 82 (omofonlar), 83/85 (grammatik izohlar), 98 (maqollar — o'zbekcha muqobili bilan alohida qilish kerak)
- [x] Validator butun kutubxona bo'yicha: bir so'z faqat bitta mavzuda (darajalar orasida ham)
- [x] UI: daraja almashtirgich (onboarding darajasiga qarab default)
- [x] Advanced (C1) — `advanced-1…5.js`: **98 mavzu, 1556 so'z** (1–100-unit'lar; 85 va 91 kiritilmagan — qisqartmalar B2 da bor, ko'p ma'nolilik indeksi takrorlanadi)
- **Jami kutubxona: 250 mavzu, 3813 so'z**, butun kutubxonada takroriy so'z yo'q
- [ ] Barcha tarjimalarni ona tili egasi ko'rib chiqishi (ayniqsa B2/C1 iboralari va so'zlashuv so'zlari)
- [ ] Yangi mavzular o'zbekcha tarjimalarini ona tili egasi ko'rib chiqishi

### 5. Soddalashtirish
- [x] "Gapirish" (Speaking Lab) → kunlik sahnadagi **shadowing** qadami (dialog qatorini eshitib takrorlash). Solishtirish brauzerda (`speechMatch.js`), AI limiti yemaydi; `/api/speaking` olib tashlandi
- [x] "100 kun" → sahnaning ixtiyoriy yakuniy qadami "dialogni yoddan ayt" (rol tanlanadi); audio hech qayerga yuborilmaydi; `/api/challenge` va `challenges.json` olib tashlandi (`Challenge` modeli faqat eski ma'lumotni hisob bilan o'chirish uchun qoldi)
- [x] XP/"Lv" o'rniga asosiy ko'rsatkich: **bilgan so'zlar soni** (`knownWords`) va kursdagi CEFR yo'li (`course`: "B1 · 12/36 sahna"). XP ichkarida qoladi, UI'da ko'rsatilmaydi
- [x] `planType` kunlik yangi so'zlar sonini belgilaydi: Yengil 5 · Barqaror 7 · Jadal 10 (eski `standard` — darajaga qarab)
- [x] Tariflar: 3 → 2 (Bepul, Pro). Premium sotilmaydi; eski Premium obunachilar limiti saqlanadi

### 5b. O'rganish ketma-ketligi va faol ishlatish (2026-09-30)
- [x] Takrorlashda oraliq pog'onalar — darajaga qarab (`LADDERS`, `utils/reviewModes.js`):
  boshlovchi: tanib olish ×2 → eslash ×2 → **bo'sh joy** → **gap yig'ish** ×2 (erkin gap talab qilinmaydi);
  o'rta: … → bo'sh joy → gap yig'ish → erkin gap; yuqori: … → bo'sh joy → erkin gap ×2.
  Misol gapi yo'q so'z osonrog'iga tushadi
- [x] Kunlik sahnada **"Sizning so'zlaringiz"**: lug'atdagi 2–4 so'z bugungi mavzu / kurs / kutubxona gaplarida bo'sh joyga qo'yiladi (`utils/activeWords.js`, AI'siz, SRS'ga tegmaydi)
- [x] Kurs so'zi qo'shilganda ma'no kursdan olinadi — tashqi lug'at ba'zan boshqa so'zning ma'nosini beradi ("window" → "chaff")
- [ ] Keyinroq (tanlanmagan): yumshoq xato (1-bosqichga emas, 2 pog'ona pastga), eshitib tanish, qiyin so'zlar uchun yordam

### 6. Xatolar daftari
- [ ] AI qaytargan `errorType` va tuzatishlarni saqlash
- [ ] "Sizning xatolaringiz" sahifasi: turlar bo'yicha guruh, eng ko'p takrorlanganlar
- [ ] Shaxsiy grammatika mashqlari (xato turiga qarab)

### 7. To'lov: Payme / Click
- [ ] Payme va Click integratsiyasi (webhook, idempotentlik, test rejimi)
- [ ] Mahalliy narx (taxminan 29–39 ming so'm/oy)

### Keyinroq
- Haftalik hisobot (Telegram orqali)
- Kurs so'zlari uchun inson ovozidagi talaffuz (snapshot'da 285 ta so'z uchun havola bor) yoki build vaqtida TTS audio
- O'quv markazlari uchun rejim (B2B): guruh, o'qituvchi paneli
- i18n (rus tili), accessibility auditi, e2e testlar + CI

## Bajarilganlar

- **0-faza — mantiq:** streak tartibga bog'liq emas; kunlik qadamlarni faqat server belgilaydi (`sync-quest` olib tashlandi); mashq rejimi; SRS sanalari foydalanuvchi zonasida
- **1-faza — takrorlash UX:** ovoz → avval maydonga; tarmoq xatosi alohida; Enter; keyingi sana; AI limiti takrorlashni to'xtatmaydi
- **Roadmap 4 (1-partiya) — Mavzular kutubxonasi:** `content/vocab-topics/elementary.js`, `routes/vocabTopicRoutes.js` (`/api/vocab-topics`), `components/TopicLibrary.jsx`, Lug'at → "Mavzular" (`/vocabulary?view=topics`)
- **Roadmap 3 — Telegram:** `services/telegramService.js`, `services/telegramBot.js`, `routes/telegramRoutes.js`, `scripts/telegram-webhook.js`, lokal polling (`TELEGRAM_POLLING=true`), Sozlamalardagi ulash bloki
- **Roadmap 2 — bosqichli takrorlash:** `server/utils/reviewModes.js`, `ReviewRunner` uch rejimda (1–4 tugmalari, niqoblangan misol, harf maslahati); sahna so'zlari yakunlashda avtomatik qo'shiladi (`wordsAdded`)
- **2–3-faza — dizayn:** binafsha OKLCH tokenlar, Motion, telefon tab-bari, barcha sahifalar, yangi logotip va PWA ikonkalari, Sozlamalar sahifasi, landing sahifa

## Qarorlar jurnali

| Sana | Qaror | Sabab |
|---|---|---|
| 2026-09-29 | Takrorlash rejimini server tanlaydi (bosqichga qarab) | Mijoz o'ziga osonini tanlay olmasligi uchun; 7 takrorlash = 2 tanib olish + 2 eslash + 3 gap |
| 2026-09-29 | Vocabulary in Use mavzulari Telegram'dan keyin (4-band) | Foydalanuvchi qarori; kitob matni ko'chirilmaydi — faqat mavzu va so'zlar |
| 2026-09-29 | Payme/Click eng oxirida | Foydalanuvchi qarori |
| 2026-09-29 | Kontent birinchi o'rinda | 30 kunlik kontent — eng katta retention xavfi |
| 2026-10-01 | Suhbat — rejaning majburiy qadami | Foydalanuvchi qarori: har kun gapirishga majbur qilish. AI ishlamasa ssenariy rejimi — qadam hech qachon tashqi xizmat tufayli bloklanmaydi |
| 2026-10-01 | Bepul tarifda kuniga 1 suhbat | Foydalanuvchi qarori: kunlik reja uchun yetadi, AI xarajati nazoratda, Pro'ga aniq qiymat |
| 2026-10-01 | Mavzular kutubxonasi yashiriladi, kontent saqlanadi | Foydalanuvchi qarori: kursdan 4 baravar katta parallel dastur "kuniga 15 daqiqa"ni buzardi |
| 2026-10-01 | Email tasdiqlash bloklamaydi | Ro'yxatdan o'tgan odam darhol o'qiy boshlashi kerak; faqat to'lov va email eslatmalar pochta egaligini talab qiladi |
| 2026-10-01 | Register "email band" deb aniq aytishda davom etadi | Umumiy javob ro'yxatdan o'tishni bloklashni talab qiladi (avval xat, keyin kirish) — konversiyani tushiradi. Ro'yxat yig'ish rate limit bilan cheklangan |
| 2026-09-29 | "100 kun" jadvali haqiqiy kun sonini ko'rsatadi (30) | 100 deb qotirilgan edi — yolg'on va'da |
