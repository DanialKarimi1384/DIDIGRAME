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

## مرحله ۶: آپلود به ریپوی گیت‌هابت

داخل همین پوشه:

```bash
git init
git remote add origin <آدرس ریپوی خودت روی گیت‌هاب>
git add .
git commit -m "اولین نسخه پیام‌رسان"
git branch -M main
git push -u origin main
```

اگه ریپو رو از قبل با فایلی مثل README ساخته بودی و push ارور داد، اول این رو بزن: `git pull origin main --allow-unrelated-histories` بعد دوباره push کن.

---

## آپدیت خودکار (CI/CD) — دیگه لازم نیست دستی `wrangler deploy` بزنی

توی پروژه یک فایل `.github/workflows/deploy.yml` گذاشته شده. با این تنظیم، از این به بعد **هر بار که تغییری بدی و به شاخه `main` روی گیت‌هاب push کنی، برنامه‌ی روی Cloudflare خودش آپدیت می‌شه** — بدون هیچ کار دستی‌ای.

برای فعال کردنش فقط یک‌بار باید دو تا "Secret" به تنظیمات ریپو اضافه کنی:

1. برو به Cloudflare Dashboard > **My Profile > API Tokens** > **Create Token**. از قالب **"Edit Cloudflare Workers"** استفاده کن (دسترسی به Workers, D1, و Durable Objects لازمه). توکن رو کپی کن.
2. **Account ID** خودت رو از داشبورد کلودفلر (سمت راست صفحه‌ی Workers & Pages) کپی کن.
3. توی ریپوی گیت‌هابت برو به: **Settings > Secrets and variables > Actions > New repository secret** و این دو تا رو اضافه کن:
   - `CLOUDFLARE_API_TOKEN` → همون توکنی که ساختی
   - `CLOUDFLARE_ACCOUNT_ID` → همون Account ID

بعد از این تنظیم، هر تغییری که بدی و push کنی، به‌صورت خودکار:
- migration های جدید دیتابیس رو اجرا می‌کنه
- برنامه رو دوباره دیپلوی می‌کنه

می‌تونی وضعیت هر دیپلوی رو توی تب **Actions** ریپوی گیت‌هابت ببینی.

⚠️ اگه در آینده تغییری توی `schema.sql` دادی (مثلاً یک ستون جدید اضافه کردی)، بهتره دستورهای migration رو با `ALTER TABLE` بنویسی نه اینکه کل جدول رو دوباره بسازی، چون `wrangler d1 execute --file` اجرای مجدد `CREATE TABLE IF NOT EXISTS` روی جدول موجود مشکلی ایجاد نمی‌کنه ولی داده‌های قبلی رو پاک نمی‌کنه.

---

## نکات مهم

- **دامنه اختصاصی:** اگر دوست داری روی دامنه‌ی خودت باشه (مثلا `chat.example.com`)، از داشبورد Cloudflare > Workers & Pages > پروژه‌ات > Settings > Domains & Routes اضافه‌اش کن.
- **پاک کردن دیتابیس:** اگر لازم شد از اول شروع کنی: `npx wrangler d1 execute messenger-db --remote --command "DELETE FROM messages; DELETE FROM chat_members; DELETE FROM chats; DELETE FROM sessions; DELETE FROM users;"`
- **هزینه:** پلن رایگان Cloudflare Workers شامل ۱۰۰هزار درخواست در روز، دیتابیس D1 رایگان تا ۵ گیگابایت، و Durable Objects با پلن رایگان محدود است (برای شروع و تعداد کاربر کم کاملاً کافیه). اگر برنامه بزرگ شد ممکنه نیاز به فعال‌سازی پلن Workers Paid ($5/ماه) برای Durable Objects داشته باشی.
- **امنیت رمزها:** رمزهای عبور با PBKDF2 (۱۰۰,۰۰۰ تکرار SHA-256) هش می‌شن و هیچ‌جا به‌صورت متن ساده ذخیره نمی‌شن.

---

## چیزهایی که فعلاً در این نسخه نیست (پیشنهاد برای توسعه بعدی)

- ✋ آواتار واقعی (الان فقط حرف اول اسم نمایش داده می‌شه)
- ✋ وضعیت آنلاین/آفلاین و "در حال تایپ..."
- ✋ ارسال عکس/فایل
- ✋ نوتیفیکیشن push وقتی برنامه بسته‌ست
- ✋ ادمین گروه (حذف عضو، تغییر نام گروه بعد از ساخت)
- ✋ رمزنگاری end-to-end پیام‌ها (الان پیام‌ها روی سرور به‌صورت متن ساده در D1 ذخیره می‌شن، فقط بین کاربر و سرور با HTTPS/WSS امن هستن)
- ✋ ری‌کاوری رمز عبور فراموش‌شده (چون ایمیلی در کار نیست)

اگر هرکدوم از این‌ها رو خواستی اضافه کنم بگو تا برات پیاده‌سازی کنم.
