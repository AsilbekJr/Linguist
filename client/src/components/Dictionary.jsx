import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, ChevronLeft, CloudLightning, ShoppingBag, Users, Plane, Briefcase, HeartPulse, Laptop } from "lucide-react";

// Massive Curated dictionary data
const dictionaryData = [
  {
    id: 'weather',
    title: 'Ob-havo (Weather)',
    desc: 'Kunlik ob-havo va tabiat hodisalariga oid suzlar.',
    icon: CloudLightning,
    color: 'text-blue-500',
    words: [
      { word: 'Drizzle', translation: 'Mayda yomg\'ir', definition: 'Light rain falling in very fine drops.', example: 'It was beginning to drizzle.' },
      { word: 'Overcast', translation: 'Bulutli (Buluq)', definition: 'Covered with clouds; dull.', example: 'It was a gloomy, overcast morning.' },
      { word: 'Scorching', translation: 'Juda issiq (Jazirama)', definition: 'Very hot.', example: 'They walked outside into the scorching heat.' },
      { word: 'Breeze', translation: 'Shabada', definition: 'A gentle wind.', example: 'A cool breeze blew through the open window.' },
      { word: 'Humid', translation: 'Nam / Rutubatli', definition: 'Marked by a relatively high level of water vapor in the atmosphere.', example: 'The air was so humid it was hard to breathe.' },
      { word: 'Blizzard', translation: 'Qor bo\'roni', definition: 'A severe snowstorm with high winds.', example: 'The blizzard made driving impossible.' },
      { word: 'Hail', translation: 'Do\'l', definition: 'Pellets of frozen rain.', example: 'It hailed so hard that the cars were dented.' },
      { word: 'Thunderstorm', translation: 'Momaqaldiroq', definition: 'A storm with thunder and lightning.', example: 'We took shelter during the heavy thunderstorm.' },
      { word: 'Foggy', translation: 'Tumanli', definition: 'Full of or accompanied by fog.', example: 'It was a very foggy morning.' },
      { word: 'Freezing', translation: 'Muzlatuvchi (Qahraton)', definition: 'Below 0°C; extremely cold.', example: 'Put your coat on, it\'s freezing outside!' },
      { word: 'Mild', translation: 'Mo\'tadil (Havo)', definition: 'Not severe, harsh, or extreme.', example: 'We are enjoying a very mild winter.' },
      { word: 'Gale', translation: 'Kuchli shamol', definition: 'A very strong wind.', example: 'The gale destroyed several roofs.' },
      { word: 'Drought', translation: 'Qurg\'oqchilik', definition: 'A prolonged period of abnormally low rainfall.', example: 'The drought destroyed the entire crop.' },
      { word: 'Chilly', translation: 'Salqin', definition: 'Uncomfortably cool or cold.', example: 'It got quite chilly in the evening.' },
      { word: 'Pouring', translation: 'Sharabros (Yomg\'ir)', definition: 'Raining heavily.', example: 'You cannot go out, it is pouring out there!' },
      { word: 'Clear', translation: 'Ochiq (Havo)', definition: 'Free of clouds.', example: 'It was a beautiful clear night.' },
      { word: 'Damp', translation: 'Nam (biroz nam)', definition: 'Slightly wet, often in a way that is unpleasant.', example: 'The grass is still damp.' },
      { word: 'Frost', translation: 'Ayoz / Qirov', definition: 'A deposit of small white ice crystals formed on the ground.', example: 'There was a heavy frost last night.' },
      { word: 'Hurricane', translation: 'Dovul', definition: 'A storm with a violent wind.', example: 'The hurricane caused massive destruction.' },
      { word: 'Overwhelming', translation: 'Juda kuchli / Bo\'g\'uvchi', definition: 'Very great in amount.', example: 'The heat was overwhelming.' }
    ]
  },
  {
    id: 'shopping',
    title: 'Xarid qilish (Shopping)',
    desc: 'Bozor, do\'kon va savdolashishga oid kerakli lug\'at.',
    icon: ShoppingBag,
    color: 'text-pink-500',
    words: [
      { word: 'Bargain', translation: 'Arzon narsa / Savdolashmoq', definition: 'A thing bought or offered for sale more cheaply than is usual.', example: 'The second-hand table was a real bargain.' },
      { word: 'Receipt', translation: 'Kvitansiya (Chek)', definition: 'A written or printed statement acknowledging that something has been paid for.', example: 'Please keep your receipt as proof of purchase.' },
      { word: 'Refund', translation: 'Pulni qaytarish', definition: 'A repayment of a sum of money.', example: 'If you are not satisfied, we will give you a full refund.' },
      { word: 'Showcase', translation: 'Vitrina', definition: 'A glass case used for displaying articles.', example: 'The rare jewel was displayed in a secure showcase.' },
      { word: 'Cashier', translation: 'Kassir', definition: 'A person handling payments and receipts in a shop.', example: 'The cashier handed me my change.' },
      { word: 'Discount', translation: 'Chegirma', definition: 'A deduction from the usual cost of something.', example: 'Many stores offer a student discount.' },
      { word: 'In stock', translation: 'Sotuvda mavjud', definition: 'Available for immediate sale.', example: 'Luckily, the shoes were in stock.' },
      { word: 'Out of stock', translation: 'Sotuvda qolmagan', definition: 'Temporarily unavailable for sale.', example: 'I am sorry, that size is out of stock.' },
      { word: 'Trolley', translation: 'Aravacha', definition: 'A large metal basket on wheels provided by supermarkets.', example: 'I filled the trolley with groceries.' },
      { word: 'Aisle', translation: 'Qator (Do\'konda)', definition: 'A passage between shelves of goods in a supermarket.', example: 'You will find coffee in aisle three.' },
      { word: 'Affordable', translation: 'Hamyonbop', definition: 'Inexpensive; reasonably priced.', example: 'They sell affordable clothes.' },
      { word: 'Overpriced', translation: 'Narxi oshirib yuborilgan', definition: 'Charging too much for goods.', example: 'The food at the tourist trap was overpriced.' },
      { word: 'Rip-off', translation: 'O\'ta qimmat (Aldov)', definition: 'A grossly overpriced article.', example: '$50 for a coffee?! That\'s a rip-off!' },
      { word: 'Brand', translation: 'Brend (Marka)', definition: 'A type of product manufactured by a particular company.', example: 'Which brand of toothpaste do you use?' },
      { word: 'Fitting room', translation: 'Kiyib ko\'rish xonasi', definition: 'A room in a shop where you can try on clothes.', example: 'The fitting rooms are at the back of the store.' },
      { word: 'Wholesale', translation: 'Ulgurji', definition: 'The selling of goods in large quantities to be retailed by others.', example: 'We buy our products wholesale.' },
      { word: 'Retail', translation: 'Chakana savdo', definition: 'The sale of goods to the public.', example: 'Retail prices are always higher.' },
      { word: 'Purchase', translation: 'Sotib olmoq / Xarid', definition: 'To acquire something by paying for it.', example: 'He made a large purchase today.' },
      { word: 'Warranty', translation: 'Kafolat', definition: 'A written guarantee.', example: 'This laptop comes with a two-year warranty.' },
      { word: 'Queue', translation: 'Navbat', definition: 'A line of people waiting.', example: 'We had to wait in a long queue to pay.' }
    ]
  },
  {
    id: 'intro',
    title: 'Tanishuv (Introductions)',
    desc: 'Odamlar bilan ilk muloqot va o\'zni tanishtirish.',
    icon: Users,
    color: 'text-green-500',
    words: [
      { word: 'Acquaintance', translation: 'Tanish', definition: 'A person\'s knowledge or experience of something, or someone known slightly.', example: 'He is more of an acquaintance than a friend.' },
      { word: 'Sociable', translation: 'Kirishimli (Suhbatkash)', definition: 'Willing to talk and engage in activities with other people; friendly.', example: 'She is a very sociable person.' },
      { word: 'Greeting', translation: 'Salomlashish', definition: 'A polite word or sign of welcome.', example: 'He gave her a warm greeting.' },
      { word: 'Fascinating', translation: 'Maftunkor / Qiziqarli', definition: 'Extremely interesting.', example: 'I found her travels fascinating to listen to.' },
      { word: 'Outgoing', translation: 'Ochiqko\'ngil', definition: 'Friendly and socially confident.', example: 'She has a very outgoing personality.' },
      { word: 'Introverted', translation: 'Kamtavazin / Odmovi', definition: 'Shy, reticent.', example: 'As an introverted person, he prefers reading over partying.' },
      { word: 'Background', translation: 'Kelib chiqishi (O\'tmish)', definition: 'A person\'s education, experience, and social circumstances.', example: 'Tell me a little about your background.' },
      { word: 'Hobby', translation: 'Sevimli mashg\'ulot', definition: 'An activity done regularly in one\'s leisure time for pleasure.', example: 'My favorite hobby is reading.' },
      { word: 'Mutual', translation: 'O\'zaro / Birgalikdagi', definition: 'Held in common by two or more parties.', example: 'We met through a mutual friend.' },
      { word: 'Encounter', translation: 'To\'qnashuv / Uchrashuv', definition: 'An unexpected or casual meeting.', example: 'Our encounter was purely accidental.' },
      { word: 'Familiar', translation: 'Tanish (Mashhur)', definition: 'Well known from long or close association.', example: 'That face looks very familiar.' },
      { word: 'Pleasure', translation: 'Mamnuniyat', definition: 'A feeling of happy satisfaction.', example: 'It is a pleasure to meet you.' },
      { word: 'Introduction', translation: 'Tanishtiruv', definition: 'The action of introducing someone to someone else.', example: 'Let me do the introductions.' },
      { word: 'Origin', translation: 'Kelib chiqish joyi', definition: 'The point or place where something begins.', example: 'What is your country of origin?' },
      { word: 'Chatty', translation: 'Suhbatkash (Sergap)', definition: 'Ready to talk in a friendly way.', example: 'The taxi driver was very chatty.' },
      { word: 'Shy', translation: 'Uyatchang', definition: 'Being reserved or having or showing nervousness.', example: 'She was too shy to speak up.' },
      { word: 'Curious', translation: 'Qiziquvchan', definition: 'Eager to know or learn something.', example: 'I am curious about your new job.' },
      { word: 'Engaging', translation: 'Jozibador', definition: 'Charming and attractive.', example: 'He had an engaging smile.' },
      { word: 'Polite', translation: 'Xushmuomala', definition: 'Having or showing behavior that is respectful.', example: 'It is important to be polite to strangers.' },
      { word: 'Awkward', translation: 'Noqulay', definition: 'Causing or feeling embarrassment or inconvenience.', example: 'There was an awkward silence in the room.' }
    ]
  },
  {
    id: 'travel',
    title: 'Sayohat (Travel)',
    desc: 'Mehmonxona, aeroport va sayohat bo\'yicha muhim iboralar.',
    icon: Plane,
    color: 'text-purple-500',
    words: [
      { word: 'Itinerary', translation: 'Sayohat yo\'nalishi', definition: 'A planned route or journey.', example: 'We will send you a revised itinerary.' },
      { word: 'Layover', translation: 'To\'xtab o\'tish (Tranzit)', definition: 'A period of rest or waiting before a further stage in a journey.', example: 'We had a four-hour layover in Paris.' },
      { word: 'Scenic', translation: 'Manzarali', definition: 'Providing or relating to views of impressive or beautiful natural scenery.', example: 'We took the scenic route along the coast.' },
      { word: 'Wanderlust', translation: 'Sayohatga ishtiyoq', definition: 'A strong desire to travel.', example: 'His wanderlust led him to explore over thirty countries.' },
      { word: 'Departure', translation: 'Jo\'nab ketish', definition: 'The action of leaving, especially to start a journey.', example: 'We waited in the departure lounge.' },
      { word: 'Arrival', translation: 'Yetib kelish', definition: 'The action or process of arriving.', example: 'Arrivals lounge is on the ground floor.' },
      { word: 'Destination', translation: 'Manzil', definition: 'The place to which someone or something is going.', example: 'Our ultimate destination was Rome.' },
      { word: 'Baggage', translation: 'Yuk', definition: 'Personal belongings packed in suitcases for traveling.', example: 'Check your baggage at the desk.' },
      { word: 'Accommodation', translation: 'Turar joy', definition: 'A room, group of rooms, or building in which someone may live or stay.', example: 'We booked cheap accommodation online.' },
      { word: 'Customs', translation: 'Bojxona', definition: 'The place at a port, airport, or frontier where officials check incoming goods.', example: 'It took an hour to get through customs.' },
      { word: 'Ferry', translation: 'Parom', definition: 'A boat or ship for conveying passengers and goods.', example: 'We took a ferry across the bay.' },
      { word: 'Aboard', translation: 'Bortda', definition: 'On or into (a ship, aircraft, train, or other vehicle).', example: 'Welcome aboard flight 101.' },
      { word: 'Excursion', translation: 'Ekskursiya', definition: 'A short journey or trip.', example: 'We went on an excursion to the mountains.' },
      { word: 'Getaway', translation: 'Qochish (Qisqa dam olish)', definition: 'A short holiday.', example: 'A romantic weekend getaway.' },
      { word: 'Backpack', translation: 'Ryukzak', definition: 'A bag with shoulder straps that allow it to be carried on one\'s back.', example: 'He traveled across Europe with just a backpack.' },
      { word: 'Passport', translation: 'Pasport', definition: 'An official document issued by a government.', example: 'Don\'t forget your passport!' },
      { word: 'Souvenir', translation: 'Esdalik sovg\'a', definition: 'A thing that is kept as a reminder of a person, place, or event.', example: 'I bought this mug as a souvenir of London.' },
      { word: 'Visa', translation: 'Viza', definition: 'An endorsement on a passport indicating that the holder is allowed to enter.', example: 'You need a visa to enter the country.' },
      { word: 'Currency', translation: 'Valyuta', definition: 'A system of money in general use in a particular country.', example: 'The local currency is the Yen.' },
      { word: 'Jet lag', translation: 'Vaqt mintaqasi o\'zgarishi charchog\'i', definition: 'Extreme tiredness felt by a person after a long flight across time zones.', example: 'I am suffering from severe jet lag.' }
    ]
  },
  {
    id: 'work',
    title: 'Ish va Biznes (Work)',
    desc: 'Kasb-hunar, ofis suhbatlari va ishga oid shartnomalar.',
    icon: Briefcase,
    color: 'text-amber-500',
    words: [
      { word: 'Colleague', translation: 'Hamkasb', definition: 'A person with whom one works in a profession or business.', example: 'He is a former colleague of mine.' },
      { word: 'Deadline', translation: 'Tugatish muddati (Dedlayn)', definition: 'The latest time or date by which something should be completed.', example: 'I have a strict deadline to meet by Friday.' },
      { word: 'Revenue', translation: 'Daromad (Tushum)', definition: 'Income, especially when of a company or organization.', example: 'The company\'s revenue increased by 20% this year.' },
      { word: 'Negotiate', translation: 'Muzokara olib bormoq', definition: 'Try to reach an agreement or compromise by discussion.', example: 'They are willing to negotiate on the price.' },
      { word: 'Promotion', translation: 'Lavozim ko\'tarilishi', definition: 'The action of promoting someone to a higher position.', example: 'She worked hard and got a promotion.' },
      { word: 'Resign', translation: 'Iste\'foga chiqmoq', definition: 'Voluntarily leave a job or other position.', example: 'He was forced to resign due to ill health.' },
      { word: 'Salary', translation: 'Oylik maosh', definition: 'A fixed regular payment made by an employer to an employee.', example: 'He receives a generous salary.' },
      { word: 'Meeting', translation: 'Majlis / Uchrashuv', definition: 'An assembly of people for a particular purpose.', example: 'We have a staff meeting at 10 AM.' },
      { word: 'Candidate', translation: 'Nomzod', definition: 'A person who applies for a job or is nominated for election.', example: 'We are interviewing three candidates today.' },
      { word: 'Interview', translation: 'Suhbat (Ishga kirish)', definition: 'A formal meeting in which one or more persons question, consult, or evaluate another person.', example: 'I have a job interview tomorrow.' },
      { word: 'Resume', translation: 'Rezyume', definition: 'A brief account of a person\'s education, qualifications, and previous experience.', example: 'Please send your resume to HR.' },
      { word: 'Contract', translation: 'Shartnoma', definition: 'A written or spoken agreement.', example: 'Do not sign the contract until you read it.' },
      { word: 'Employ', translation: 'Ishga yolash', definition: 'Give work to (someone) and pay them for it.', example: 'The factory employs over 500 people.' },
      { word: 'Fired', translation: 'Ishdan bo\'shatilgan', definition: 'Dismissed from a job.', example: 'He got fired for being late every day.' },
      { word: 'Entrepreneur', translation: 'Iztopar (Tadbirkor)', definition: 'A person who organizes and operates a business or businesses.', example: 'She is a successful tech entrepreneur.' },
      { word: 'Profit', translation: 'Foyda', definition: 'A financial gain.', example: 'The business made a huge profit this year.' },
      { word: 'Loss', translation: 'Zarar', definition: 'An amount of money lost by a business or organization.', example: 'The company reported a severe loss.' },
      { word: 'Retire', translation: 'Nafaqaga chiqmoq', definition: 'Leave one\'s job and cease to work, typically upon reaching the normal age.', example: 'My grandfather will retire next year.' },
      { word: 'Overtime', translation: 'Qo\'shimcha ish vaqti', definition: 'Time worked in addition to one\'s normal working hours.', example: 'They are doing a lot of overtime to meet the deadline.' },
      { word: 'Shift', translation: 'Smena', definition: 'One of two or more recurring periods in which different groups of workers do the same jobs in relay.', example: 'I work the night shift.' }
    ]
  },
  {
    id: 'health',
    title: 'Salomatlik (Health)',
    desc: 'Tibbiyot, kasallik alomatlari va sog\'lom turmush tarzi.',
    icon: HeartPulse,
    color: 'text-red-500',
    words: [
      { word: 'Symptom', translation: 'Alomat', definition: 'A physical or mental feature which is regarded as indicating a condition of disease.', example: 'Fever is a common symptom of the flu.' },
      { word: 'Prescription', translation: 'Retsept (Doriga ruxsatnoma)', definition: 'An instruction written by a medical practitioner that authorizes a patient to be provided with a medicine.', example: 'The doctor wrote a prescription for antibiotics.' },
      { word: 'Remedy', translation: 'Dori / Chora', definition: 'A medicine or treatment for a disease or injury.', example: 'Herbal tea is a good remedy for a sore throat.' },
      { word: 'Fatigue', translation: 'Horg\'inlik (Charchoq)', definition: 'Extreme tiredness resulting from mental or physical exertion or illness.', example: 'He was suffering from muscle fatigue.' },
      { word: 'Ache', translation: 'Og\'riq', definition: 'A continuous or prolonged dull pain in a part of one\'s body.', example: 'I have a terrible head ache.' },
      { word: 'Swollen', translation: 'Shishgan', definition: 'Become larger or rounder in size.', example: 'Her ankle was badly swollen after the fall.' },
      { word: 'Dizzy', translation: 'Boshi aylanayotgan', definition: 'Having or involving a sensation of spinning around and losing one\'s balance.', example: 'I feel a bit dizzy.' },
      { word: 'Nausea', translation: 'Ko\'ngil aynishi', definition: 'A feeling of sickness with an inclination to vomit.', example: 'The medicine caused severe nausea.' },
      { word: 'Pulse', translation: 'Puls', definition: 'A rhythmical throbbing of the arteries as blood is propelled through them.', example: 'The doctor checked her pulse.' },
      { word: 'Surgery', translation: 'Jarrohlik amaliyoti', definition: 'The medical treatment of bodily injuries or diseases by incision or manipulation.', example: 'He needs urgent heart surgery.' },
      { word: 'Recovery', translation: 'Sog\'ayish', definition: 'A return to a normal state of health, mind, or strength.', example: 'She made a full recovery.' },
      { word: 'Vaccine', translation: 'Vaksina', definition: 'A substance used to stimulate the production of antibodies.', example: 'They are developing a new vaccine.' },
      { word: 'Contagious', translation: 'Yuqumli', definition: 'Spread from one person or organism to another by direct or indirect contact.', example: 'The flu is highly contagious.' },
      { word: 'Immunity', translation: 'Immunitet', definition: 'The ability of an organism to resist a particular infection.', example: 'Vitamins help build immunity.' },
      { word: 'Scar', translation: 'Chandiq', definition: 'A mark left on the skin or within body tissue where a wound, burn, or sore has not healed completely.', example: 'The accident left a deep scar.' },
      { word: 'Allergy', translation: 'Allergiya', definition: 'A damaging immune response by the body to a substance.', example: 'He has a severe nut allergy.' },
      { word: 'Bleed', translation: 'Qonamoq', definition: 'Lose blood from the body as a result of injury or illness.', example: 'His nose started to bleed.' },
      { word: 'Bruise', translation: 'Ko\'kargan joy', definition: 'An injury appearing as an area of discolored skin.', example: 'She had a nasty bruise on her leg.' },
      { word: 'Infection', translation: 'Infeksiya', definition: 'The process of infecting or the state of being infected.', example: 'Wash the wound to prevent infection.' },
      { word: 'Therapy', translation: 'Terapiya (Davolash)', definition: 'Treatment intended to relieve or heal a disorder.', example: 'Physical therapy helped him walk again.' }
    ]
  },
  {
    id: 'tech',
    title: 'Texnologiya (Technology)',
    desc: 'Kompyuterlar, internet va raqamli innovatsiyalar.',
    icon: Laptop,
    color: 'text-cyan-500',
    words: [
      { word: 'Algorithm', translation: 'Algoritm', definition: 'A process or set of rules to be followed in calculations or other problem-solving operations.', example: 'The new algorithm improves search results significantly.' },
      { word: 'Bandwidth', translation: 'O\'tkazish qobiliyati / Imkoniyat', definition: 'The energy or mental capacity required to deal with a situation.', example: 'I don\'t have the bandwidth to take on another project right now.' },
      { word: 'Glitch', translation: 'Kichik xatolik (Texnik)', definition: 'A sudden, usually temporary malfunction or fault of equipment.', example: 'A software glitch caused the system to crash briefly.' },
      { word: 'Innovation', translation: 'Yangilik (Innovatsiya)', definition: 'The action or process of innovating.', example: 'Technological innovation is changing the entire industry.' },
      { word: 'App', translation: 'Ilova (Applikatsiya)', definition: 'A self-contained program or piece of software.', example: 'I downloaded a new fitness app.' },
      { word: 'Cloud', translation: 'Bulutli xotira', definition: 'A network of remote servers hosted on the Internet and used to store, manage, and process data.', example: 'All my files are backed up in the cloud.' },
      { word: 'Browser', translation: 'Brauzer', definition: 'A computer program with a graphical user interface for displaying and navigating between web pages.', example: 'Which web browser do you use?' },
      { word: 'Database', translation: 'Ma\'lumotlar bazasi', definition: 'A structured set of data held in a computer.', example: 'The customer details are stored in a database.' },
      { word: 'Hardware', translation: 'Qurilma / Uskuna', definition: 'The machines, wiring, and other physical components of a computer.', example: 'New hardware is required to run this game.' },
      { word: 'Software', translation: 'Dasturiy ta\'minot', definition: 'The programs and other operating information used by a computer.', example: 'The software needs updating.' },
      { word: 'Network', translation: 'Tarmoq', definition: 'A number of interconnected computers, machines, or operations.', example: 'The office network is down.' },
      { word: 'Server', translation: 'Server', definition: 'A computer or computer program which manages access to a centralized resource or service in a network.', example: 'The website crashed because the server failed.' },
      { word: 'Update', translation: 'Yangilash', definition: 'Make (something) more modern or up to date.', example: 'Please update the app to the latest version.' },
      { word: 'Download', translation: 'Yuklab olmoq', definition: 'Copy (data) from one computer system to another, typically over the Internet.', example: 'You can download the book for free.' },
      { word: 'Upload', translation: 'Yuklamoq', definition: 'Transfer (data) from one computer to another, typically to one that is larger or remote.', example: 'Upload your video to YouTube.' },
      { word: 'Cybersecurity', translation: 'Kiberxavfsizlik', definition: 'The state of being protected against the criminal or unauthorized use of electronic data.', example: 'Cybersecurity is a massive global issue.' },
      { word: 'Encryption', translation: 'Shifrlash', definition: 'The process of converting information or data into a code.', example: 'End-to-end encryption keeps your messages private.' },
      { word: 'Gadget', translation: 'Gadjet (Kichik qurilma)', definition: 'A small mechanical or electronic device or tool.', example: 'He loves buying new electronic gadgets.' },
      { word: 'Reboot', translation: 'Qayta ishga tushirish', definition: 'Restart (a computer) and reload the operating system.', example: 'Try to reboot your computer if it freezes.' },
      { word: 'Wireless', translation: 'Simsiz', definition: 'Using radio, microwaves, etc. to transmit signals.', example: 'We have a wireless connection in the entire building.' }
    ]
  }
];

