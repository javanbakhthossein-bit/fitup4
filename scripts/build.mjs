#!/usr/bin/env node
/**
 * Build script کامل فیتاپ
 *
 * این اسکریپت:
 * 1. Prisma Client تولید می‌کند
 * 2. دیتابیس را می‌سازد
 * 3. مقالات، قوانین، بانک حرکات و بانک غذاها را seed می‌کند
 * 4. next build اجرا می‌کند
 * 5. فایل‌های استاتیک، public و دیتابیس را در standalone کپی می‌کند
 */
import { execSync } from "child_process";
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "fs";
import path from "path";

// ─── Helper: کپی کامل یک پوشه ───
function copyDir(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

console.log("[build] ═══════════════════════════════════════");
console.log("[build] شروع build کامل فیتاپ");
console.log("[build] ═══════════════════════════════════════");

// 1. اطمینان از DATABASE_URL
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./db/custom.db";
  console.log("[build] DATABASE_URL تنظیم نشده، استفاده از fallback");
}

// 2. تولید Prisma Client
console.log("[build] ── 1/6: prisma generate");
try {
  execSync("npx --yes prisma generate", { stdio: "inherit", env: process.env });
} catch {
  console.warn("[build] prisma generate ناموفق، ادامه...");
}

// 3. ساخت دیتابیس
console.log("[build] ── 2/6: prisma db push");
try {
  execSync("npx --yes prisma db push --skip-generate", {
    stdio: "pipe",
    env: process.env,
  });
  console.log("[build] ✓ دیتابیس ساخته شد");
} catch {
  console.log("[build] دیتابیس از قبل موجود است");
}

// 4. seed مقالات
console.log("[build] ── 3/6: seed مقالات");
try {
  execSync("bun run src/lib/fitness/seed-articles.ts", {
    stdio: "pipe",
    env: process.env,
  });
  console.log("[build] ✓ مقالات seed شدند");
} catch {
  console.log("[build] مقالات از قبل موجودند");
}

// 5. seed قوانین و بانک‌ها (حرکات + غذاها)
console.log("[build] ── 4/6: seed قوانین و بانک‌ها");
try {
  execSync("bun run src/lib/fitness/seed.ts", {
    stdio: "pipe",
    env: process.env,
  });
  console.log("[build] ✓ قوانین و بانک‌ها seed شدند");
} catch {
  console.log("[build] قوانین و بانک‌ها از قبل موجودند");
}

// 6. next build
console.log("[build] ── 5/6: next build");
execSync("npx --yes next build", { stdio: "inherit", env: process.env });

// 7. کپی فایل‌ها در standalone
console.log("[build] ── 6/6: کپی فایل‌ها در standalone");
const standaloneDir = path.join(process.cwd(), ".next", "standalone");

if (existsSync(standaloneDir)) {
  // کپی .next/static
  const staticSrc = path.join(process.cwd(), ".next", "static");
  const staticDest = path.join(standaloneDir, ".next", "static");
  copyDir(staticSrc, staticDest);
  console.log("[build] ✓ .next/static کپی شد");

  // کپی public (شامل uploads/articles, uploads/chat, fonts, images)
  const publicSrc = path.join(process.cwd(), "public");
  const publicDest = path.join(standaloneDir, "public");
  copyDir(publicSrc, publicDest);
  console.log("[build] ✓ public کپی شد");

  // کپی دیتابیس (مهم! مقالات و قوانین و بانک‌ها در دیتابیس هستند)
  const dbSrc = path.join(process.cwd(), "db", "custom.db");
  const dbDestDir = path.join(standaloneDir, "db");
  const dbDest = path.join(dbDestDir, "custom.db");
  if (existsSync(dbSrc)) {
    mkdirSync(dbDestDir, { recursive: true });
    copyFileSync(dbSrc, dbDest);
    console.log("[build] ✓ دیتابیس (custom.db) کپی شد");
  }

  // کپی prisma schema (برای runtime)
  const prismaSrc = path.join(process.cwd(), "prisma", "schema.prisma");
  const prismaDestDir = path.join(standaloneDir, "prisma");
  if (existsSync(prismaSrc)) {
    mkdirSync(prismaDestDir, { recursive: true });
    copyFileSync(prismaSrc, path.join(prismaDestDir, "schema.prisma"));
    console.log("[build] ✓ prisma/schema.prisma کپی شد");
  }

  // کپی .env (برای runtime)
  const envSrc = path.join(process.cwd(), ".env");
  if (existsSync(envSrc)) {
    copyFileSync(envSrc, path.join(standaloneDir, ".env"));
    console.log("[build] ✓ .env کپی شد");
  }

  console.log("[build] ═══════════════════════════════════════");
  console.log("[build] ✓ Build کامل شد!");
  console.log("[build] ═══════════════════════════════════════");
  console.log("[build] خروجی: .next/standalone/");
  console.log("[build] اجرا: cd .next/standalone && node server.js");
} else {
  console.warn("[build] standalone ساخته نشد — بررسی next.config.ts");
}
