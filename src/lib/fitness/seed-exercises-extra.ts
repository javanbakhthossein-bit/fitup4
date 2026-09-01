/**
 * Seed: افزودن حرکات ورزشی جدید (۲۵۰+)
 * اجرا: bun run src/lib/fitness/seed-exercises-extra.ts
 *
 * این اسکریپت ۱۵۰+ حرکت جدید اضافه می‌کند تا مجموع به ۲۵۰+ برسد.
 * هیچ تغییری در حرکات موجود ایجاد نمی‌کند.
 */
import { db } from "../db";

interface ExerciseSeed {
  id: string;
  name: string;
  muscle: string;
  category: string;
  equipment: string;
  description: string;
  tips: string;
  youtubeUrl: string;
  difficulty: string;
}

// ۱۵۰+ حرکت جدید (از seed_ex_101 تا seed_ex_260)
const exercises: ExerciseSeed[] = [
  // === سینه (Push) — 20 حرکت جدید ===
  { id: "seed_ex_101", name: "پرس سینه دمبل روی توپ بدنسازی", muscle: "سینه", category: "push", equipment: "dumbbell,swiss ball", description: "روی توپ بدنسازی دراز بکشید، دمبل‌ها را از کنار سینه به سمت بالا فشار دهید.", tips: "هسته مرکزی را محکم نگه دارید و باسن را بالا نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_102", name: "پرس سینه هالتر با شیب منفی", muscle: "سینه", category: "push", equipment: "barbell,bench", description: "روی نیمکت شیب‌دار منفی دراز بکشید و هالتر را از روی سینه به سمت بالا فشار دهید.", tips: "وزنه را با کنترل پایین بیاورید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_103", name: "فلای سینه با کابل پایین", muscle: "سینه", category: "push", equipment: "cable", description: "از دستگاه کابل پایین، دسته‌ها را به سمت بالا و داخل جمع کنید.", tips: "آرنج‌ها را کمی خم نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_104", name: "پرس سینه تک‌دست دمبل", muscle: "سینه", category: "push", equipment: "dumbbell,bench", description: "با یک دمبل، پرس سینه را به صورت تک‌دست انجام دهید.", tips: "برای تعادل، عضلات هسته مرکزی را درگیر کنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_105", name: "پرس سینه گیلوتین", muscle: "سینه", category: "push", equipment: "barbell,bench", description: "هالتر را با دست‌های بازتر از شانه بگیرید و آن را به سمت گردن پایین بیاورید.", tips: "احتیاط: این حرکت فشار زیادی به شانه وارد می‌کند.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_106", name: "پرس سینه با کش مقاومتی", muscle: "سینه", category: "push", equipment: "resistance band", description: "کش مقاومتی را زیر نیمکت قرار دهید و پرس سینه را انجام دهید.", tips: "کش را محکم نگه دارید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_107", name: "شنا سوئدی پلایومتریک", muscle: "سینه", category: "push", equipment: "bodyweight", description: "شنا سوئدی معمولی اما با پرش در مرحله بالا رفتن.", tips: "زمانی که دست‌ها در هوا هستند، یک دست‌زدن انجام دهید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_108", name: "پرس سینه دمبل چرخشی", muscle: "سینه", category: "push", equipment: "dumbbell,bench", description: "دمبل‌ها را در حین پرس، چرخش ۹۰ درجه انجام دهید.", tips: "چرخش را در انتهای حرکت انجام دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_109", name: "کراس‌اور کابل با دست خمیده", muscle: "سینه", category: "push", equipment: "cable", description: "کراس‌اور کابل معمولی اما با آرنج‌های خمیده.", tips: "عضلات سینه را در انتهای حرکت فشار دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_110", name: "پرس سینه ایزومتریک", muscle: "سینه", category: "push", equipment: "dumbbell,bench", description: "در میانه حرکت پرس، ۳ ثانیه مکث کنید.", tips: "نفس خود را حبس نکنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_111", name: "شنا سوئدی الماسی پلایومتریک", muscle: "سینه", category: "push", equipment: "bodyweight", description: "شنا الماسی با پرش در مرحله بالا رفتن.", tips: "دست‌ها را نزدیک هم نگه دارید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_112", name: "پرس سینه هالتر دست‌بسته", muscle: "سینه", category: "push", equipment: "barbell,bench", description: "پرس سینه با گریپ دست‌بسته (false grip).", tips: "احتیاط: وزنه را رها نکنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_113", name: "فلای سینه روی توپ بدنسازی", muscle: "سینه", category: "push", equipment: "dumbbell,swiss ball", description: "فلای سینه با دمبل روی توپ بدنسازی.", tips: "تعادل خود را حفظ کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_114", name: "پرس سینه دمبل شیب‌دار با چرخش", muscle: "سینه", category: "push", equipment: "dumbbell,incline bench", description: "پرس سینه دمبل شیب‌دار با چرخش دمبل‌ها در انتهای حرکت.", tips: "چرخش را آرام انجام دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_115", name: "دیپس پارالل با وزنه", muscle: "سینه", category: "push", equipment: "parallel bars,weight", description: "دیپس پارالل با وزنه اضافی بین پاها.", tips: "بدن را کمی به جلو خم کنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_116", name: "شنا سوئدی یک‌دست", muscle: "سینه", category: "push", equipment: "bodyweight", description: "شنا سوئدی با یک دست (دست دیگر پشت کمر).", tips: "پاها را بازتر از عادی قرار دهید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_117", name: "پرس سینه با زنجیر", muscle: "سینه", category: "push", equipment: "barbell,chains,bench", description: "پرس سینه با اضافه کردن زنجیر به دو سر هالتر.", tips: "زنجیرها باید در پایین حرکت روی زمین باشند.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_118", name: "فلای سینه با کش مقاومتی", muscle: "سینه", category: "push", equipment: "resistance band", description: "فلای سینه با کش مقاومتی به جای دمبل.", tips: "کش را محکم به نیمکت متصل کنید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_119", name: "پرس سینه دمبل با مکث", muscle: "سینه", category: "push", equipment: "dumbbell,bench", description: "پرس سینه دمبل با مکث ۲ ثانیه‌ای در پایین.", tips: "مکث را در نزدیک‌ترین نقطه به سینه انجام دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_120", name: "شنا سوئدی T-Push", muscle: "سینه", category: "push", equipment: "bodyweight", description: "شنا سوئدی با چرخش به طرفین و باز کردن یک دست به سمت بالا.", tips: "در حین چرخش، یک دست را به سمت سقف باز کنید.", youtubeUrl: "", difficulty: "intermediate" },

  // === پشت (Pull) — 20 حرکت جدید ===
  { id: "seed_ex_121", name: "زیربغل سیم‌کش دست‌بسته", muscle: "زیربغل", category: "pull", equipment: "cable", description: "زیربغل سیم‌کش با گریپ دست‌بسته (reverse grip).", tips: "آرنج‌ها را نزدیک بدن نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_122", name: "بارفیکس L-Sit", muscle: "پشت", category: "pull", equipment: "pull-up bar", description: "بارفیکس معمولی اما با پاهای صاف و موازی با زمین.", tips: "پاها را در سطح کمر نگه دارید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_123", name: "روئینگ هالتر خم ایزومتریک", muscle: "پشت", category: "pull", equipment: "barbell", description: "روئینگ هالتر با مکث ۳ ثانیه‌ای در بالا.", tips: "در بالاترین نقطه، کتف‌ها را فشار دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_124", name: "زیربغل تک‌دست کابل", muscle: "زیربغل", category: "pull", equipment: "cable", description: "زیربغل کابل به صورت تک‌دست.", tips: "بدن را کمی به جلو خم کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_125", name: "بارفیکس عریض", muscle: "پشت", category: "pull", equipment: "pull-up bar", description: "بارفیکس با گریپ عریض‌تر از عرض شانه.", tips: "در بالا، چانه را از میله بالاتر ببرید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_126", name: "روئینگ دمبل تک‌دست با مکث", muscle: "پشت", category: "pull", equipment: "dumbbell,bench", description: "روئینگ دمبل تک‌دست با مکث ۲ ثانیه‌ای در بالا.", tips: "هسته مرکزی را محکم نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_127", name: "ددلیفت رومانیایی دمبل تک‌پا", muscle: "پشت", category: "pull", equipment: "dumbbell", description: "ددلیفت رومانیایی با یک دمبل و یک پا.", tips: "تعادل را حفظ کنید و زانو را قفل نکنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_128", name: "زیربغل T-Bar با چرخش", muscle: "زیربغل", category: "pull", equipment: "t-bar", description: "زیربغل T-Bar با چرخش مچ در انتهای حرکت.", tips: "چرخش را آرام انجام دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_129", name: "بارفیکس نوعی (Typewriter)", muscle: "پشت", category: "pull", equipment: "pull-up bar", description: "بارفیکس با حرکت بدن به طرفین در بالا.", tips: "در بالا، بدن را به سمت راست و چپ حرکت دهید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_130", name: "روئینگ پاندلی با مکث", muscle: "پشت", category: "pull", equipment: "barbell", description: "روئینگ پاندلی با مکث ۲ ثانیه‌ای در بالا.", tips: "بدن را در زاویه ۴۵ درجه نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_131", name: "زیربغل سیم‌کش V-Bar", muscle: "زیربغل", category: "pull", equipment: "cable", description: "زیربغل سیم‌کش با دسته V-Bar.", tips: "آرنج‌ها را نزدیک بدن نگه دارید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_132", name: "شراگ هالتر ایزومتریک", muscle: "کمر و پشت", category: "pull", equipment: "barbell", description: "شراگ هالتر با مکث ۳ ثانیه‌ای در بالا.", tips: "در بالا، شانه‌ها را به سمت گوش‌ها ببرید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_133", name: "بارفیکس وزنه‌دار", muscle: "پشت", category: "pull", equipment: "pull-up bar,weight", description: "بارفیکس با وزنه اضافی بین پاها.", tips: "وزنه را با کمربند وزنه استفاده کنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_134", name: "روئینگ ماشین هیدرولیک", muscle: "پشت", category: "pull", equipment: "machine", description: "روئینگ با ماشین هیدرولیک.", tips: "کتف‌ها را در حین کشش فشار دهید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_135", name: "ددلیفت سومو با دمبل", muscle: "پشت", category: "pull", equipment: "dumbbell", description: "ددلیفت سومو با یک دمبل سنگین.", tips: "پاها را بازتر از شانه قرار دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_136", name: "زیربغل سیم‌کش شیب‌دار", muscle: "زیربغل", category: "pull", equipment: "cable", description: "زیربغل سیم‌کش با شیب بدن به عقب.", tips: "در حین کشش، بدن را کمی به عقب خم کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_137", name: "بارفیکس آرcher (کماندار)", muscle: "پشت", category: "pull", equipment: "pull-up bar", description: "بارفیکس با یک دست خمیده و یک دست صاف.", tips: "دست صاف را به تدریج صاف‌تر کنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_138", name: "روئینگ TRX", muscle: "پشت", category: "pull", equipment: "trx", description: "روئینگ با تسمه TRX.", tips: "بدن را صاف نگه دارید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_139", name: "ددلیفت کتل‌بل", muscle: "پشت", category: "pull", equipment: "kettlebell", description: "ددلیفت با کتل‌بل بین پاها.", tips: "کفل را در بالا فشار دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_140", name: "زیربغل ماشین قایقی", muscle: "زیربغل", category: "pull", equipment: "machine", description: "زیربغل با ماشین قایقی (rowing machine).", tips: "کتف‌ها را در حین کشش فشار دهید.", youtubeUrl: "", difficulty: "beginner" },

  // === پا و باسن (Legs) — 25 حرکت جدید ===
  { id: "seed_ex_141", name: "اسکوات گابلت", muscle: "پا", category: "legs", equipment: "kettlebell", description: "اسکوات با یک کتل‌بل جلوی سینه.", tips: "کتل‌بل را نزدیک بدن نگه دارید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_142", name: "اسکوات بلغاری دمبل", muscle: "پا", category: "legs", equipment: "dumbbell,bench", description: "اسکوات بلغاری با دمبل در دست‌ها.", tips: "یک پا روی نیمکت، پا دیگر جلو.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_143", name: "اسکات پرس", muscle: "پا", category: "legs", equipment: "barbell", description: "اسکوات با پرش در مرحله بالا.", tips: "پاها را در حین پرش صاف کنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_144", name: "لانگز پیاده‌روی با دمبل", muscle: "پا", category: "legs", equipment: "dumbbell", description: "لانگز به صورت پیاده‌روی با دمبل.", tips: "زانوی عقب را به زمین نزدیک کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_145", name: "اسکوات سومو دمبل", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "اسکوات سومو با یک دمبل بین پاها.", tips: "پاها را بازتر از شانه قرار دهید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_146", name: "ددلیفت رومانیایی تک‌پا دمبل", muscle: "پشت ران", category: "legs", equipment: "dumbbell", description: "ددلیفت رومانیایی با یک پا و یک دمبل.", tips: "تعادل را حفظ کنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_147", name: "اسکوات با کش مقاومتی", muscle: "پا", category: "legs", equipment: "resistance band", description: "اسکوات با کش مقاومتی دور زانوها.", tips: "کش را محکم نگه دارید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_148", name: "لانگز معکوس با هالتر", muscle: "پا", category: "legs", equipment: "barbell", description: "لانگز معکوس با هالتر روی شانه.", tips: "قدم را به عقب بردارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_149", name: "اسکوات اسپلیت بلغاری با مکث", muscle: "پا", category: "legs", equipment: "dumbbell,bench", description: "اسکوات بلغاری با مکث ۲ ثانیه‌ای در پایین.", tips: "در پایین‌ترین نقطه مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_150", name: "پل باسن با وزنه", muscle: "پا و باسن", category: "legs", equipment: "barbell", description: "پل باسن با هالتر روی باسن.", tips: "در بالا، باسن را فشار دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_151", name: "اسکوات جلو هالتر", muscle: "پا", category: "legs", equipment: "barbell", description: "اسکوات با هالتر جلوی شانه.", tips: "هالتر را روی شانه‌ها نگه دارید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_152", name: "لانگز جانبی با دمبل", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "لانگز به صورت جانبی با دمبل.", tips: "زانوی جلو را از پا فراتر نبرید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_153", name: "اسکوات پلایومتریک", muscle: "پا", category: "legs", equipment: "bodyweight", description: "اسکوات با پرش در مرحله بالا.", tips: "در حین پرش، دست‌ها را به سمت بالا ببرید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_154", name: "ددلیفت رومانیایی تک‌پا کتل‌بل", muscle: "پشت ران", category: "legs", equipment: "kettlebell", description: "ددلیفت رومانیایی تک‌پا با کتل‌بل.", tips: "تعادل را حفظ کنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_155", name: "اسکوات هاک", muscle: "پا", category: "legs", equipment: "machine", description: "اسکوات با ماشین هاک.", tips: "کمر را محکم به پشتی تکیه دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_156", name: "لانگز کشویی", muscle: "پا", category: "legs", equipment: "slider", description: "لانگز با اسلایدر زیر یک پا.", tips: "پا را به آرامی به عقب بکشید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_157", name: "اسکوات ایزومتریک", muscle: "پا", category: "legs", equipment: "bodyweight", description: "اسکوات با مکث ۳۰ ثانیه‌ای در پایین.", tips: "در زاویه ۹۰ درجه مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_158", name: "پل باسن تک‌پا", muscle: "پا و باسن", category: "legs", equipment: "bodyweight", description: "پل باسن با یک پا در هوا.", tips: "در بالا، باسن را فشار دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_159", name: "اسکوات با توپ بدنسازی", muscle: "پا", category: "legs", equipment: "swiss ball", description: "اسکوات با توپ بدنسازی پشت سر.", tips: "توپ را به دیوار فشار دهید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_160", name: "لانگز کورلی", muscle: "پشت ران", category: "legs", equipment: "dumbbell", description: "لانگز با خم شدن به جلو (کردلینگ).", tips: "در حین پایین رفتن، دمبل را به سمت پا ببرید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_161", name: "اسکوات با گابلت و چرخش", muscle: "پا", category: "legs", equipment: "kettlebell", description: "اسکوات گابلت با چرخش بدن به طرفین در بالا.", tips: "در بالا، بدن را به سمت راست و چپ بچرخانید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_162", name: "پرس پا تک‌پا", muscle: "پا", category: "legs", equipment: "machine", description: "پرس پا با یک پا.", tips: "وزنه را سبک‌تر انتخاب کنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_163", name: "اسکوات با مکث در پایین", muscle: "پا", category: "legs", equipment: "barbell", description: "اسکوات با مکث ۳ ثانیه‌ای در پایین.", tips: "در پایین‌ترین نقطه مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_164", name: "لانگز بلغاری با کتل‌بل", muscle: "پا", category: "legs", equipment: "kettlebell,bench", description: "اسکوات بلغاری با کتل‌بل در دست.", tips: "کفل را در پایین فشار دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_165", name: "اسکوات سومو با مکث", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "اسکوات سومو با مکث ۲ ثانیه‌ای در پایین.", tips: "در پایین، کفل را فشار دهید.", youtubeUrl: "", difficulty: "intermediate" },

  // === سرشانه (Shoulders) — 15 حرکت جدید ===
  { id: "seed_ex_166", name: "پرس سرشانه دمبل نشسته", muscle: "سرشانه", category: "push", equipment: "dumbbell,bench", description: "پرس سرشانه دمبل نشسته روی نیمکت.", tips: "کمر را محکم به پشتی تکیه دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_167", name: "نشر جانب با کش مقاومتی", muscle: "سرشانه", category: "push", equipment: "resistance band", description: "نشر جانب با کش مقاومتی.", tips: "کش را زیر پا قرار دهید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_168", name: "پرس سرشانه آرنولد ایزومتریک", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "پرس آرنولد با مکث ۲ ثانیه‌ای در بالا.", tips: "در بالا، مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_169", name: "نشر جلو با کتل‌بل", muscle: "سرشانه", category: "push", equipment: "kettlebell", description: "نشر جلو با کتل‌بل.", tips: "کتل‌بل را با یک دست نگه دارید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_170", name: "پرس سرشانه هالتر ایستاده", muscle: "سرشانه", category: "push", equipment: "barbell", description: "پرس سرشانه هالتر ایستاده.", tips: "هسته مرکزی را محکم نگه دارید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_171", name: "نشر جانب تک‌دست کابل", muscle: "سرشانه", category: "push", equipment: "cable", description: "نشر جانب تک‌دست با کابل.", tips: "کابل را به آرام بالا ببرید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_172", name: "پرس سرشانه ماشین", muscle: "سرشانه", category: "push", equipment: "machine", description: "پرس سرشانه با ماشین.", tips: "کمر را محکم به پشتی تکیه دهید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_173", name: "نشر خم دمبل سرشانه", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "نشر خم برای سرشانه خلفی با دمبل.", tips: "آرنج‌ها را بالاتر از مچ نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_174", name: "پرس سرشانه دمبل ایستاده", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "پرس سرشانه دمبل ایستاده.", tips: "هسته مرکزی را محکم نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_175", name: "نشر جلو با هالتر", muscle: "سرشانه", category: "push", equipment: "barbell", description: "نشر جلو با هالتر.", tips: "هالتر را تا سطح چشم بالا ببرید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_176", name: "پرس سرشانه آرو(ln) با دمبل", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "پرس سرشانه با دمبل‌ها در حالت آرام.", tips: "دمبل‌ها را آرام بالا ببرید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_177", name: "نشر جانب نشسته", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "نشر جانب دمبل نشسته.", tips: "کمر را صاف نگه دارید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_178", name: "پرس سرشانه هالتر پشت گردن", muscle: "سرشانه", category: "push", equipment: "barbell", description: "پرس سرشانه هالتر از پشت گردن.", tips: "احتیاط: این حرکت فشار زیادی به گردن وارد می‌کند.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_179", name: "نشر خم کابل تک‌دست", muscle: "سرشانه", category: "push", equipment: "cable", description: "نشر خم کابل تک‌دست برای سرشانه خلفی.", tips: "آرنج را بالاتر از مچ نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_180", name: "پرس سرشانه با کتل‌بل", muscle: "سرشانه", category: "push", equipment: "kettlebell", description: "پرس سرشانه با کتل‌بل در یک دست.", tips: "مچ را صاف نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },

  // === بازو (Arms) — 15 حرکت جدید ===
  { id: "seed_ex_181", name: "جلو بازو هالتر EZ با مکث", muscle: "بازو", category: "pull", equipment: "barbell", description: "جلو بازو هالتر EZ با مکث ۲ ثانیه‌ای در بالا.", tips: "در بالا، مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_182", name: "پشت بازو سیم‌کش طناب", muscle: "بازو", category: "push", equipment: "cable", description: "پشت بازو سیم‌کش با دسته طناب.", tips: "در پایین، طناب را باز کنید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_183", name: "جلو بازو دمبل چکشی", muscle: "بازو", category: "pull", equipment: "dumbbell", description: "جلو بازو دمبل با گریپ چکشی.", tips: "مچ‌ها را صاف نگه دارید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_184", name: "پشت بازو هالتر خوابیده", muscle: "بازو", category: "push", equipment: "barbell,bench", description: "پشت بازو هالتر خوابیده روی نیمکت.", tips: "آرنج‌ها را نزدیک هم نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_185", name: "جلو بازو کابل تک‌دست", muscle: "بازو", category: "pull", equipment: "cable", description: "جلو بازو کابل تک‌دست.", tips: "در بالا، مکث کنید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_186", name: "پشت بازو دیپس نیمکت", muscle: "بازو", category: "push", equipment: "bench", description: "پشت بازو دیپس روی نیمکت.", tips: "بدن را نزدیک نیمکت نگه دارید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_187", name: "جلو بازو دمبل نشسته", muscle: "بازو", category: "pull", equipment: "dumbbell,bench", description: "جلو بازو دمبل نشسته.", tips: "کمر را صاف نگه دارید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_188", name: "پشت بازو طناب بالا", muscle: "بازو", category: "push", equipment: "cable", description: "پشت بازو با طناب از بالا.", tips: "در پایین، طناب را باز کنید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_189", name: "جلو بازو متمرکز دمبل", muscle: "بازو", category: "pull", equipment: "dumbbell", description: "جلو بازو متمرکز با دمبل.", tips: "آرنج را به ران داخلی تکیه دهید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_190", name: "پشت بازو طناب معکوس", muscle: "بازو", category: "push", equipment: "cable", description: "پشت بازو با گریپ معکوس.", tips: "آرنج‌ها را نزدیک بدن نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_191", name: "جلو بازو 21 تایی", muscle: "بازو", category: "pull", equipment: "barbell", description: "جلو بازو هالتر به روش ۲۱ تایی (۷ بالا، ۷ پایین، ۷ کامل).", tips: "در هر بخش ۷ تکرار انجام دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_192", name: "پشت بازو تک‌دست دمبل", muscle: "بازو", category: "push", equipment: "dumbbell", description: "پشت بازو تک‌دست دمبل.", tips: "آرنج را بالا نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_193", name: "جلو بازو کابل با طناب", muscle: "بازو", category: "pull", equipment: "cable", description: "جلو بازو کابل با دسته طناب.", tips: "گریپ چکشی استفاده کنید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_194", name: "پشت بازو ماشین دیپس", muscle: "بازو", category: "push", equipment: "machine", description: "پشت بازو با ماشین دیپس.", tips: "وزنه را با کنترل پایین بیاورید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_195", name: "جلو بازو دمبل با چرخش", muscle: "بازو", category: "pull", equipment: "dumbbell", description: "جلو بازو دمبل با چرخش مچ (supination).", tips: "در بالا، مچ را به سمت بالا بچرخانید.", youtubeUrl: "", difficulty: "intermediate" },

  // === شکم (Core) — 15 حرکت جدید ===
  { id: "seed_ex_196", name: "پلانک با دست‌های متحرک", muscle: "شکم", category: "core", equipment: "bodyweight", description: "پلانک با حرکت دست‌ها به سمت جلو و برگشت.", tips: "هسته مرکزی را محکم نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_197", name: "کرانچ روی توپ بدنسازی", muscle: "شکم", category: "core", equipment: "swiss ball", description: "کرانچ روی توپ بدنسازی.", tips: "کمر را روی توپ قرار دهید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_198", name: "پلانک جانبی با بالا بردن پا", muscle: "شکم", category: "core", equipment: "bodyweight", description: "پلانک جانبی با بالا بردن پای بالا.", tips: "تعادل را حفظ کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_199", name: "بالا آوردن پا روی نیمکت", muscle: "شکم", category: "core", equipment: "bench", description: "بالا آوردن پاها روی نیمکت.", tips: "کمر را محکم به نیمکت تکیه دهید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_200", name: "پلانک با چرخش", muscle: "شکم", category: "core", equipment: "bodyweight", description: "پلانک با چرخش بدن به طرفین.", tips: "در حین چرخش، یک دست را به سمت بالا ببرید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_201", name: "کرانچ bicycling", muscle: "شکم", category: "core", equipment: "bodyweight", description: "کرانچ با حرکت پاها مثل دوچرخه.", tips: "آرنج مخالف را به زانو نزدیک کنید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_202", name: "پلانک معکوس", muscle: "شکم", category: "core", equipment: "bodyweight", description: "پلانک به صورت معکوس (رو به سقف).", tips: "بدن را صاف نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_203", name: "بالا آوردن پا روی بار فیکس", muscle: "شکم", category: "core", equipment: "pull-up bar", description: "بالا آوردن پاها روی بار فیکس.", tips: "بدن را تاب ندهید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_204", name: "کرانچ با کابل", muscle: "شکم", category: "core", equipment: "cable", description: "کرانچ با کابل از بالا.", tips: "در پایین، عضلات شکم را فشار دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_205", name: "پلانک با تپ شانه", muscle: "شکم", category: "core", equipment: "bodyweight", description: "پلانک با تپ زدن شانه‌ها به نوبت.", tips: "بدن را ثابت نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_206", name: "بالا آوردن پا روی زمین", muscle: "شکم", category: "core", equipment: "bodyweight", description: "بالا آوردن پاها روی زمین.", tips: "کمر را محکم به زمین تکیه دهید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_207", name: "کرانچ V-Sit", muscle: "شکم", category: "core", equipment: "bodyweight", description: "کرانچ به صورت V (دست‌ها و پاها به هم می‌رسند).", tips: "در بالا، تعادل را حفظ کنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_208", name: "پلانک جانبی با چرخش", muscle: "شکم", category: "core", equipment: "bodyweight", description: "پلانک جانبی با چرخش بدن به سمت زمین.", tips: "در حین چرخش، دست بالا را به زیر بدن ببرید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_209", name: "کرانچ معکوس روی نیمکت", muscle: "شکم", category: "core", equipment: "bench", description: "کرانچ معکوس با پاها روی نیمکت.", tips: "زانوها را به سمت سینه بکشید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_210", name: "پلانک با حرکت لغزنده", muscle: "شکم", category: "core", equipment: "slider", description: "پلانک با لغزش دست‌ها به جلو.", tips: "از اسلایدر استفاده کنید.", youtubeUrl: "", difficulty: "advanced" },

  // === کمر و پشت (Lower Back) — 10 حرکت جدید ===
  { id: "seed_ex_211", name: "افزونه کمر روی توپ بدنسازی", muscle: "کمر و پشت", category: "core", equipment: "swiss ball", description: "افزایش کمر روی توپ بدنسازی.", tips: "کمر را آرام بالا ببرید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_212", name: "ددلیفت کتل‌بل تک‌دست", muscle: "کمر و پشت", category: "pull", equipment: "kettlebell", description: "ددلیفت کتل‌بل تک‌دست.", tips: "کمر را صاف نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_213", name: "افزونه کمر روی نیمکت رومی", muscle: "کمر و پشت", category: "core", equipment: "roman chair", description: "افزایش کمر روی نیمکت رومی.", tips: "در بالا، مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_214", name: "ددلیفت رومانیایی کتل‌بل تک‌پا", muscle: "کمر و پشت", category: "pull", equipment: "kettlebell", description: "ددلیفت رومانیایی تک‌پا با کتل‌بل.", tips: "تعادل را حفظ کنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_215", name: "افزونه کمر روی زمین", muscle: "کمر و پشت", category: "core", equipment: "bodyweight", description: "افزایش کمر روی زمین (Superman).", tips: "دست‌ها و پاها را همزمان بالا ببرید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_216", name: "ددلیفت کتل‌بل با چرخش", muscle: "کمر و پشت", category: "pull", equipment: "kettlebell", description: "ددلیفت کتل‌بل با چرخش بدن در بالا.", tips: "در بالا، بدن را به طرفین بچرخانید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_217", name: "افزونه کمر معکوس", muscle: "کمر و پشت", category: "core", equipment: "roman chair", description: "افزایش کمر معکوس روی نیمکت رومی.", tips: "در بالا، مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_218", name: "ددلیفت رومانیایی با کش", muscle: "کمر و پشت", category: "pull", equipment: "resistance band", description: "ددلیفت رومانیایی با کش مقاومتی.", tips: "کش را زیر پا قرار دهید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_219", name: "افزونه کمر با وزنه", muscle: "کمر و پشت", category: "core", equipment: "weight,roman chair", description: "افزایش کمر با وزنه پشت سر.", tips: "وزنه را سبک انتخاب کنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_220", name: "ددلیفت سومو با کتل‌بل", muscle: "کمر و پشت", category: "pull", equipment: "kettlebell", description: "ددلیفت سومو با کتل‌بل.", tips: "پاها را بازتر از شانه قرار دهید.", youtubeUrl: "", difficulty: "intermediate" },

  // === جلو ران و پشت ران (Quads/Hamstrings) — 15 حرکت جدید ===
  { id: "seed_ex_221", name: "پرس پا با مکث", muscle: "جلو ران", category: "legs", equipment: "machine", description: "پرس پا با مکث ۲ ثانیه‌ای در پایین.", tips: "در پایین، مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_222", name: "ددلیفت رومانیایی با مکث", muscle: "پشت ران", category: "legs", equipment: "barbell", description: "ددلیفت رومانیایی با مکث ۲ ثانیه‌ای در پایین.", tips: "در پایین، مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_223", name: "جلو ران ماشین", muscle: "جلو ران", category: "legs", equipment: "machine", description: "جلو ران با ماشین.", tips: "وزنه را با کنترل پایین بیاورید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_224", name: "پشت ران ماشین خوابیده", muscle: "پشت ران", category: "legs", equipment: "machine", description: "پشت ران ماشین خوابیده.", tips: "در بالا، مکث کنید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_225", name: "جلو ران تک‌پا", muscle: "جلو ران", category: "legs", equipment: "machine", description: "جلو ران ماشین تک‌پا.", tips: "وزنه را سبک‌تر انتخاب کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_226", name: "پشت ران ماشین نشسته", muscle: "پشت ران", category: "legs", equipment: "machine", description: "پشت ران ماشین نشسته.", tips: "در بالا، مکث کنید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_227", name: "جلو ران با کش مقاومتی", muscle: "جلو ران", category: "legs", equipment: "resistance band", description: "جلو ران با کش مقاومتی.", tips: "کش را به مچ پا متصل کنید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_228", name: "پشت ران با کش مقاومتی", muscle: "پشت ران", category: "legs", equipment: "resistance band", description: "پشت ران با کش مقاومتی.", tips: "کش را به مچ پا متصل کنید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_229", name: "جلو ران با دمبل", muscle: "جلو ران", category: "legs", equipment: "dumbbell", description: "جلو ران با دمبل بین پاها.", tips: "دمبل را محکم نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_230", name: "پشت ران با کابل", muscle: "پشت ران", category: "legs", equipment: "cable", description: "پشت ران با کابل.", tips: "در بالا، مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_231", name: "جلو ران ایستاده تک‌پا", muscle: "جلو ران", category: "legs", equipment: "dumbbell", description: "جلو ران تک‌پا ایستاده با دمبل.", tips: "تعادل را حفظ کنید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_232", name: "پشت ران روی توپ بدنسازی", muscle: "پشت ران", category: "legs", equipment: "swiss ball", description: "پشت ران با کشیدن توپ بدنسازی به سمت باسن.", tips: "کفل را بالا نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_233", name: "جلو ران با مکث ایزومتریک", muscle: "جلو ران", category: "legs", equipment: "machine", description: "جلو ران ماشین با مکث در بالا.", tips: "در بالا، ۳ ثانیه مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_234", name: "پشت ران نوردیک کتل‌بل", muscle: "پشت ران", category: "legs", equipment: "kettlebell", description: "پشت ران نوردیک با کتل‌بل.", tips: "بدن را آرام پایین بیاورید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_235", name: "جلو ران اسلی دراگ", muscle: "جلو ران", category: "legs", equipment: "slider", description: "جلو ران با اسلایدر زیر یک پا.", tips: "پا را به آرام به سمت باسن بکشید.", youtubeUrl: "", difficulty: "intermediate" },

  // === سینه و دست (Chest/Arms combo) — 10 حرکت جدید ===
  { id: "seed_ex_236", name: "پرس سینه دمبل با مکث ایزومتریک", muscle: "سینه و دست", category: "push", equipment: "dumbbell,bench", description: "پرس سینه دمبل با مکث ۳ ثانیه‌ای در پایین.", tips: "در پایین‌ترین نقطه مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_237", name: "شنا سوئدی الماسی با مکث", muscle: "سینه و دست", category: "push", equipment: "bodyweight", description: "شنا الماسی با مکث ۲ ثانیه‌ای در پایین.", tips: "دست‌ها را نزدیک هم نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_238", name: "پرس سینه دمبل با مکث بالا", muscle: "سینه و دست", category: "push", equipment: "dumbbell,bench", description: "پرس سینه دمبل با مکث ۲ ثانیه‌ای در بالا.", tips: "در بالاترین نقطه مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_239", name: "دیپس پارالل با مکث", muscle: "سینه و دست", category: "push", equipment: "parallel bars", description: "دیپس پارالل با مکث ۲ ثانیه‌ای در پایین.", tips: "در پایین‌ترین نقطه مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_240", name: "پرس سینه هالتر با مکث پایین", muscle: "سینه و دست", category: "push", equipment: "barbell,bench", description: "پرس سینه هالتر با مکث ۲ ثانیه‌ای روی سینه.", tips: "هالتر را روی سینه مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_241", name: "شنا سوئدی با دست‌های نابرابر", muscle: "سینه و دست", category: "push", equipment: "bodyweight", description: "شنا با یک دست جلوتر از دیگری.", tips: "دست‌ها را در تکرار بعدی جابجا کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_242", name: "پرس سینه دمبل با چرخش آرام", muscle: "سینه و دست", category: "push", equipment: "dumbbell,bench", description: "پرس سینه دمبل با چرخش آرام مچ‌ها.", tips: "چرخش را در طول حرکت انجام دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_243", name: "دیپس نیمکت با مکث", muscle: "سینه و دست", category: "push", equipment: "bench", description: "دیپس نیمکت با مکث ۲ ثانیه‌ای در پایین.", tips: "در پایین، مکث کنید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_244", name: "شنا سوئدی با دست‌های جمع‌شده", muscle: "سینه و دست", category: "push", equipment: "bodyweight", description: "شنا با دست‌های نزدیک به هم.", tips: "آرنج‌ها را نزدیک بدن نگه دارید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_245", name: "پرس سینه دمبل با کش مقاومتی", muscle: "سینه و دست", category: "push", equipment: "dumbbell,resistance band,bench", description: "پرس سینه دمبل با کش مقاومتی دور سینه.", tips: "کش را محکم نگه دارید.", youtubeUrl: "", difficulty: "advanced" },

  // === کاردیو و فول‌بادی (Cardio/Full body) — 15 حرکت جدید ===
  { id: "seed_ex_246", name: "برپی با پرش", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "برپی با پرش در انتها.", tips: "حرکت را با سرعت انجام دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_247", name: "مانت کوهنر", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "مانت کوهنر (Mountain Climbers).", tips: "زانوها را به نوبت به سمت سینه بکشید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_248", name: "جامپ جک", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "جامپ جک (Jumping Jacks).", tips: "دست‌ها و پاها را همزمان باز و بسته کنید.", youtubeUrl: "", difficulty: "beginner" },
  { id: "seed_ex_249", name: "برپی با شنا", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "برپی با اضافه کردن شنا سوئدی.", tips: "یک شنا سوئدی در مرحله پایین انجام دهید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_250", name: "کیتل‌بل سوئینگ", muscle: "بدن کامل", category: "cardio", equipment: "kettlebell", description: "کتل‌بل سوئینگ بین پاها.", tips: "کفل را در بالا فشار دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_251", name: "برپی با پرش بلند", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "برپی با پرش حداکثر در انتها.", tips: "در پرش، دست‌ها را به سمت بالا ببرید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_252", name: "کیتل‌بل کلین و پرس", muscle: "بدن کامل", category: "cardio", equipment: "kettlebell", description: "کتل‌بل کلین و پرس.", tips: "در حرکت، کتل‌بل را به سمت بالا ببرید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_253", name: "برپی با دیپس", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "برپی با اضافه کردن دیپس.", tips: "یک دیپس در مرحله پایین انجام دهید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_254", name: "کیسل‌بل اسنچ", muscle: "بدن کامل", category: "cardio", equipment: "kettlebell", description: "کتل‌بل اسنچ (Snatch).", tips: "کتل‌بل را در یک حرکت به بالا ببرید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_255", name: "برپی با لانگز", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "برپی با اضافه کردن لانگز.", tips: "یک لانز در مرحله پایین انجام دهید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_256", name: "کیتل‌بل کلین دوگانه", muscle: "بدن کامل", category: "cardio", equipment: "kettlebell", description: "کتل‌بل کلین با دو کتل‌بل.", tips: "همزمان‌سازی حرکت دو دست.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_257", name: "برپی با پلانک", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "برپی با مکث ۳ ثانیه‌ای در پلانک.", tips: "در مرحله پلانک مکث کنید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_258", name: "کیتل‌بل سوئینگ تک‌دست", muscle: "بدن کامل", category: "cardio", equipment: "kettlebell", description: "کتل‌بل سوئینگ تک‌دست.", tips: "کفل را در بالا فشار دهید.", youtubeUrl: "", difficulty: "advanced" },
  { id: "seed_ex_259", name: "برپی با اسکوات", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "برپی با اضافه کردن اسکوات.", tips: "یک اسکوات در مرحله پایین انجام دهید.", youtubeUrl: "", difficulty: "intermediate" },
  { id: "seed_ex_260", name: "کیتل‌بل گابلت اسکوات با پرش", muscle: "بدن کامل", category: "cardio", equipment: "kettlebell", description: "اسکوات گابلت با پرش در بالا.", tips: "در پرش، کتل‌بل را نزدیک بدن نگه دارید.", youtubeUrl: "", difficulty: "advanced" },
];

async function main() {
  console.log(`🏋️ افزودن ${exercises.length} حرکت جدید...`);

  let added = 0;
  let skipped = 0;

  for (const ex of exercises) {
    const existing = await db.exerciseLibrary.findUnique({ where: { id: ex.id } });
    if (existing) {
      skipped++;
      continue;
    }

    await db.exerciseLibrary.create({
      data: {
        id: ex.id,
        name: ex.name,
        muscle: ex.muscle,
        category: ex.category,
        equipment: ex.equipment,
        description: ex.description,
        tips: ex.tips,
        mediaUrl: "",
        youtubeUrl: ex.youtubeUrl,
        difficulty: ex.difficulty,
      },
    });
    added++;
  }

  const total = await db.exerciseLibrary.count();
  console.log(`\n🎉 تمام!`);
  console.log(`  - افزوده شده: ${added}`);
  console.log(`  - رد شده (تکراری): ${skipped}`);
  console.log(`  - مجموع حرکات: ${total}`);
}

main().catch(console.error).finally(() => process.exit(0));
