# پولکی (Poolakey) — قواعد R8/ProGuard
# ⚠️ پکیج درست ir.cafebazaar.poolakey است (نسخه قبلی com.poolakey بود — بی‌اثر)
-keep class ir.cafebazaar.poolakey.** { *; }
-dontwarn ir.cafebazaar.poolakey.**

# پل جاوااسکریپت — کلاس داخلی MainActivity$NativeBridge با reflection از JS صدا زده می‌شود
-keep class ir.fittup.app.MainActivity$NativeBridge { *; }
-keepclassmembers class ir.fittup.app.MainActivity$NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# خطاهای benign کتابخانه‌های وب‌کیت/اندروید
-dontwarn android.webkit.**
