# پیام‌رسان (Persian Messenger) — روی Cloudflare Workers

یک پیام‌رسان وب‌بیس شبیه تلگرام، با:
- ثبت‌نام/ورود با نام کاربری و رمز عبور (رمزها هش‌شده ذخیره می‌شوند)
- چت پرسنال (با جستجوی کاربر) و چت گروهی
- پیام‌رسانی آنی با WebSocket روی Cloudflare Durable Objects
- ذخیره‌سازی دائمی روی Cloudflare D1 (دیتابیس SQL رایگان)
- تم روشن / تیره

---

## پیش‌نیازها

1. **Node.js** نسخه ۱۸ به بالا — از [nodejs.org](https://nodejs.org) نصب کن.
2. یک **اکانت رایگان Cloudflare** — در [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) بساز.

---

## مرحله ۱: نصب ابزارها

داخل پوشه پروژه (همین پوشه‌ای که این فایل توشه) این دستور رو بزن:

```bash
npm install
```

این کار `wrangler` (ابزار خط‌فرمان کلودفلر) رو نصب می‌کنه.

سپس لاگین کن:

```bash
npx wrangler login
```

یک تب مرورگر باز می‌شه، اجازه بده به حساب کلودفلرت وصل بشه.

---

## مرحله ۲: ساخت دیتابیس D1

```bash
npx wrangler d1 create messenger-db
```

خروجی این دستور یک بلوک شبیه این می‌ده:

```
[[d1_databases]]
binding = "DB"
database_name = "messenger-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**آن `database_id` را کپی کن** و در فایل `wrangler.toml` جایگزین `REPLACE_WITH_YOUR_D1_DATABASE_ID` کن.

---

## مرحله ۳: ساخت جدول‌ها در دیتابیس

اول برای تست محلی:

```bash
npm run db:migrate:local
```

بعد برای نسخه‌ی واقعی (پروداکشن):

```bash
npm run db:migrate:remote
```

---

## مرحله ۴: تست محلی (اختیاری ولی پیشنهاد می‌شود)

```bash
npm run dev
```

آدرس `http://localhost:8787` رو در مرورگر باز کن و امتحان کن.

---

## مرحله ۵: دیپلوی نهایی

```bash
npm run deploy
```

بعد از چند ثانیه یک آدرس شبیه این می‌گیری:

```
https://persian-messenger.YOUR_SUBDOMAIN.workers.dev
```

همینه! برنامه‌ات الان لایو و در دسترسه. این آدرس رو باز کن، ثبت‌نام کن و شروع به چت کن.

---
.
