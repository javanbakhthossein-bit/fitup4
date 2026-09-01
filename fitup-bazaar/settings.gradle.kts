pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // پولکی — کتابخانه رسمی پرداخت درون‌برنامه‌ای کافه‌بازار (از jitpack)
        maven { url = uri("https://jitpack.io") }
    }
}

rootProject.name = "FitUp"
include(":app")
