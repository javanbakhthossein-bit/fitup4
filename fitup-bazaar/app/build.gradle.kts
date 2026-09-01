plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "ir.fittup.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "ir.fittup.app"
        minSdk = 24
        targetSdk = 34
        // v1.4.0 — «دسترسی‌ها در زمان خودشان»: مجوز دوربین/میکروفون دقیقاً در لحظه‌ی
        // استفاده سایت از getUserMedia (ویس چت + آنالیز ویدیو) با دیالوگ فارسی اجازه؛
        // گالری با انتخاب‌گر سیستم (بدون مجوز) — برای انتشار در بازار این نسخه را build بگیرید.
        versionCode = 5
        versionName = "1.4.0"

        // ⚙️ تنظیمات FitUp — قبل از ساخت نهایی این مقادیر را بررسی/تغییر دهید:
        // آدرس سایت (پنل کاربری) — اپ فقط این دامنه را باز می‌کند
        buildConfigField("String", "SITE_URL", "\"https://fittup.ir\"")
        // کلید عمومی RSA پرداخت درون‌برنامه‌ای — از پیشخان توسعه‌دهندگان بازار (قرار داده شده ✓)
        // بعد از تعویض کلید، versionCode را یکی بالا ببرید و دوباره بیلد/امضا کنید.
        buildConfigField(
            "String",
            "BAZAAR_RSA_PUBLIC_KEY",
            "\"MIHNMA0GCSqGSIb3DQEBAQUAA4G7ADCBtwKBrwDI6I3QKZLtAOura5/Ij4MTPlNJ7v9J0znWW1bMcRG54abj/V/FM7pj9F058QhNGcx6qu0moEegqZRvO8er08CWCdgklkdGbzaYLziKrKHql5Os4MAtAjM26juZ+o6F8WvnnoI3g6wG7HBagV73YaNS3eDTatWBoAkMzjchVKSZj/6rRGaRv5d+cfNyyzCCmASD/sk9dQkxH1g+dVFVzUqTdtey+uOxqbONGBJiHdUCAwEAAQ==\""
        )
    }

    signingConfigs {
        create("release") {
            // keystore و رمزها — برای بیلد release الزامی است.
            // مسیر/رمز را مطابق راهنمای PUBLISH-GUIDE.md تنظیم کنید.
            storeFile = file("../keystore/fitup-release.keystore")
            storePassword = System.getenv("FITUP_KEYSTORE_PASSWORD") ?: "FitUpBazaar2026!"
            keyAlias = System.getenv("FITUP_KEY_ALIAS") ?: "fitup"
            keyPassword = System.getenv("FITUP_KEY_PASSWORD") ?: "FitUpBazaar2026!"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true          // کوچک‌تر و بهینه‌تر — مطابق توصیه بازار
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.1")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    // پولکی — کتابخانه رسمی پرداخت درون‌برنامه‌ای کافه‌بازار
    implementation("com.github.cafebazaar.Poolakey:poolakey:2.2.0")
}
