import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/fitness/auth";
import {
  BLOOD_TEST_CATEGORIES,
  TOTAL_BLOOD_TESTS,
} from "@/lib/fitness/blood-tests";

/**
 * GET /api/blood-test/form
 *
 * فرم قابل پرینت / ذخیره به‌عنوان PDF برای آزمایش خون فیتاپ.
 *
 * این مسیر یک صفحه HTML ساده (با CSS inline) برمی‌گرداند که شامل:
 *   - لوگوی فیتاپ
 *   - نام و موبایل کاربر
 *   - تاریخ صدور
 *   - لیست آزمایش‌ها (CBC، Lipid Panel، Liver، Kidney، Thyroid، Hormones و ...)
 *   - دکمه پرینت
 *
 * کاربر می‌تواند این صفحه را پرینت بگیرد یا از طریق مرورگر به‌عنوان PDF ذخیره کند
 * و به آزمایشگاه ببرد.
 *
 * توجه: این مسیر نیاز به احراز هویت دارد تا اطلاعات کاربر در فرم درج شود.
 */
export async function GET(_req: NextRequest) {
  let userName = "";
  let userMobile = "";

  try {
    const user = await requireAuth();
    userName = user.name ?? "";
    userMobile = user.mobile ?? "";
  } catch {
    // اگر کاربر لاگین نکرده، فرم خالی برمی‌گردد (بدون اطلاعات کاربر)
    // این اجازه می‌دهد فرم به‌صورت عمومی هم در دسترس باشد
  }

  const today = new Date().toLocaleDateString("fa-IR");

  // نام و موبایل کاربر وارد HTML می‌شوند — escape الزامی است تا کاراکترهای
  // < > & " ' نتوانند ساختار صفحه را بشکنند یا اسکریپت تزریق کنند (self-XSS)
  const safeUserName = escapeHtml(userName);
  const safeUserMobile = escapeHtml(userMobile);

  // ساخت HTML جدول آزمایش‌ها
  const testsHtml = BLOOD_TEST_CATEGORIES.map((cat) => {
    const rows = cat.tests
      .map(
        (t, i) => `
      <tr>
        <td class="num">${toPersian(i + 1)}</td>
        <td class="name">
          ${t.name}
          <span class="en">${t.enName}</span>
        </td>
        <td class="ref">${t.refRange || "—"}</td>
        <td class="desc">${t.desc || "—"}</td>
      </tr>`
      )
      .join("");

    return `
      <div class="category">
        <div class="cat-header">
          <span class="cat-icon">${cat.icon}</span>
          <span class="cat-name">${cat.name}</span>
          <span class="cat-count">${toPersian(cat.tests.length)} آزمایش</span>
        </div>
        <table>
          <thead>
            <tr>
              <th class="num">#</th>
              <th class="name">نام آزمایش</th>
              <th class="ref">محدوده نرمال</th>
              <th class="desc">توضیحات</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>فرم درخواست آزمایش خون فیتاپ</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Vazirmatn, Tahoma, Arial, system-ui, sans-serif;
      padding: 24px;
      background: #f8fafc;
      color: #1e293b;
      line-height: 1.6;
    }
    .page {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #f59e0b;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-box {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .logo-box img { width: 100%; height: 100%; object-fit: cover; }
    .brand h1 { font-size: 26px; font-weight: 900; color: #1e293b; }
    .brand .subtitle { font-size: 13px; color: #64748b; }
    .date-box { text-align: left; }
    .date-box .label { font-size: 11px; color: #64748b; }
    .date-box .value { font-size: 15px; font-weight: 700; color: #1e293b; }

    .user-info {
      display: flex;
      gap: 12px;
      background: linear-gradient(135deg, #fff7ed, #ffedd5);
      border: 1px solid #fed7aa;
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 18px;
    }
    .user-info .field { flex: 1; }
    .user-info .field-label {
      font-size: 10px;
      color: #9a3412;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .user-info .field-value {
      font-size: 14px;
      color: #1e293b;
      font-weight: 700;
      min-height: 18px;
      border-bottom: 1px dashed #fdba74;
      padding-bottom: 2px;
    }

    .intro {
      background: linear-gradient(135deg, #fff7ed, #ffedd5);
      border: 1px solid #fed7aa;
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    .intro .intro-title {
      font-size: 12px;
      color: #ea580c;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .intro .intro-body { font-size: 12px; color: #1e293b; }

    .category { margin-bottom: 16px; }
    .cat-header {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 10px 10px 0 0;
      padding: 8px 12px;
      font-weight: 800;
      font-size: 13px;
      color: #9a3412;
    }
    .cat-icon { font-size: 16px; }
    .cat-count {
      margin-right: auto;
      font-size: 11px;
      font-weight: 600;
      color: #c2410c;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      border: 1px solid #fed7aa;
      border-top: none;
    }
    thead tr { background: #fffbeb; }
    th {
      padding: 6px 8px;
      text-align: right;
      border-bottom: 1px solid #fef3c7;
      color: #9a3412;
      font-weight: 700;
    }
    td {
      padding: 6px 8px;
      text-align: right;
      border-bottom: 1px solid #fef3c7;
    }
    tbody tr:last-child td { border-bottom: none; }
    td.num { color: #9a3412; font-weight: 700; width: 28px; }
    td.name { font-weight: 700; color: #1e293b; }
    td.name .en {
      display: block;
      font-size: 9px;
      color: #94a3b8;
      font-weight: 400;
    }
    td.ref { color: #64748b; font-size: 10px; }
    td.desc { color: #64748b; font-size: 10px; }

    .notes {
      background: #fff7ed;
      border: 1px dashed #fdba74;
      border-radius: 12px;
      padding: 12px 16px;
      margin-top: 12px;
    }
    .notes .notes-title {
      font-size: 12px;
      color: #ea580c;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .notes .notes-body { font-size: 12px; color: #1e293b; line-height: 1.7; }

    .footer {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 2px solid #fed7aa;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
    }

    .actions {
      position: sticky;
      top: 0;
      background: #ffffff;
      padding: 12px 0;
      margin-bottom: 16px;
      border-bottom: 1px solid #fed7aa;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      z-index: 10;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 10px;
      border: none;
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-primary {
      background: linear-gradient(135deg, #f59e0b, #f97316);
      color: #ffffff;
    }
    .btn-secondary {
      background: #ffffff;
      color: #ea580c;
      border: 1px solid #fed7aa;
    }

    @media print {
      body { padding: 0; background: #ffffff; }
      .page { box-shadow: none; border-radius: 0; padding: 16px; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="actions">
      <button class="btn btn-secondary" onclick="window.close()">بستن</button>
      <!-- چاپ — در اپ کافه‌بازار window.print() در WebView کار نمی‌کند؛ پل native -->
      <button class="btn btn-primary" onclick="fitupPrint()">چاپ / ذخیره PDF</button>
    </div>

    <div class="header">
      <div class="brand">
        <div class="logo-box">
          <img src="/fitup-logo.png" alt="فیتاپ" />
        </div>
        <div>
          <h1>فیتاپ</h1>
          <div class="subtitle">فرم درخواست آزمایش خون</div>
        </div>
      </div>
      <div class="date-box">
        <div class="label">تاریخ صدور</div>
        <div class="value">${today}</div>
      </div>
    </div>

    <div class="user-info">
      <div class="field">
        <div class="field-label">نام و نام خانوادگی</div>
        <div class="field-value">${safeUserName || "—"}</div>
      </div>
      <div class="field">
        <div class="field-label">موبایل</div>
        <div class="field-value" dir="ltr">${safeUserMobile || "—"}</div>
      </div>
    </div>

    <div class="intro">
      <div class="intro-title">🩸 موارد آزمایش (${toPersian(TOTAL_BLOOD_TESTS)} نشانگر در ${toPersian(BLOOD_TEST_CATEGORIES.length)} دسته)</div>
      <div class="intro-body">
        این آزمایش‌ها برای طراحی برنامه بهینه ورزشی و تغذیه‌ای ضروری هستند. لطفاً با مراجعه به آزمایشگاه، نتایج را پس از انجام به پلتفرم فیتاپ آپلود کنید.
      </div>
    </div>

    ${testsHtml}

    <div class="notes">
      <div class="notes-title">📝 نکات مهم</div>
      <div class="notes-body">
        حداقل ۱۲ ساعت قبل از آزمایش ناشتا باشید. داروهای مصرفی را پیش از آزمایش با پزشک مشورت کنید. نتایج آزمایش را پس از انجام، از بخش «آزمایش خون» در پنل کاربری فیتاپ آپلود کنید تا هوش مصنوعی تحلیل کرده و با برنامه شما تطبیق دهد.
      </div>
    </div>

    <div class="footer">
      <span>هر بدنی فیتاپ میخواد 💪</span>
      <span>fitap.ir</span>
    </div>
  </div>
<script>
  // چاپ در اپ کافه‌بازار از پل native (PrintManager اندروید) — در مرورگر استاندارد
  function fitupPrint() {
    try {
      if (window.FitUpNative && window.FitUpNative.isBazaarApp && window.FitUpNative.isBazaarApp() && window.FitUpNative.printPage) {
        window.FitUpNative.printPage();
        return;
      }
    } catch (e) {}
    window.print();
  }
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

/** تبدیل اعداد انگلیسی به فارسی */
function toPersian(n: number | string): string {
  const fa = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n).replace(/\d/g, (d) => fa[+d]);
}

/** escape کردن کاراکترهای خاص HTML برای درج امن مقادیر کاربر در قالب */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
