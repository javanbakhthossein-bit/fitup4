#!/bin/bash
set -e

echo "🚀 شروع دیپلوی..."
cd /var/www/fitup

# ۱. پشتیبان‌گیری از دیتابیس
echo "📦 پشتیبان‌گیری از دیتابیس..."
BACKUP_DIR="/var/www/fitup/backups"
mkdir -p $BACKUP_DIR
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
cp db/custom.db "$BACKUP_DIR/db_backup_$DATE.db" 2>/dev/null || echo "  (دیتابیس در دسترس نیست)"
ls -t $BACKUP_DIR/db_backup_*.db 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null
echo "  ✓ پشتیبان ذخیره شد"

# ۱-ب. پشتیبان‌گیری از تصاویر مقالات (محافظ در برابر حذف ناخواسته)
# مهم: بعضی عملیات دیپلوی (rm -rf .next / git clean / sync پوشه) می‌توانند
# فایل‌های تازه‌تولیدشده را حذف کنند. این پشتیبان + بازگردانی خودکار (قدم ۱۵)
# تضمین می‌کند هیچ عکسی در دیپلوی گم نشود.
if [ -d "uploads/articles" ]; then
  echo "🖼 پشتیبان‌گیری از تصاویر مقالات..."
  UPLOADS_COUNT_BEFORE=$(find uploads/articles -type f 2>/dev/null | wc -l)
  mkdir -p "$BACKUP_DIR/uploads_backup"
  rsync -a --delete uploads/articles/ "$BACKUP_DIR/uploads_backup/" 2>/dev/null \
    || cp -rn uploads/articles/* "$BACKUP_DIR/uploads_backup/" 2>/dev/null || true
  echo "  ✓ $UPLOADS_COUNT_BEFORE فایل پشتیبان شد"
else
  UPLOADS_COUNT_BEFORE=0
  echo "  (پوشه uploads/articles موجود نیست)"
fi

# ۲. نصب وابستگی‌ها
echo "📦 نصب وابستگی‌ها..."
bun install

# ۲-ب. نصب ffmpeg — لازم برای تحلیل ویدیو در چت و آنالیز ویدیویی
# (استخراج فریم‌های ویدیو با ffmpeg انجام می‌شود؛ نبود آن باعث می‌شود مربی
#  هوشمند به کاربر «نمی‌توانم ویدیو را تحلیل کنم» بگوید!)
echo "🎬 بررسی ffmpeg..."
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  echo "  ✓ ffmpeg از قبل نصب است"
else
  echo "  ⚠ ffmpeg نصب نیست — در حال نصب..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq 2>/dev/null || true
    apt-get install -y -qq ffmpeg 2>/dev/null && echo "  ✓ ffmpeg نصب شد" || echo "  ✗ نصب ffmpeg ناموفق بود — تحلیل ویدیو کار نمی‌کند! دستی: apt-get install -y ffmpeg"
  else
    echo "  ✗ apt-get در دسترس نیست — ffmpeg را دستی نصب کنید (الزامی برای تحلیل ویدیو):"
    echo "     Ubuntu/Debian: apt-get install -y ffmpeg"
    echo "     CentOS/RHEL:   yum install -y ffmpeg (repo EPEL/RPMFusion)"
  fi
fi

# ۳. تولید Prisma client
echo "🔧 تولید Prisma client..."
bun run db:generate

# ۴. توقف اپلیکیشن — قبل از db:push تا schema روی SQLite قفل نشود
# (قبلاً db:push با اپ زنده اجرا می‌شد → ریسک SQLITE_BUSY/lock)
# 2>/dev/null || true — در اولین دیپلوی، فرآیند fitup هنوز در pm2 ثبت نشده
# و exit code غیرصفر نباید اسکریپت را با set -e قطع کند.
echo "⏹ توقف اپلیکیشن..."
pm2 stop fitup 2>/dev/null || true

# ۵. اعمال تغییرات schema
# ⚠️ بعد از توقف اپ — برای جلوگیری از تداخل قفل SQLite
# اگر db:push شکست بخورد صدای آن را پنهان نمی‌کنیم (باگ v9: پنهان‌شدن
# خطا باعث قطع لاگین روی سرور شد چون ستون lastActiveAt ساخته نشده بود)
echo "📊 اعمال تغییرات schema..."
if bun run db:push 2>&1; then
  echo "  ✓ schema اعمال شد"
else
  echo "  ⚠ db:push با خطا مواجه شد — ادامه می‌دهیم (جایگزین: خودترمیمی DB بعد از boot ستون‌های ضروری را اضافه می‌کند)"
fi

# ۶. انتقال رسانه‌های قدیمی از public/uploads (فقط یک‌بار — مهاجرت امن)
# مهم: رسانه‌های خصوصی کاربران (عکس بدن، چت، ویدیو، آزمایش خون و…) از
# نسخه‌های قدیمی در public/uploads بودند. این قدم همه دسته‌ها را به‌صورت
# امن به uploads/ منتقل می‌کند و فقط وقتی public/uploads را حذف می‌کند که
# هیچ فایل جامانده‌ای داخلش نباشد (بدون از دست رفتن حتی یک فایل کاربر).
if [ -d "public/uploads" ] && [ ! -L "public/uploads" ]; then
  echo "📁 مهاجرت رسانه‌های قدیمی از public/uploads به uploads/..."
  for category in articles body-analysis body-photos blood-tests chat meal-analysis progress videos; do
    if [ -d "public/uploads/$category" ]; then
      mkdir -p "uploads/$category"
      # -n: فایل موجود را بازنویسی نکن (نسخه جدیدتر در uploads برنده است)
      cp -rn "public/uploads/$category/." "uploads/$category/" 2>/dev/null || true
      echo "  ✓ $category منتقل شد ($(find "public/uploads/$category" -type f 2>/dev/null | wc -l) فایل)"
    fi
  done
  # زیرپوشه TTS چت (chat/tts)
  if [ -d "public/uploads/chat/tts" ]; then
    mkdir -p "uploads/chat/tts"
    cp -rn "public/uploads/chat/tts/." "uploads/chat/tts/" 2>/dev/null || true
  fi
  # فقط وقتی حذف کن که هیچ فایلی در هیچ زیرپوشه‌ای باقی نمانده باشد
  REMAINING=$(find public/uploads -type f 2>/dev/null | wc -l)
  if [ "$REMAINING" -eq 0 ]; then
    rm -rf public/uploads
    echo "  ✓ مهاجرت کامل شد و public/uploads حذف شد"
  else
    echo "  ⚠ $REMAINING فایل شناسایی‌نشده در public/uploads باقی مانده — پوشه حفظ شد (حذف نشد)"
  fi
fi

# ۶-ب. پاک‌سازی فایل‌های stale — کدهای قدیمی که در نسخه جدید حذف شده‌اند
# مهم: unzip فایل‌های حذف‌شده را پاک نمی‌کند! اگر کد قدیمی روی سرور بماند،
# next build هنگام TypeScript با خطای تایپ شکست می‌خورد (مثل smart-nav.ts).
# .deploy-manifest.txt فهرست دقیق فایل‌های این نسخه است؛ هر فایلی از
# src/prisma/scripts که در آن نباشد یعنی مال نسخه قبلی است و حذف می‌شود.
# (db/uploads/public دست نمی‌خورند — دیتای کاربر و رسانه‌ها مقدس‌اند.)
if [ -f ".deploy-manifest.txt" ]; then
  echo "🧹 پاک‌سازی فایل‌های قدیمی (stale)..."
  STALE_COUNT=0
  while IFS= read -r stale_file; do
    case "$stale_file" in
      src/*|prisma/*|scripts/*)
        if [ -f "$stale_file" ]; then
          rm -f "$stale_file"
          STALE_COUNT=$((STALE_COUNT + 1))
          echo "  🗑 حذف stale: $stale_file"
        fi
        ;;
    esac
  done < <(comm -23 <(find src prisma scripts -type f 2>/dev/null | sort) <(sort .deploy-manifest.txt))
  if [ "$STALE_COUNT" -eq 0 ]; then
    echo "  ✓ فایل stale ای وجود ندارد"
  else
    echo "  ✓ $STALE_COUNT فایل قدیمی حذف شد"
  fi
else
  echo "ℹ .deploy-manifest.txt موجود نیست — پاک‌سازی stale رد شد (امن است)"
fi

# ۶-ج. فایل‌های کد قدیمی در upload/ — از نسخه‌های خیلی قدیمی مانده‌اند
# (tsconfig جدید فقط src/scripts را تایپ‌چک می‌کند، ولی این فایل‌ها زباله‌اند و پاک می‌شوند.
#  فقط *.ts/*.tsx حذف می‌شود — دیتابیس یا فایل‌های دیگر upload/ دست نمی‌خورند.)
if [ -d "upload" ]; then
  STRAY_CODE=$(find upload -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | wc -l)
  if [ "$STRAY_CODE" -gt 0 ]; then
    find upload -type f \( -name "*.ts" -o -name "*.tsx" \) -delete
    echo "  🗑 $STRAY_CODE فایل کد قدیمی از upload/ حذف شد (کپی stale از نسخه‌های قبلی)"
  else
    echo "  ✓ فایل کد قدیمی در upload/ نیست"
  fi
fi

# ۷. پاک کردن build قدیمی
echo "🗑 پاک کردن build قدیمی..."
rm -rf .next

# ۸. build جدید
echo "🔨 Build جدید..."
NODE_ENV=production bun run build

# ۹. کپی static و public
echo "📁 کپی static و public..."
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

# ۹-ب. حذف public/uploads از خروجی build (نه پوشه source)
# فایل‌های جامانده/ناشناخته در public/uploads نباید بدون auth سرو شوند —
# rewrite به /api/serve-upload فقط برای مسیرهایی اعمال می‌شود که فایل استاتیک
# نباشند؛ پس تنها راه اطمینان، حذف کامل این پوشه از build است.
# (مهاجرت امن مقادیر شناخته‌شده قبلاً در قدم ۶ انجام شده است.)
LEFTOVER_IN_BUILD=$(find .next/standalone/public/uploads -type f 2>/dev/null | wc -l)
if [ "$LEFTOVER_IN_BUILD" -gt 0 ]; then
  echo "  ⚠ $LEFTOVER_IN_BUILD فایل جامانده public/uploads از build حذف شد (سرو بدون auth ممنوع)"
fi
rm -rf .next/standalone/public/uploads

# ۱۰. کپی فایل‌های پیکربندی
echo "📁 کپی فایل‌های پیکربندی..."
cp .env .next/standalone/.env 2>/dev/null || echo "  (.env وجود ندارد)"
mkdir -p .next/standalone/db
cp db/custom.db .next/standalone/db/custom.db 2>/dev/null || echo "  (دیتابیس وجود ندارد)"
# حفظ کلید سشن بین دیپلوی‌ها — کاربران بعد از دیپلوی لاگین می‌مانند.
# (اگر SESSION_SECRET در .env باشد این فایل استفاده نمی‌شود؛ کپی صرفاً برای
#  حالت خودکار db/.session-secret است که کد auth.ts آن را تولید می‌کند.)
cp db/.session-secret .next/standalone/db/.session-secret 2>/dev/null || true
echo "  ✓ فایل‌های پیکربندی کپی شد"

# ۱۱. symlink برای uploads (عکس‌ها مستقل از build باقی می‌مانند)
echo "📁 ایجاد symlink برای uploads..."
rm -rf .next/standalone/uploads 2>/dev/null || true
ln -sfn /var/www/fitup/uploads .next/standalone/uploads
echo "  ✓ symlink ایجاد شد"

# ۱۲. اصلاح URL‌های عکس در دیتابیس
echo "🔧 اصلاح URL‌های عکس..."
bun run src/lib/fitness/fix-article-image-urls.ts 2>&1 | tail -3 || echo "  (skip)"

# ۱۲-ب. بازگرداندن inline images گم شده
echo "🔄 بازگرداندن inline images گم شده..."
bun run src/lib/fitness/restore-missing-inlines.ts 2>&1 | tail -3 || echo "  (skip)"

# ۱۲-ج. به‌روزرسانی سال‌های مقالات (2024/1403 → 2026/1405)
echo "📅 به‌روزرسانی سال‌های مقالات..."
bun run src/lib/fitness/update-article-years.ts 2>&1 | tail -3 || echo "  (skip)"

# ۱۳. ری‌استارت اپلیکیشن
# 2>/dev/null || true — اگر فرآیند fitup در pm2 ثبت نشده باشد (اولین دیپلوی)،
# اسکریپت نباید اینجا قطع شود؛ health check پایانی وضعیت را مشخص می‌کند.
echo "▶ ری‌استارت اپلیکیشن..."
pm2 restart fitup 2>/dev/null || echo "  ⚠ فرآیند fitup در pm2 موجود نیست — با pm2 start/ecosystem راه‌اندازی کنید"

# ۱۴. ذخیره تنظیمات pm2
echo "💾 ذخیره تنظیمات pm2..."
pm2 save

# ۱۵. تست — بررسی واقعی کد HTTP (قبلاً فقط چاپ می‌شد و خطا نادیده گرفته می‌شد)
echo "🔍 تست سلامت اپلیکیشن..."
sleep 3
HTTP_CODE=000
for i in 1 2 3 4 5; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
  if [ "$HTTP_CODE" = "200" ]; then
    break
  fi
  echo "  تلاش $i: HTTP $HTTP_CODE — ۵ ثانیه صبر و تلاش مجدد..."
  sleep 5
done
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ دیپلوی ناموفق: اپلیکیشن با کد HTTP $HTTP_CODE پاسخ داد (انتظار ۲۰۰)"
  echo "  آخرین خطاهای pm2:"
  pm2 logs fitup --err --lines 20 --nostream 2>/dev/null || true
  exit 1
fi
echo "  ✓ HTTP Status: $HTTP_CODE"

# ۱۵.۵. بررسی سلامت sitemap — باید ۱۳۰۰+ URL داشته باشد نه فقط ۷ صفحات ثابت
# (باگ پروداکشن: یک خطای DB → sitemap فقط صفحات ثابت برمی‌گرداند. حالا sitemap
# خودترمیم‌شو per-section است؛ این چک صادقانه هشدار می‌دهد اگر باز هم بخشی شکست خورده باشد.)
echo "🗺 بررسی sitemap.xml..."
SITEMAP_URL_COUNT=$( (curl -s --max-time 90 http://localhost:3000/sitemap.xml || true) | (grep -o '<loc>' || true) | wc -l )
if [ "$SITEMAP_URL_COUNT" -lt 20 ]; then
  echo ""
  echo "Ⓦ SITEMAP PROBLEM: sitemap.xml فقط $SITEMAP_URL_COUNT URL دارد (انتظار: ۱۳۰۰+) — بخش‌های دیتابیس (مقالات/حرکات/غذاها) احتمالاً شکست خورده‌اند!"
  echo "   برای ریشه‌یابی، لاگ‌های pm2 را برای خطاهای [sitemap] بررسی کنید:"
  echo "     pm2 logs fitup --lines 100 --nostream 2>/dev/null | grep '\\[sitemap\\]'"
  echo "   (دیپلوی fail نمی‌شود — sitemap بعد از رفع مشکل DB با کش ۱ ساعته خودش ترمیم می‌شود)"
  echo ""
else
  echo "  ✓ sitemap.xml: $SITEMAP_URL_COUNT URL"
fi

# ۱۶. بازگردانی خودکار تصاویر اگر در دیپلوی گم شده‌اند
UPLOADS_COUNT_AFTER=$(find uploads/articles -type f 2>/dev/null | wc -l)
if [ "$UPLOADS_COUNT_BEFORE" -gt 0 ] && [ "$UPLOADS_COUNT_AFTER" -lt "$UPLOADS_COUNT_BEFORE" ]; then
  echo "⚠ تعداد فایل‌های تصاویر مقالات کاهش یافته ($UPLOADS_COUNT_BEFORE → $UPLOADS_COUNT_AFTER) — بازگردانی از پشتیبان..."
  mkdir -p uploads/articles
  cp -rn "$BACKUP_DIR/uploads_backup/"* uploads/articles/ 2>/dev/null || true
  UPLOADS_COUNT_RECOVERED=$(find uploads/articles -type f 2>/dev/null | wc -l)
  echo "  ✓ بازگردانی شد: $UPLOADS_COUNT_RECOVERED فایل"
fi
# نکته: سرویس خودترمیم رسانه (article-media-selfheal) هنگام boot سرور هم همه
# کاورها/inline های مفقود را به‌صورت خودکار ترمیم می‌کند (با کش آینه‌ای بدون هزینه).

echo ""
echo "🎉 دیپلوی کامل شد!"
echo "  - دیتابیس: $(ls -lh db/custom.db 2>/dev/null | awk '{print $5}')"
echo "  - پشتیبان‌ها: $(ls backups/*.db 2>/dev/null | wc -l) فایل"
echo "  - تصاویر مقالات: $(find uploads -type f 2>/dev/null | wc -l) فایل"
