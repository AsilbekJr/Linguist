/**
 * Pochta yuborish.
 *
 * Ataylab dependency'siz: Resend/Brevo HTTP API'si oddiy `fetch` bilan
 * ishlaydi va SMTP sozlashning ovorasi yo'q. Render'da ham muammosiz.
 *
 * Sozlanmagan bo'lsa (masalan lokal ishlab chiqishda) xat konsolga chiqadi
 * va oqim to'xtamaydi — dasturchi havolani terminaldan olib sinab ko'radi.
 */

const PROVIDER = (process.env.MAIL_PROVIDER || '').toLowerCase();
const FROM = process.env.MAIL_FROM || 'Linguist AI <onboarding@resend.dev>';

const isConfigured = () =>
  (PROVIDER === 'resend' && Boolean(process.env.RESEND_API_KEY)) ||
  (PROVIDER === 'brevo' && Boolean(process.env.BREVO_API_KEY));

const sendViaResend = async ({ to, subject, html, text }) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
};

const sendViaBrevo = async ({ to, subject, html, text }) => {
  const [, fromEmail] = FROM.match(/<(.+)>/) || [null, FROM];
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: 'Linguist AI' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
};

/**
 * @returns {Promise<{delivered: boolean}>}
 * Xato tashlamaydi — pochta uzilishi foydalanuvchi oqimini to'xtatmasligi kerak.
 */
const sendMail = async ({ to, subject, html, text }) => {
  if (!isConfigured()) {
    console.log('\n─── POCHTA (yuborilmadi — MAIL_PROVIDER sozlanmagan) ───');
    console.log(`Kimga: ${to}`);
    console.log(`Mavzu: ${subject}`);
    console.log(text || html);
    console.log('────────────────────────────────────────────────────────\n');
    return { delivered: false };
  }

  try {
    if (PROVIDER === 'resend') await sendViaResend({ to, subject, html, text });
    else await sendViaBrevo({ to, subject, html, text });
    return { delivered: true };
  } catch (error) {
    console.error('Pochta yuborishda xato:', error.message);
    return { delivered: false };
  }
};

const passwordResetEmail = (name, resetUrl) => ({
  subject: 'Linguist AI — parolni tiklash',
  text: `Salom, ${name}!

Parolingizni tiklash uchun quyidagi havolaga o'ting:
${resetUrl}

Havola 1 soat davomida amal qiladi.
Agar bu so'rovni siz yubormagan bo'lsangiz, bu xatni e'tiborsiz qoldiring — parolingiz o'zgarmaydi.`,
  html: `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">Parolni tiklash</h2>
      <p>Salom, <strong>${name}</strong>!</p>
      <p>Parolingizni tiklash uchun quyidagi tugmani bosing:</p>
      <p style="margin:28px 0">
        <a href="${resetUrl}"
           style="background:#6d28d9;color:#fff;padding:12px 24px;border-radius:999px;
                  text-decoration:none;font-weight:700;display:inline-block">
          Parolni tiklash
        </a>
      </p>
      <p style="color:#666;font-size:14px">Havola <strong>1 soat</strong> davomida amal qiladi.</p>
      <p style="color:#666;font-size:14px">
        Agar bu so'rovni siz yubormagan bo'lsangiz, bu xatni e'tiborsiz qoldiring —
        parolingiz o'zgarmaydi.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
      <p style="color:#999;font-size:12px">Havola ochilmasa, uni brauzerga nusxalang:<br>${resetUrl}</p>
    </div>
  `,
});

module.exports = { sendMail, isConfigured, passwordResetEmail };