const Dictionary = ({ onAddWord, userWords }) => {
  const [activeTopic, setActiveTopic] = useState(null);
  const [addingState, setAddingState] = useState({});

  // Get a set of already added words for fast lookup
  const userWordMap = new Set(userWords.map(w => w.word.toLowerCase()));

  const handleSaveToLab = async (wordData) => {
    setAddingState(prev => ({ ...prev, [wordData.word]: 'loading' }));
    
    // We package the exact data from dictionary to bypass AI and prepopulate translation
    const manualData = {
        manualDefinition: wordData.definition,
        manualExample: wordData.example,
        manualTranslation: wordData.translation
    };

    try {
        await onAddWord(wordData.word, true, manualData);
        setAddingState(prev => ({ ...prev, [wordData.word]: 'success' }));
        
        setTimeout(() => {
             setAddingState(prev => ({ ...prev, [wordData.word]: null }));
        }, 2000);
    } catch (err) {
        console.error("Failed to add dictionary word:", err);
        setAddingState(prev => ({ ...prev, [wordData.word]: 'error' }));
    }
  };

  // View 1: Topics Grid
  if (!activeTopic) {
    return (
        <div className="max-w-7xl mx-auto animate-fade-in-up">
            <div className="mb-12 text-center">
                <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent mb-4">
                Pocket Dictionary
                </h2>
                <p className="text-muted-foreground text-lg">Choose a topic to explore carefully curated English vocabulary.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dictionaryData.map(topic => (
                    <div 
                        key={topic.id} 
                        onClick={() => setActiveTopic(topic)}
                        className="bg-card rounded-3xl p-6 border border-border shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-primary/50 transition-all cursor-pointer group"
                    >
                        <div className={`w-14 h-14 rounded-2xl bg-background border border-border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${topic.color}`}>
                            <topic.icon className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-card-foreground mb-2">
                            {topic.title}
                        </h3>
                        <p className="text-muted-foreground text-sm mb-4">
                            {topic.desc}
                        </p>
                        <div className="flex items-center text-primary text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                            View {topic.words.length} words &rarr;
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  }

  // View 2: Words List for Active Topic
  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
        <Button 
            variant="ghost" 
            onClick={() => setActiveTopic(null)}
            className="mb-8 text-muted-foreground hover:text-foreground"
        >
            <ChevronLeft className="w-4 h-4 mr-2" /> Back to Topics
        </Button>

        <div className="bg-card rounded-3xl p-8 border border-border shadow-lg mb-8 flex items-center gap-6">
            <div className={`w-20 h-20 rounded-3xl bg-background border border-border flex items-center justify-center ${activeTopic.color}`}>
                 <activeTopic.icon className="w-10 h-10" />
            </div>
            <div>
                 <h2 className="text-3xl md:text-4xl font-bold text-card-foreground mb-2">
                    {activeTopic.title}
                </h2>
                <p className="text-muted-foreground">
                    {activeTopic.words.length} ta zarur so'zlar ro'yxati
                </p>
            </div>
        </div>

        <div className="space-y-4">
            {activeTopic.words.map((item, idx) => {
                const isAdded = userWordMap.has(item.word.toLowerCase());
                const status = addingState[item.word];

                return (
                    <div key={idx} className="group bg-background border border-border rounded-2xl p-5 flex flex-col md:flex-row md:items-start justify-between gap-6 transition-all hover:border-primary/50 hover:shadow-md">
                        <div className="flex-1">
                            <div className="flex flex-col mb-3">
                                <h4 className="text-2xl font-black text-card-foreground mb-1">{item.word}</h4>
                                <p className="text-sm font-medium text-primary italic lowercase">
                                    uz: {item.translation}
                                </p>
                            </div>
                            <p className="text-muted-foreground mb-3">{item.definition}</p>
                            <div className="italic text-muted-foreground/70 text-sm border-l-2 border-border pl-3">
                                "{item.example}"
                            </div>
                        </div>
                        
                        <div className="md:self-center shrink-0 w-full md:w-auto">
                            <Button 
                                variant={isAdded || status === 'success' ? "secondary" : "default"}
                                size="lg"
                                disabled={isAdded || status === 'loading' || status === 'success'}
                                onClick={() => handleSaveToLab(item)}
                                className={`w-full md:w-auto font-medium transition-all ${
                                    isAdded || status === 'success' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/10 opacity-100 border-green-500/20' : ''
                                }`}
                            >
                                {status === 'loading' && <span className="animate-pulse">Saqlanmoqda...</span>}
                                {(isAdded || status === 'success') && <><CheckCircle2 className="w-5 h-5 mr-2" /> Saqlangan</>}
                                {!isAdded && status !== 'success' && status !== 'loading' && <><Plus className="w-5 h-5 mr-2" /> Add to Flow</>}
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default Dictionary;
