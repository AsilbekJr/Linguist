/**
 * A1 bloki — 1-8 kunlar.
 *
 * Tamoyillar:
 *  - Har bir mavzu bitta REAL vaziyat. So'zlar shu vaziyatdan chiqadi,
 *    tasodifiy ro'yxatdan emas.
 *  - Har bir so'z mavzu dialogida haqiqatan ishlatiladi (validator buni majbur qiladi).
 *  - A1 leksikasi: eng chastotali kundalik so'zlar. Bu yerda "Ubiquitous" yoki
 *    "Procrastinate" bo'lishi mumkin emas — eski kontentning asosiy xatosi shu edi.
 *
 * Kortej formati:
 *   [word, translation, phonetic, partOfSpeech, definition, example, exampleUz, cefr?, collocations?]
 * Dialog:
 *   [speaker, en, uz]
 */

module.exports = [
  {
    day: 1,
    cefr: 'A1',
    emoji: '👋',
    topic: 'Meeting Someone New',
    topicUz: 'Tanishuv',
    description: 'Birinchi tanishuvda ishlatiladigan eng kerakli so\'zlar.',
    grammarFocus: 'to be: I am / you are / he is',
    story:
      "Siz kursda yangi odam bilan tanishyapsiz. U sizning ismingizni, qayerdan ekanligingizni va nima qilishingizni so'raydi. Bugun shu suhbatni to'liq olib chiqa oladigan so'zlarni o'rganamiz.",
    dialogue: [
      ['Aziz', "Hello! My name is Aziz. What is your name?", "Salom! Mening ismim Aziz. Ismingiz nima?"],
      ['Sara', "Hello, Aziz. I am Sara. Nice to meet you.", "Salom, Aziz. Men Saraman. Tanishganimdan xursandman."],
      ['Aziz', "Nice to meet you too. Where are you from?", "Men ham xursandman. Siz qayerdansiz?"],
      ['Sara', "I am from Samarkand, but I live in Tashkent now.", "Men Samarqanddanman, lekin hozir Toshkentda yashayman."],
      ['Aziz', "Are you a student?", "Siz talabamisiz?"],
      ['Sara', "Yes. I am twenty years old and I study English.", "Ha. Men yigirma yoshdaman va ingliz tilini o'rganaman."],
      ['Aziz', "Thank you for your time. See you soon!", "Vaqtingiz uchun rahmat. Ko'rishguncha!"],
    ],
    words: [
      ['hello', 'salom', '/həˈləʊ/', 'phrase', 'a word you say when you meet someone', 'She said hello to her teacher.', "U o'qituvchisiga salom berdi.", 'A1', ['say hello']],
      ['name', 'ism', '/neɪm/', 'noun', 'the word that a person is called by', 'My name is Aziz.', 'Mening ismim Aziz.', 'A1', ['first name', 'full name']],
      ['meet', 'uchrashmoq', '/miːt/', 'verb', 'to see and talk to someone for the first time', 'I meet my friends every Sunday.', "Men har yakshanba do'stlarim bilan uchrashaman.", 'A1', ['nice to meet you']],
      ['from', 'dan', '/frɒm/', 'preposition', 'showing where someone or something started', 'I am from Samarkand.', 'Men Samarqanddanman.', 'A1', ['where are you from']],
      ['live', 'yashamoq', '/lɪv/', 'verb', 'to have your home in a place', 'They live in a small house.', 'Ular kichik uyda yashaydi.', 'A1', ['live in']],
      ['student', 'talaba', '/ˈstjuːdənt/', 'noun', 'a person who studies at a school or university', 'He is a student at the university.', 'U universitet talabasi.', 'A1', []],
      ['year', 'yil', '/jɪə/', 'noun', 'a period of twelve months', 'My sister is ten years old.', "Singlim o'n yoshda.", 'A1', ['years old', 'last year']],
      ['old', 'yoshda; eski', '/əʊld/', 'adjective', 'having lived or existed for a long time', 'This book is very old.', 'Bu kitob juda eski.', 'A1', ['how old are you']],
      ['nice', 'yoqimli', '/naɪs/', 'adjective', 'pleasant or kind', 'You have a nice smile.', 'Sizning tabassumingiz yoqimli.', 'A1', ['nice to meet you']],
      ['thank', 'rahmat aytmoq', '/θæŋk/', 'verb', 'to tell someone you are grateful', 'I want to thank my teacher.', "Men o'qituvchimga rahmat aytmoqchiman.", 'A1', ['thank you']],
    ],
  },

  {
    day: 2,
    cefr: 'A1',
    emoji: '👨‍👩‍👧',
    topic: 'My Family',
    topicUz: 'Oilam',
    description: "Oila a'zolari haqida gapirish.",
    grammarFocus: 'have / has got',
    story:
      "Yangi tanishingiz oilangiz haqida so'radi. O'zbek madaniyatida bu eng oddiy suhbat mavzusi — shuning uchun bu so'zlar birinchi kunlardanoq kerak bo'ladi.",
    dialogue: [
      ['Sara', "Do you have a big family?", "Sizning oilangiz kattami?"],
      ['Aziz', "Yes. My mother, my father, my brother and my sister live together.", "Ha. Onam, otam, akam va singlim birga yashaymiz."],
      ['Sara', "Is your brother married?", "Akangiz uylanganmi?"],
      ['Aziz', "Yes, he has one son and one daughter.", "Ha, uning bitta o'g'li va bitta qizi bor."],
      ['Sara', "How old is his daughter?", "Qizi necha yoshda?"],
      ['Aziz', "She is a small child. My grandmother helps with her.", "U kichkina bola. Buvim unga qaraydi."],
    ],
    words: [
      ['family', 'oila', '/ˈfæməli/', 'noun', 'a group of people who are related to each other', 'My family is very important to me.', 'Oilam men uchun juda muhim.', 'A1', ['big family', 'family member']],
      ['mother', 'ona', '/ˈmʌðə/', 'noun', 'a female parent', 'My mother cooks dinner every evening.', 'Onam har kechqurun kechki ovqat tayyorlaydi.', 'A1', []],
      ['father', 'ota', '/ˈfɑːðə/', 'noun', 'a male parent', 'His father works in a school.', 'Uning otasi maktabda ishlaydi.', 'A1', []],
      ['brother', 'aka; uka', '/ˈbrʌðə/', 'noun', 'a boy or man with the same parents as you', 'My brother plays football.', 'Akam futbol o\'ynaydi.', 'A1', ['older brother']],
      ['sister', 'opa; singil', '/ˈsɪstə/', 'noun', 'a girl or woman with the same parents as you', 'Her sister is a doctor.', 'Uning opasi shifokor.', 'A1', ['younger sister']],
      ['son', "o'g'il", '/sʌn/', 'noun', 'someone\'s male child', 'They have one son.', "Ularning bitta o'g'li bor.", 'A1', []],
      ['daughter', 'qiz (farzand)', '/ˈdɔːtə/', 'noun', 'someone\'s female child', 'My daughter is five years old.', 'Qizim besh yoshda.', 'A1', []],
      ['grandmother', 'buvi', '/ˈɡrænmʌðə/', 'noun', 'the mother of your mother or father', 'My grandmother tells good stories.', 'Buvim yaxshi ertaklar aytadi.', 'A1', []],
      ['married', 'uylangan; turmushga chiqqan', '/ˈmærid/', 'adjective', 'having a husband or wife', 'My brother is married.', 'Akam uylangan.', 'A1', ['get married']],
      ['child', 'bola', '/tʃaɪld/', 'noun', 'a young boy or girl', 'The child is playing in the garden.', "Bola bog'da o'ynayapti.", 'A1', []],
    ],
  },

  {
    day: 3,
    cefr: 'A1',
    emoji: '🕐',
    topic: 'Time and Numbers',
    topicUz: 'Vaqt va raqamlar',
    description: 'Soat, kun va vaqtni aytish.',
    grammarFocus: 'What time is it? / at + time',
    story:
      "Do'stingiz bilan uchrashuv belgilayapsiz. Vaqtni to'g'ri aytolmaslik — boshlang'ich darajadagi eng ko'p uchraydigan muammo. Bugun shuni yopamiz.",
    dialogue: [
      ['Sara', "What time is it now?", "Hozir soat necha?"],
      ['Aziz', "It is nine in the morning.", "Ertalab soat to'qqiz."],
      ['Sara', "Our lesson starts in one hour.", "Darsimiz bir soatdan keyin boshlanadi."],
      ['Aziz', "We have thirty minutes to walk there. Do not be late.", "U yerga borish uchun o'ttiz daqiqamiz bor. Kechikmang."],
      ['Sara', "Is the lesson today or tomorrow?", "Dars bugunmi yoki ertagami?"],
      ['Aziz', "Today. Tomorrow evening we have a free week.", "Bugun. Ertaga kechqurun bo'sh haftamiz bor."],
      ['Sara', "Give me your phone number, please.", "Iltimos, telefon raqamingizni bering."],
    ],
    words: [
      ['time', 'vaqt', '/taɪm/', 'noun', 'the thing we measure in hours and minutes', 'What time does the shop open?', "Do'kon soat nechada ochiladi?", 'A1', ['what time', 'on time']],
      ['hour', 'soat (davomiylik)', '/ˈaʊə/', 'noun', 'a period of sixty minutes', 'I study for one hour every day.', 'Men har kuni bir soat o\'qiyman.', 'A1', ['half an hour']],
      ['minute', 'daqiqa', '/ˈmɪnɪt/', 'noun', 'a period of sixty seconds', 'Please wait ten minutes.', "Iltimos, o'n daqiqa kuting.", 'A1', ['in a minute']],
      ['morning', 'ertalab', '/ˈmɔːnɪŋ/', 'noun', 'the early part of the day', 'I drink tea in the morning.', 'Men ertalab choy ichaman.', 'A1', ['good morning', 'in the morning']],
      ['evening', 'kechqurun', '/ˈiːvnɪŋ/', 'noun', 'the part of the day between afternoon and night', 'We watch a film in the evening.', 'Biz kechqurun film ko\'ramiz.', 'A1', ['good evening']],
      ['today', 'bugun', '/təˈdeɪ/', 'adverb', 'on this day', 'Today is a beautiful day.', 'Bugun ajoyib kun.', 'A1', []],
      ['tomorrow', 'ertaga', '/təˈmɒrəʊ/', 'adverb', 'on the day after today', 'I will call you tomorrow.', "Ertaga sizga qo'ng'iroq qilaman.", 'A1', ['see you tomorrow']],
      ['week', 'hafta', '/wiːk/', 'noun', 'a period of seven days', 'There are seven days in a week.', 'Bir haftada yetti kun bor.', 'A1', ['next week', 'last week']],
      ['late', 'kech', '/leɪt/', 'adjective', 'after the expected time', 'Do not be late for the lesson.', 'Darsga kechikmang.', 'A1', ['be late']],
      ['number', 'raqam', '/ˈnʌmbə/', 'noun', 'a word or sign such as 1, 2 or 3', 'My phone number is easy to remember.', 'Telefon raqamimni eslab qolish oson.', 'A1', ['phone number']],
    ],
  },

  {
    day: 4,
    cefr: 'A1',
    emoji: '🛍️',
    topic: 'At the Shop',
    topicUz: "Do'konda",
    description: 'Narx so\'rash, tanlash va to\'lash.',
    grammarFocus: 'this / that, How much is it?',
    story:
      "Do'konga kirdingiz va sotuvchi bilan gaplashishingiz kerak. Narxni so'rash va \"qimmat/arzon\" deyish — chet elda birinchi kundan kerak bo'ladigan ko'nikma.",
    dialogue: [
      ['Seller', "Hello! Can I help you?", "Salom! Yordam bera olamanmi?"],
      ['Sara', "Yes, I need a new bag.", "Ha, menga yangi sumka kerak."],
      ['Seller', "This one is a good size. The price is fifty thousand som.", "Bu yaxshi o'lcham. Narxi ellik ming so'm."],
      ['Sara', "That is expensive. Do you have a cheap one?", "Bu qimmat. Arzonrog'i bormi?"],
      ['Seller', "Yes, this bag is cheap and strong.", "Ha, bu sumka arzon va mustahkam."],
      ['Sara', "Good, I will buy it. Can I pay with money or card?", "Yaxshi, sotib olaman. Naqd pul yoki karta bilan to'lasam bo'ladimi?"],
      ['Seller', "Both are fine. Thank you for coming to our shop.", "Ikkalasi ham bo'ladi. Do'konimizga kelganingiz uchun rahmat."],
    ],
    words: [
      ['shop', "do'kon", '/ʃɒp/', 'noun', 'a place where you buy things', 'The shop opens at nine.', "Do'kon to'qqizda ochiladi.", 'A1', ['go shopping']],
      ['buy', 'sotib olmoq', '/baɪ/', 'verb', 'to get something by paying money', 'I want to buy some bread.', 'Men non sotib olmoqchiman.', 'A1', []],
      ['price', 'narx', '/praɪs/', 'noun', 'the amount of money you pay for something', 'The price of milk is going up.', 'Sut narxi oshyapti.', 'A1', ['high price', 'low price']],
      ['money', 'pul', '/ˈmʌni/', 'noun', 'coins and notes used to buy things', 'He has no money in his pocket.', 'Uning cho\'ntagida puli yo\'q.', 'A1', ['spend money', 'save money']],
      ['cheap', 'arzon', '/tʃiːp/', 'adjective', 'not costing much money', 'This shirt is very cheap.', 'Bu ko\'ylak juda arzon.', 'A1', []],
      ['expensive', 'qimmat', '/ɪkˈspensɪv/', 'adjective', 'costing a lot of money', 'Cars are expensive in our country.', 'Bizning mamlakatimizda mashinalar qimmat.', 'A1', []],
      ['pay', "to'lamoq", '/peɪ/', 'verb', 'to give money for something', 'You can pay by card here.', 'Bu yerda karta bilan to\'lashingiz mumkin.', 'A1', ['pay for', 'pay by card']],
      ['bag', 'sumka', '/bæɡ/', 'noun', 'a container you carry things in', 'Put the fruit in the bag.', 'Mevani sumkaga soling.', 'A1', []],
      ['size', "o'lcham", '/saɪz/', 'noun', 'how big or small something is', 'What size do you wear?', 'Qaysi o\'lchamni kiyasiz?', 'A1', ['what size']],
      ['need', 'kerak bo\'lmoq', '/niːd/', 'verb', 'to must have something', 'I need a warm coat for winter.', 'Menga qish uchun iliq palto kerak.', 'A1', []],
    ],
  },

  {
    day: 5,
    cefr: 'A1',
    emoji: '🍞',
    topic: 'Food and Drink',
    topicUz: 'Ovqat va ichimlik',
    description: 'Ovqat haqida gapirish va nimadir so\'rash.',
    grammarFocus: 'countable / uncountable: some, any',
    story:
      "Mehmonga bordingiz yoki uyda oila bilan dasturxondasiz. \"Ochman\", \"chanqadim\", \"choy ichasizmi\" — bular kundalik hayotning eng chastotali gaplari.",
    dialogue: [
      ['Aziz', "Are you hungry?", "Qorningiz ochmi?"],
      ['Sara', "Yes, very. I want to eat something.", "Ha, juda. Men nimadir yemoqchiman."],
      ['Aziz', "We have bread, meat and fruit at home.", "Uyda non, go'sht va meva bor."],
      ['Sara', "That is good food. I am also thirsty.", "Bu yaxshi ovqat. Men chanqadim ham."],
      ['Aziz', "Do you want to drink water or tea?", "Suv yoki choy ichasizmi?"],
      ['Sara', "Green tea, please.", "Ko'k choy, iltimos."],
    ],
    words: [
      ['food', 'ovqat', '/fuːd/', 'noun', 'things that people eat', 'Uzbek food is delicious.', "O'zbek taomlari mazali.", 'A1', ['fast food']],
      ['bread', 'non', '/bred/', 'noun', 'a basic food made from flour', 'We buy fresh bread every morning.', 'Biz har kuni ertalab yangi non sotib olamiz.', 'A1', []],
      ['water', 'suv', '/ˈwɔːtə/', 'noun', 'the clear liquid that people drink', 'Drink two litres of water a day.', 'Kuniga ikki litr suv iching.', 'A1', ['drink water', 'hot water']],
      ['tea', 'choy', '/tiː/', 'noun', 'a hot drink made from leaves', 'My father drinks tea with sugar.', 'Otam choyni shakar bilan ichadi.', 'A1', ['green tea', 'black tea']],
      ['meat', "go'sht", '/miːt/', 'noun', 'the flesh of animals used as food', 'She does not eat meat.', "U go'sht yemaydi.", 'A1', []],
      ['fruit', 'meva', '/fruːt/', 'noun', 'sweet food that grows on trees and plants', 'Apples are my favourite fruit.', 'Olma mening sevimli mevam.', 'A1', ['fresh fruit']],
      ['hungry', 'och', '/ˈhʌŋɡri/', 'adjective', 'wanting to eat', 'The children are hungry after school.', 'Bolalar maktabdan keyin och.', 'A1', ['I am hungry']],
      ['thirsty', 'chanqagan', '/ˈθɜːsti/', 'adjective', 'wanting to drink', 'I am thirsty after running.', 'Yugurgandan keyin chanqadim.', 'A1', []],
      ['eat', 'yemoq', '/iːt/', 'verb', 'to put food in your mouth and swallow it', 'We eat dinner at seven.', 'Biz kechki ovqatni yettida yeymiz.', 'A1', ['eat out']],
      ['drink', 'ichmoq', '/drɪŋk/', 'verb', 'to take liquid into your mouth', 'What do you want to drink?', 'Nima ichmoqchisiz?', 'A1', []],
    ],
  },

  {
    day: 6,
    cefr: 'A1',
    emoji: '🏠',
    topic: 'My Home',
    topicUz: 'Uyim',
    description: 'Uy va xonalarni tasvirlash.',
    grammarFocus: 'there is / there are',
    story:
      "Kimdir sizdan uyingiz haqida so'radi yoki siz ijaraga uy qidiryapsiz. Xonalar va jihozlar nomi — tavsiflash ko'nikmasining asosi.",
    dialogue: [
      ['Sara', "Is your house big or small?", "Uyingiz kattami yoki kichikmi?"],
      ['Aziz', "It is not big. We have three rooms and a kitchen.", "Katta emas. Bizda uchta xona va oshxona bor."],
      ['Sara', "Does your room have a window?", "Xonangizda deraza bormi?"],
      ['Aziz', "Yes, a big window near the table.", "Ha, stol yonida katta deraza."],
      ['Sara', "Do you have a chair there too?", "U yerda stul ham bormi?"],
      ['Aziz', "Yes. Please close the door — I want to clean the small room.", "Ha. Iltimos, eshikni yoping — kichik xonani tozalamoqchiman."],
    ],
    words: [
      ['house', 'uy', '/haʊs/', 'noun', 'a building where people live', 'Their house has a green roof.', 'Ularning uyi yashil tomli.', 'A1', ['at house']],
      ['room', 'xona', '/ruːm/', 'noun', 'a part of a building with walls and a door', 'This room is very quiet.', 'Bu xona juda tinch.', 'A1', ['living room']],
      ['kitchen', 'oshxona', '/ˈkɪtʃɪn/', 'noun', 'the room where you cook food', 'Mother is cooking in the kitchen.', 'Onam oshxonada ovqat pishirmoqda.', 'A1', []],
      ['door', 'eshik', '/dɔː/', 'noun', 'the thing you open to go into a room', 'Please close the door.', 'Iltimos, eshikni yoping.', 'A1', ['open the door', 'close the door']],
      ['window', 'deraza', '/ˈwɪndəʊ/', 'noun', 'an opening in a wall with glass', 'Open the window, it is hot.', 'Derazani oching, issiq.', 'A1', []],
      ['table', 'stol', '/ˈteɪbl/', 'noun', 'a piece of furniture with a flat top and legs', 'The food is on the table.', 'Ovqat stol ustida.', 'A1', ['on the table']],
      ['chair', 'stul', '/tʃeə/', 'noun', 'a seat for one person', 'Sit on this chair, please.', 'Iltimos, bu stulga o\'tiring.', 'A1', []],
      ['clean', 'tozalamoq; toza', '/kliːn/', 'verb', 'to make something free from dirt', 'I clean my room on Sunday.', 'Men yakshanba kuni xonamni tozalayman.', 'A1', []],
      ['big', 'katta', '/bɪɡ/', 'adjective', 'large in size', 'They live in a big city.', 'Ular katta shaharda yashaydi.', 'A1', []],
      ['small', 'kichik', '/smɔːl/', 'adjective', 'not large in size', 'We have a small garden.', "Bizda kichik bog' bor.", 'A1', []],
    ],
  },

  {
    day: 7,
    cefr: 'A1',
    emoji: '⏰',
    topic: 'My Daily Routine',
    topicUz: 'Kundalik tartibim',
    description: 'Kun davomida nima qilishingizni aytish.',
    grammarFocus: 'Present Simple + chastota qo\'shimchalari',
    story:
      "Kundalik tartib haqida gapirish — Present Simple ni mustahkamlashning eng tabiiy yo'li. Bu zamon o'zbek tilida so'zlashuvchilar uchun eng ko'p xato qiladigan joy.",
    dialogue: [
      ['Sara', "What time do you wake up?", "Soat nechada uyg'onasiz?"],
      ['Aziz', "I always wake up at six.", "Men doim oltida uyg'onaman."],
      ['Sara', "When do you start work?", "Ishni qachon boshlaysiz?"],
      ['Aziz', "I start at eight and finish at five. I am usually busy.", "Sakkizda boshlab beshda tugataman. Men odatda bandman."],
      ['Sara', "Are you tired in the evening?", "Kechqurun charchaysizmi?"],
      ['Aziz', "Yes, I sleep early. I never sleep late.", "Ha, erta uxlayman. Hech qachon kech uxlamayman."],
    ],
    words: [
      ['wake', "uyg'onmoq", '/weɪk/', 'verb', 'to stop sleeping', 'I wake up early on Monday.', 'Dushanba kuni erta uyg\'onaman.', 'A1', ['wake up']],
      ['sleep', 'uxlamoq', '/sliːp/', 'verb', 'to rest with your eyes closed', 'Children need to sleep eight hours.', 'Bolalar sakkiz soat uxlashi kerak.', 'A1', ['go to sleep']],
      ['work', 'ish; ishlamoq', '/wɜːk/', 'noun', 'the job a person does', 'My father goes to work by bus.', 'Otam ishga avtobusda boradi.', 'A1', ['go to work', 'at work']],
      ['start', 'boshlamoq', '/stɑːt/', 'verb', 'to begin doing something', 'The lessons start in September.', 'Darslar sentabrda boshlanadi.', 'A1', []],
      ['finish', 'tugatmoq', '/ˈfɪnɪʃ/', 'verb', 'to complete something', 'I finish my homework before dinner.', 'Uy vazifamni kechki ovqatdan oldin tugataman.', 'A1', []],
      ['always', 'doim', '/ˈɔːlweɪz/', 'adverb', 'every time; all the time', 'She always helps her friends.', "U doim do'stlariga yordam beradi.", 'A1', []],
      ['never', 'hech qachon', '/ˈnevə/', 'adverb', 'not at any time', 'He never eats fast food.', 'U hech qachon tez tayyor ovqat yemaydi.', 'A1', []],
      ['usually', 'odatda', '/ˈjuːʒuəli/', 'adverb', 'most of the time', 'We usually go home together.', 'Biz odatda uyga birga qaytamiz.', 'A1', []],
      ['busy', 'band', '/ˈbɪzi/', 'adjective', 'having a lot of things to do', 'The doctor is busy today.', 'Shifokor bugun band.', 'A1', []],
      ['tired', 'charchagan', '/ˈtaɪəd/', 'adjective', 'needing rest or sleep', 'I am tired after a long day.', 'Uzoq kundan keyin charchadim.', 'A1', []],
    ],
  },

  {
    day: 8,
    cefr: 'A1',
    emoji: '🌤️',
    topic: 'The Weather',
    topicUz: 'Ob-havo',
    description: 'Ob-havo haqida suhbat boshlash.',
    grammarFocus: "It is + adjective / It is going to rain",
    story:
      "Ob-havo — dunyoning hamma joyida suhbat boshlash uchun eng xavfsiz mavzu. Bu so'zlarsiz oddiy small talk qilib bo'lmaydi.",
    dialogue: [
      ['Sara', "What is the weather like today?", "Bugun ob-havo qanday?"],
      ['Aziz', "It is cold and there is a strong wind.", "Sovuq va kuchli shamol bor."],
      ['Sara', "Will it rain?", "Yomg'ir yog'adimi?"],
      ['Aziz', "Maybe. In winter we also have snow here.", "Balki. Qishda bu yerda qor ham bo'ladi."],
      ['Sara', "Which season do you like?", "Qaysi faslni yoqtirasiz?"],
      ['Aziz', "Spring. It is warm and the sun is bright. Summer is too hot.", "Bahorni. Iliq va quyosh yorqin. Yoz juda issiq."],
      ['Sara', "Take an umbrella — the street is wet.", "Soyabon oling — ko'cha ho'l."],
    ],
    words: [
      ['weather', 'ob-havo', '/ˈweðə/', 'noun', 'the condition of the air: sun, rain, wind', 'The weather is nice in May.', 'Mayda ob-havo yaxshi.', 'A1', ['good weather', 'bad weather']],
      ['hot', 'issiq', '/hɒt/', 'adjective', 'having a high temperature', 'Tea is too hot to drink now.', 'Choy hozir ichish uchun juda issiq.', 'A1', []],
      ['cold', 'sovuq', '/kəʊld/', 'adjective', 'having a low temperature', 'Winter in Tashkent is cold.', 'Toshkentda qish sovuq.', 'A1', []],
      ['rain', "yomg'ir", '/reɪn/', 'noun', 'water that falls from the clouds', 'We stayed at home because of the rain.', "Yomg'ir tufayli uyda qoldik.", 'A1', ['heavy rain']],
      ['snow', 'qor', '/snəʊ/', 'noun', 'soft white pieces of frozen water that fall from the sky', 'The children play in the snow.', "Bolalar qorda o'ynaydi.", 'A1', []],
      ['sun', 'quyosh', '/sʌn/', 'noun', 'the star that gives light to the earth', 'The sun rises at six.', 'Quyosh oltida chiqadi.', 'A1', ['in the sun']],
      ['wind', 'shamol', '/wɪnd/', 'noun', 'moving air', 'A cold wind is blowing.', 'Sovuq shamol esmoqda.', 'A1', ['strong wind']],
      ['warm', 'iliq', '/wɔːm/', 'adjective', 'a little hot, in a pleasant way', 'Wear a warm jacket.', 'Iliq kurtka kiying.', 'A1', []],
      ['wet', "ho'l", '/wet/', 'adjective', 'covered with water', 'My shoes are wet.', "Oyoq kiyimlarim ho'l.", 'A1', []],
      ['season', 'fasl', '/ˈsiːzn/', 'noun', 'one of the four parts of the year', 'Autumn is my favourite season.', 'Kuz mening sevimli faslim.', 'A1', []],
    ],
  },
];
