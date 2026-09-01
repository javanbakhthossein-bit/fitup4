package ir.fittup.app

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.print.PrintManager
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.view.View
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import ir.cafebazaar.poolakey.Connection
import ir.cafebazaar.poolakey.Payment
import ir.cafebazaar.poolakey.config.PaymentConfiguration
import ir.cafebazaar.poolakey.config.SecurityCheck
import ir.cafebazaar.poolakey.request.PurchaseRequest
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import kotlin.concurrent.thread

/**
 * FitUp — اپ کافه‌بازار (v1.2.0)
 *
 * پوسته اندرویدی (WebView) پنل کاربری فیتاپ + پرداخت درون‌برنامه‌ای بازار (پولکی).
 *
 * ⚠️ طبق قوانین انتشار بازار: فقط پنل کاربری (بدون پنل مدیریت) و پرداخت اشتراک
 * دیجیتال فقط از IAB بازار.
 *
 * پل JS (window.FitUpNative) — متدهای سایت:
 *  - isBazaarApp(): Boolean                    → تشخیص محیط بازار
 *  - appVersion(): String                      → نسخه اپ
 *  - purchaseSubscription(sku, payload, cbId, dynamicPriceToken) → خرید محصول/اشتراک بازار
 *  - consumePurchase(purchaseToken)            → مصرف خرید (برای خرید مجدد/تمدید)
 *  - isPaymentAvailable(): Boolean             → اتصال پرداخت برقرار است؟
 *  - downloadFile(filename, dataUrl)           → ذخیره خروجی PNG/PDF در Downloads
 *  - printPage()                               → چاپ صفحه (PrintManager)
 *  - showNotification(title, body)             → نوتیف سیستم اندروید
 *  - requestSmsAutoRead()                      → اجازه خواندن پیامک OTP (فقط صفحه ورود)
 *
 * سایت (page-client) هم window.__fitupBazaarRestore(purchases) را فراهم می‌کند که
 * خریدهای consume-نشده بعد از اتصال پولکی به آن فرستاده می‌شوند (بازیابی خرید).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ir.fittup.app.databinding.ActivityMainBinding
    private lateinit var webView: WebView
    private lateinit var swipeRefresh: androidx.swiperefreshlayout.widget.SwipeRefreshLayout
    private lateinit var splash: LinearLayout
    private lateinit var errorView: LinearLayout
    private lateinit var errorRetry: Button

    private var payment: Payment? = null
    private var connection: Connection? = null
    @Volatile private var paymentReady = false
    /** کلید RSA معتبر است؟ اگر نه، خریدها fail-closed خطا می‌دهند (امنیت) */
    private var rsaKeyValid = false

    // آپلود فایل (عکس/ویدیو در چت و آنالیزها) — بدون این، input file در WebView کار نمی‌کند
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>

    /** callback فعال پرداخت — پرداخت‌ها یکی‌یکی (single flight) */
    private var activePaymentCallbackId: String? = null

    /** URL اصلی (فریم اصلی) — برای چک origin پل JS */
    @Volatile private var lastMainUrl: String? = null

    /** جلوگیری از تکرار toast آپدیت اختیاری در هر onResume */
    private var softUpdateToastShown = false

    private lateinit var notifPermissionLauncher: ActivityResultLauncher<String>

    // ─── دوربین/میکروفون وب (getUserMedia): مجوز دقیقاً در زمان استفاده ───
    /** درخواست معلقِ WebChromeClient.onPermissionRequest — با نتیجه دیالوگ/مجوز resolve می‌شود */
    private var pendingWebPermissionRequest: PermissionRequest? = null
    private val mediaPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        pendingWebPermissionRequest?.let { req ->
            pendingWebPermissionRequest = null
            val ok = grants.values.all { it }
            runOnUiThread { if (ok) req.grant(req.resources) else req.deny() }
        }
    }

    // ─── OTP خودکار: خواندن پیامک کد فیتاپ (با اجازه صریح کاربر) ───
    private lateinit var smsPermissionLauncher: ActivityResultLauncher<String>
    /** receiver پیامک — فقط وقتی مجوز داده شده در onResume ثبت می‌شود */
    private var smsReceiver: BroadcastReceiver? = null
    /** آیا در این session دیالوگ اجازه پیامک نشان داده شده؟ (نزاعم نکنیم) */
    private var smsRationaleShown = false
    /** آخرین متن کلیپ‌بورد dispatch شده — جلوگیری از dispatch تکراری */
    private var lastClipboardDispatched: String? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ir.fittup.app.databinding.ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        webView = binding.webView
        swipeRefresh = binding.swipeRefresh
        splash = binding.splash
        errorView = binding.errorView
        errorRetry = binding.errorRetry

        setupFileChooser()
        setupWebView()
        setupPayment()
        setupNotifications()
        setupSmsAutoRead()

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            // شروع مستقیم با OTP/پنل — ?screen=auth: اگر سشن هست → پنل، وگرنه صفحه ورود
            webView.loadUrl(startUrl())
        }

        checkAppVersion()
    }

    /** شروع با ?screen=auth — کاربر لاگین‌شده مستقیم پنل را می‌بیند (نیاز کلیک «ورود» نیست) */
    private fun startUrl(): String {
        val base = BuildConfig.SITE_URL.trimEnd('/')
        return if (base.contains("?")) "$base&screen=auth" else "$base?screen=auth"
    }

    /* ───────────── WebView ───────────── */

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val s: WebSettings = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true          // برای سشن لاگین OTP
        s.databaseEnabled = true
        s.loadWithOverviewMode = true
        s.useWideViewPort = true
        s.mediaPlaybackRequiresUserGesture = false   // ویدیوهای تمرین
        s.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        s.allowFileAccess = false
        s.allowContentAccess = true          // برای انتخاب فایل (دوربین/گالری)
        s.userAgentString = (s.userAgentString ?: "") + " FitUpBazaar/" + BuildConfig.VERSION_NAME
        s.cacheMode = WebSettings.LOAD_DEFAULT
        // مقیاس متن ثابت — «تجربه اپ واقعی»: فونت سیستم اندروید نباید layout سایت را
        // بشکند یا متن‌ها ناهماهنگ بزرگ/کوچک شود (WebView پیش‌فرض textZoom را با
        // fontScale سیستم تغییر می‌دهد)
        s.textZoom = 100

        // کوکی‌ها را از قبل به WebView وصل کن (سشن OTP بین restartها زنده می‌ماند)
        try {
            CookieManager.getInstance().setAcceptCookie(true)
        } catch (_: Exception) {}

        // پس‌زمینه سفید — بدون فلش تیره هنگام بارگذاری
        webView.setBackgroundColor(Color.WHITE)

        webView.addJavascriptInterface(NativeBridge(), "FitUpNative")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                lastMainUrl = url
                hideError()
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                val scheme = url.scheme?.lowercase() ?: return false

                // اسکیم‌های غیر http — باید native هندل شوند (tel/mailto/intent…)
                if (scheme != "http" && scheme != "https") {
                    return handleExternalScheme(url)
                }

                // فقط دامنه‌های خودمان داخل WebView؛ بقیه (لینک بیرونی مقالات) → مرورگر
                val host = url.host ?: return false
                if (!isAllowedHost(host)) {
                    openExternal(url)
                    return true
                }
                return false
            }

            override fun onPageFinished(view: WebView, url: String) {
                splash.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                injectBridgeHelper()
                // بازیابی خریدهای consume-نشده — بعد از هر بارگذاری کامل صفحه
                maybeRestorePurchases()
            }

            /** خطای بارگذاری فریم اصلی → صفحه خطای فارسی با دکمه تلاش مجدد */
            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) showError()
            }

            /** کرش رندرر (targetSdk 34) → بازسازی اکتویتی به‌جای صفحه سیاه */
            override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                Log.e("FitUp", "WebView renderer gone — recreating activity")
                recreate()
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                return try {
                    val intent = params.createIntent()
                    // انتخاب چندگانه عکس (چت/آنالیز بدن چند زاویه)
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    fileChooserLauncher.launch(intent)
                    true
                } catch (e: ActivityNotFoundException) {
                    filePathCallback = null
                    false
                }
            }

            /**
             * ─── مجوز دوربین/میکروفون وب — دقیقاً در زمان استفاده ───
             * سایت برای ضبط صدا (ویس چت) یا ویدیو (آنالیز ویدیویی تمرین/بدن) از
             * navigator.mediaDevices.getUserMedia استفاده می‌کند؛ این کال‌بک فقط
             * در همان لحظه اجرا می‌شود (نه در استارتاپ). الگوی سایت: دیالوگ کوتاه
             * فارسی اجازه → سپس مجوز runtime اندروید.
             */
            override fun onPermissionRequest(request: PermissionRequest) {
                val resources = request.resources
                val needsVideo = resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                val needsAudio = resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                if (!needsVideo && !needsAudio) {
                    request.deny()
                    return
                }
                runOnUiThread {
                    val what = when {
                        needsVideo && needsAudio -> "ضبط ویدیو (دوربین و میکروفون)"
                        needsVideo -> "استفاده از دوربین"
                        else -> "استفاده از میکروفون"
                    }
                    // دیالوگ کوتاه، نه متن طولانی رباتی — الگوی دیالوگ پیامک OTP
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("اجازه دسترسی")
                        .setMessage("برای $what اجازه می‌دهی؟")
                        .setPositiveButton("اجازه می‌دهم") { _, _ ->
                            requestMediaRuntimePermissions(request)
                        }
                        .setNegativeButton("نه") { _, _ -> request.deny() }
                        .show()
                }
            }
        }

        swipeRefresh.setOnRefreshListener { webView.reload() }
        // رنگ برند فیتاپ
        swipeRefresh.setColorSchemeColors(Color.parseColor("#f97316"))

        // ─── FIX: اسکرول به بالا → رفرش نمی‌شود ───
        // باگ: SwipeRefreshLayout همیشه فعال بود؛ وقتی صفحه اسکرول‌شده بود و
        // کاربر انگشت را به پایین می‌کشید (برای برگشتن به بالای صفحه)، به‌جای
        // اسکرول، pull-to-refresh فعال می‌شد و صفحه رفرش می‌شد. رفع: refresh فقط
        // وقتی مجاز است که WebView دقیقاً در بالای صفحه است (scrollY == 0).
        swipeRefresh.isEnabled = true
        webView.setOnScrollChangeListener { _, _, scrollY, _, _ ->
            swipeRefresh.isEnabled = scrollY == 0
        }
    }

    /** آیا این host دامنه مجاز ماست؟ */
    private fun isAllowedHost(host: String): Boolean {
        val siteHost = try { URI(BuildConfig.SITE_URL).host } catch (_: Exception) { null }
        if (host == "fittup.ir" || host.endsWith(".fittup.ir")) return true
        if (siteHost != null && (host == siteHost || host.endsWith(".$siteHost"))) return true
        return false
    }

    /** اسکیم‌های غیر وب — tel/mailto/intent و غیره */
    private fun handleExternalScheme(uri: Uri): Boolean {
        try {
            when (uri.scheme?.lowercase()) {
                "tel" -> startActivity(Intent(Intent.ACTION_DIAL, uri))
                "mailto" -> startActivity(Intent(Intent.ACTION_SENDTO, uri))
                "sms" -> startActivity(Intent(Intent.ACTION_SENDTO, uri))
                "intent" -> {
                    val intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
                    startActivity(intent)
                }
                else -> startActivity(Intent(Intent.ACTION_VIEW, uri))
            }
        } catch (_: Exception) {
            // اپی برای این لینک نیست — نادیده بگیر (صفحه خطای WebView نشان نده)
        }
        return true
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            // مرورگری نیست — نادیده بگیر
        }
    }

    /* ───────────── صفحه خطا ───────────── */

    private fun showError() {
        runOnUiThread {
            splash.visibility = View.GONE
            errorView.visibility = View.VISIBLE
            swipeRefresh.isRefreshing = false
        }
    }

    private fun hideError() {
        runOnUiThread { errorView.visibility = View.GONE }
    }

    /* ───────────── helper سمت سایت ───────────── */

    /** helper سمت سایت — پرامیس تمیز برای خرید بازار + هندلر restore */
    private fun injectBridgeHelper() {
        val js = """
            (function() {
              if (window.__fitupBazaarInjected) return;
              window.__fitupBazaarInjected = true;
              window.__bazaarPending = {};
              // نتیجه پرداخت از نیتیو — id + آبجکت نتیجه
              window.__bazaarPaymentResult = function(id, result) {
                var p = window.__bazaarPending[id];
                if (p) { delete window.__bazaarPending[id]; p(result); }
              };
              // آیا داخل اپ بازار هستیم؟
              window.isFitUpBazaarApp = function() {
                try { return !!(window.FitUpNative && window.FitUpNative.isBazaarApp && window.FitUpNative.isBazaarApp()); }
                catch (e) { return false; }
              };
              // خرید از بازار → پرامیس {ok, purchaseToken, orderId, productId, error}
              // dynamicPriceToken (اختیاری): شناسه قیمت پویا برای پرداخت با مبلغ تخفیف‌دار
              window.fitupBazaarPurchase = function(sku, payload, dynamicPriceToken) {
                return new Promise(function(resolve) {
                  var id = 'cb' + Date.now() + Math.floor(Math.random() * 1000);
                  window.__bazaarPending[id] = resolve;
                  try {
                    var token = (dynamicPriceToken == null) ? '' : String(dynamicPriceToken);
                    window.FitUpNative.purchaseSubscription(String(sku), JSON.stringify(payload || {}), id, token);
                  } catch (e) {
                    delete window.__bazaarPending[id];
                    resolve({ ok: false, error: String(e) });
                  }
                });
              };
            })();
        """.trimIndent()
        runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
    }

    /* ───────────── آپلود فایل ───────────── */

    private fun setupFileChooser() {
        fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback ?: return@registerForActivityResult
            filePathCallback = null
            val uris: Array<Uri>? = if (result.resultCode == RESULT_OK) {
                val data = result.data
                // انتخاب چندگانه (عکس چت)
                val clip = data?.clipData
                if (clip != null) {
                    Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                } else {
                    data?.data?.let { arrayOf(it) }
                }
            } else null
            callback.onReceiveValue(uris ?: arrayOf())
        }
    }

    /* ───────────── پرداخت درون‌برنامه‌ای بازار (پولکی) ───────────── */

    private fun setupPayment() {
        // کلید RSA از پیشخان توسعه‌دهندگان بازار (تب «پرداخت درون‌برنامه‌ای» برنامه)
        val configuredKey = BuildConfig.BAZAAR_RSA_PUBLIC_KEY.trim()
        rsaKeyValid = configuredKey.isNotEmpty() && configuredKey != "PASTE_YOUR_RSA_KEY_HERE"
        if (!rsaKeyValid) {
            Log.w("FitUp", "⚠️ BAZAAR_RSA_PUBLIC_KEY تنظیم نشده — خرید fail-closed می‌شود (امنیت). کلید را از پیشخان بازار بگیرید و در app/build.gradle.kts قرار دهید.")
        }
        val securityCheck = if (rsaKeyValid) {
            SecurityCheck.Enable(rsaPublicKey = configuredKey)
        } else {
            // اتصال برای query/restore باز می‌ماند؛ خود خرید fail-closed است (startBazaarPurchase)
            SecurityCheck.Disable
        }

        val config = PaymentConfiguration(localSecurityCheck = securityCheck)
        payment = Payment(context = this, config = config)

        // اتصال به سرویس پرداخت بازار — DSL با receiver
        connection = payment?.connect {
            connectionSucceed {
                paymentReady = true
                // بازیابی خریدهای consume-نشده (کرش بین پرداخت و فعال‌سازی سرور)
                queryUnconsumedPurchases()
            }
            connectionFailed { _ ->
                paymentReady = false
            }
            disconnected {
                paymentReady = false
            }
        }
    }

    /** بازیابی خریدها — فقط وقتی صفحه JS آماده است (پس از onPageFinished صدا زده می‌شود) */
    private var jsReadyForRestore = false
    private fun maybeRestorePurchases() {
        jsReadyForRestore = true
        if (paymentReady) queryUnconsumedPurchases()
    }

    /** خریدهای consume-نشده → به سایت (idempotent) → سایت بعد از فعال‌سازی consume می‌کند */
    private fun queryUnconsumedPurchases() {
        if (!jsReadyForRestore) return
        try {
            payment?.getPurchasedProducts {
                querySucceed { purchaseList ->
                    val items = purchaseList.filter { !it.purchaseToken.isNullOrBlank() }
                    if (items.isEmpty()) return@querySucceed
                    val arr = JSONArray()
                    for (p in items) {
                        arr.put(
                            JSONObject()
                                .put("productId", p.productId ?: "")
                                .put("purchaseToken", p.purchaseToken ?: "")
                                .put("orderId", p.orderId ?: "")
                        )
                    }
                    runOnUiThread {
                        webView.evaluateJavascript(
                            "window.__fitupBazaarRestore && window.__fitupBazaarRestore($arr);",
                            null
                        )
                    }
                }
                queryFailed { _ ->
                    // بازار قدیمی/نصب‌نشده — نادیده بگیر
                }
            }
        } catch (e: Exception) {
            Log.w("FitUp", "queryPurchases failed: ${e.message}")
        }
    }

    /** شروع خرید از بازار — نتیجه به وب برمی‌گردد. fail-closed بدون کلید RSA.
     *  dynamicPriceToken: شناسه قیمت پویا (تخفیف/اعتبار ارتقا) — خالی = قیمت پایه SKU */
    private fun startBazaarPurchase(sku: String, payloadJson: String, callbackId: String, dynamicPriceToken: String) {
        // پاسخ به وب: window.__bazaarPaymentResult(id, resultObject)
        fun respond(json: JSONObject) {
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.__bazaarPaymentResult && window.__bazaarPaymentResult('$callbackId', $json);",
                    null
                )
            }
        }

        if (!rsaKeyValid) {
            // fail-closed (ممیزی 2-d باگ #1): بدون کلید RSA، خرید هرگز انجام نمی‌شود —
            // نه SecurityCheck.Disable با «خرید بدون وریفای محلی».
            respond(
                JSONObject()
                    .put("ok", false)
                    .put("error", "پرداخت درون‌برنامه‌ای پیکربندی نشده است (کلید RSA). لطفاً از نسخه وب سایت خرید کنید یا اپ را به‌روزرسانی کنید.")
            )
            return
        }
        if (!paymentReady) {
            respond(
                JSONObject()
                    .put("ok", false)
                    .put("error", "اتصال به پرداخت بازار برقرار نیست. برنامه بازار را باز کنید، وارد حساب شوید و دوباره تلاش کنید.")
            )
            return
        }
        if (activePaymentCallbackId != null) {
            respond(JSONObject().put("ok", false).put("error", "یک پرداخت دیگر در حال انجام است."))
            return
        }
        activePaymentCallbackId = callbackId

        val finish: (JSONObject) -> Unit = { json ->
            activePaymentCallbackId = null
            respond(json)
        }

        val request = PurchaseRequest(
            productId = sku,
            payload = payloadJson,
            dynamicPriceToken = dynamicPriceToken.ifBlank { null } // قیمت پویا (تخفیف) اگر سایت ثبت کرده باشد
        )
        payment?.purchaseProduct(
            registry = activityResultRegistry,
            request = request,
        ) {
            purchaseSucceed { purchaseInfo ->
                val json = JSONObject()
                    .put("ok", true)
                    .put("purchaseToken", purchaseInfo.purchaseToken ?: "")
                    .put("orderId", purchaseInfo.orderId ?: "")
                    .put("productId", purchaseInfo.productId ?: sku)
                    .put("payload", purchaseInfo.payload ?: payloadJson)
                    .put("purchaseTime", purchaseInfo.purchaseTime ?: 0L)
                // سایت خودش purchaseToken را برای فعال‌سازی به /api/payment/bazaar/purchase
                // می‌فرستد و بعد از موفقیت consumePurchase را صدا می‌زند (تمدید ممکن می‌شود)
                finish(json)
            }
            purchaseFailed { throwable ->
                finish(
                    JSONObject()
                        .put("ok", false)
                        .put("error", "پرداخت ناموفق: ${throwable?.message ?: "خطای نامشخص"}")
                )
            }
            purchaseCanceled {
                finish(
                    JSONObject()
                        .put("ok", false)
                        .put("canceled", true)
                        .put("error", "پرداخت توسط شما لغو شد.")
                )
            }
            purchaseFlowBegan {
                // جریان خرید شروع شد — نیازی به عمل نیست
            }
            failedToBeginFlow { throwable ->
                // شروع جریان شکست خورد (بازار قدیمی/نصب‌نشده) — گارد single-flight آزاد می‌شود
                finish(
                    JSONObject()
                        .put("ok", false)
                        .put("error", "امکان شروع پرداخت نبود: ${throwable?.message ?: "برنامه بازار به‌روز نیست یا نصب نیست"}")
                )
            }
        }
    }

    /** consume خرید — بعد از فعال‌سازی موفق روی سرور از سمت سایت صدا زده می‌شود */
    private fun consumePurchaseToken(purchaseToken: String) {
        try {
            payment?.consumeProduct(purchaseToken) {
                consumeSucceed {
                    Log.d("FitUp", "purchase consumed: ${purchaseToken.take(24)}…")
                }
                consumeFailed { throwable ->
                    Log.w("FitUp", "consume failed: ${throwable?.message}")
                }
            }
        } catch (e: Exception) {
            Log.w("FitUp", "consume exception: ${e.message}")
        }
    }

    /* ───────────── دانلود / چاپ ───────────── */

    /** ذخیره data URL (PNG/PDF) در Downloads اندروید */
    @SuppressLint("InlinedApi")
    private fun downloadDataUrl(filename: String, dataUrl: String) {
        try {
            val safeName = filename.ifBlank { "fitup-${System.currentTimeMillis()}" }
                .replace(Regex("[^A-Za-z0-9._-\\u0600-\\u06FF ]"), "_")
            val comma = dataUrl.indexOf(',')
            if (comma < 0 || !dataUrl.startsWith("data:", ignoreCase = true)) {
                runOnUiThread { toast("فایل قابل ذخیره نیست") }
                return
            }
            val meta = dataUrl.substring(5, comma)
            val mime = meta.substringBefore(";").ifBlank { "application/octet-stream" }
            val isBase64 = meta.contains("base64", ignoreCase = true)
            val bytes = if (isBase64) {
                Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT)
            } else {
                dataUrl.substring(comma + 1).toByteArray(Charsets.UTF_8)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // اندروید ۱۰+ — MediaStore (بدون نیاز به مجوز)
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, mime)
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                if (uri == null) {
                    runOnUiThread { toast("خطا در ذخیره فایل") }
                    return
                }
                contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                contentResolver.update(uri, values, null, null)
            } else {
                // اندروید ۹ و پایین‌تر — پوشه اپ (بدون مجوز نوشتن)
                val dir = getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS) ?: filesDir
                val file = File(dir, safeName)
                FileOutputStream(file).use { it.write(bytes) }
            }
            runOnUiThread { toast("«$safeName» ذخیره شد ✓") }
        } catch (e: Exception) {
            Log.e("FitUp", "download failed: ${e.message}")
            runOnUiThread { toast("خطا در ذخیره فایل") }
        }
    }

    /** چاپ صفحه فعلی WebView با PrintManager اندروید */
    private fun printCurrentPage() {
        runOnUiThread {
            try {
                val printManager = getSystemService(Context.PRINT_SERVICE) as PrintManager
                val jobName = "FitUp ${BuildConfig.VERSION_NAME}"
                printManager.print(jobName, webView.createPrintDocumentAdapter(jobName), null)
            } catch (e: Exception) {
                toast("چاپ در این دستگاه ممکن نیست")
            }
        }
    }

    /* ───────────── نوتیفیکیشن native ───────────── */

    private fun setupNotifications() {
        // کانال نوتیف (اندروید ۸+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "اعلان‌های فیتاپ",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply { description = "یادآوری‌ها و خبرهای برنامه" }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
        // ─── مجوز POST_NOTIFICATIONS دیگر «خودکار در استارتاپ» گرفته نمی‌شود ───
        // درخواست مالک: «دسترسی‌ها باید شخصی‌سازی‌شده اجازه بگیرن — الان انگار
        // کروم داره اجازه دسترسی می‌گیره». دیالوگ سیستمی بی‌سبق در لحظه‌ی باز
        // شدن اپ، همان حس «کروم اجازه می‌خواهد» را می‌داد. حالا فقط کانال ساخته
        // می‌شود و مجوز از پل JS (requestNotificationPermission) وقتی کاربر در
        // خود سایت روی «فعال‌سازی اعلان‌ها» کلیک می‌کند، خواسته می‌شود — با
        // توضیح زیبا در خود سایت قبل از دیالوگ کوتاه سیستمی.
        notifPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    }

    /** مجوز اعلان — از پل JS با توضیح زیبا در سایت، بعد از رضایت کاربر */
    private fun maybeRequestNotificationPermission() {
        try {
            if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                notifPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
            }
        } catch (_: Exception) {}
    }

    /* ───────────── دوربین/میکروفون WebView (getUserMedia) ───────────── */

    /**
     * مجوز runtime دوربین/میکروفون — دقیقاً وقتی سایت ضبط صدا/ویدیو می‌خواهد
     * (WebChromeClient.onPermissionRequest، بعد از دیالوگ اجازه فارسی).
     * اگر همه مجوزها از قبل داده شده باشند مستقیم grant می‌شود؛ وگرنه
     * دیالوگ سیستمی اندروید.
     */
    private fun requestMediaRuntimePermissions(webRequest: PermissionRequest) {
        // درخواست معلق قبلی را رد کن (درخواست همزمان/تکراری از صفحه)
        pendingWebPermissionRequest?.let { if (it !== webRequest) it.deny() }
        pendingWebPermissionRequest = webRequest
        val perms = mutableListOf<String>()
        if (webRequest.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
            perms.add(android.Manifest.permission.CAMERA)
        }
        if (webRequest.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
            perms.add(android.Manifest.permission.RECORD_AUDIO)
        }
        val alreadyGranted = perms.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
        if (perms.isEmpty() || alreadyGranted) {
            pendingWebPermissionRequest = null
            runOnUiThread { webRequest.grant(webRequest.resources) }
        } else {
            try {
                mediaPermissionLauncher.launch(perms.toTypedArray())
            } catch (_: Exception) {
                // دیالوگ سیستم باز نشد (مثلاً گوشی خاص) — fail بسته
                pendingWebPermissionRequest = null
                runOnUiThread { webRequest.deny() }
            }
        }
    }

    /** نمایش نوتیف سیستم — از پل JS (main-app polling) صدا زده می‌شود */
    private fun showNativeNotification(title: String, body: String) {
        try {
            if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                return // بدون مجوز، بی‌صدا رد شو
            }
            val notification = NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                // باز کردن اپ با لمس نوتیف
                .setContentIntent(
                    android.app.PendingIntent.getActivity(
                        this, 0,
                        Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
                    )
                )
                .build()
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify((System.currentTimeMillis() % 100000).toInt(), notification)
        } catch (e: Exception) {
            Log.w("FitUp", "notification failed: ${e.message}")
        }
    }

    /* ───────────── OTP خودکار: پیامک + کلیپ‌بورد ───────────── */

    /**
     * درج کد OTP در صفحه ورود سایت — سایت window.__fitupNativeSmsCode را
     * فقط روی صفحه OTP فعال می‌کند (auth-screen)؛ خارج از آن فراخوانی بی‌اثر است.
     */
    private fun dispatchOtpCode(code: String) {
        runOnUiThread {
            webView.evaluateJavascript(
                "window.__fitupNativeSmsCode && window.__fitupNativeSmsCode('$code');",
                null
            )
        }
    }

    /** راه‌اندازی خواندن خودکار پیامک OTP — مجوز با دیالوگ توضیح فارسی (یک‌بار) */
    private fun setupSmsAutoRead() {
        smsPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                registerSmsReceiver()
                toast("خواندن خودکار کد پیامک فعال شد ✅")
            }
        }
    }

    /** سایت روی صفحه OTP است → اگر مجوز نیست، با توضیح درخواست (فقط یک‌بار در session) */
    private fun maybeRequestSmsPermission() {
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED) {
            registerSmsReceiver()
            return
        }
        if (smsRationaleShown) return
        smsRationaleShown = true
        runOnUiThread {
            // ─── درخواست مالک: دیالوگ کوتاه، نه متن طولانی رباتی ───
            // توضیح کامل و جذاب قبل از این دیالوگ در خود سایت (کارت «ورود
            // خودکار با پیامک») نمایش داده می‌شود؛ این دیالوگ فقط تأیید نهایی
            // سیستم است و متنش حداکثر یک خط است.
            AlertDialog.Builder(this)
                .setTitle("خواندن پیامک فیتاپ")
                .setMessage("برای وارد شدن خودکار کد، اجازه خواندن پیامک فیتاپ را بده.")
                .setPositiveButton("اجازه می‌دهم") { _, _ ->
                    try {
                        smsPermissionLauncher.launch(android.Manifest.permission.RECEIVE_SMS)
                    } catch (_: Exception) {}
                }
                .setNegativeButton("خودم وارد می‌کنم", null)
                .show()
        }
    }

    /** ثبت receiver پیامک — در onResume (فقط با مجوز)؛ در onPause unreg */
    private fun registerSmsReceiver() {
        if (smsReceiver != null) return
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action != "android.provider.Telephony.SMS_RECEIVED") return
                try {
                    val msgs = android.provider.Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
                    for (m in msgs) {
                        val body = m?.displayMessageBody?.toString() ?: continue
                        // فقط پیامک‌های حاوی «فیتاپ» (قالب SMS.ir) — کد ۴ رقمی را بگیر
                        if (!body.contains("فیتاپ") && !body.contains("FitUp", true)) continue
                        val match = Regex("(^|\\D)(\\d{4})(\\D|$)").find(body) ?: continue
                        dispatchOtpCode(match.groupValues[2])
                        break
                    }
                } catch (_: Exception) {}
            }
        }
        try {
            registerReceiver(receiver, android.content.IntentFilter("android.provider.Telephony.SMS_RECEIVED"))
            smsReceiver = receiver
        } catch (_: Exception) {}
    }

    private fun unregisterSmsReceiver() {
        smsReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
        }
        smsReceiver = null
    }

    /** کد OTP از کلیپ‌بورد (کاربر از نوتیف پیامک «کپی کد» زده و برگشته) */
    private fun maybeDispatchClipboardOtp() {
        try {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
                // بدون مجوز پیامک — کلیپ‌بورد بهترین راه کمکی است
            }
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager ?: return
            val text = cm.primaryClip?.getItemAt(0)?.coerceToText(this)?.toString()?.trim() ?: return
            if (text == lastClipboardDispatched) return
            if (Regex("^\\d{4,6}$").matches(text)) {
                lastClipboardDispatched = text
                dispatchOtpCode(text.take(4))
            }
        } catch (_: Exception) {}
    }

    /* ───────────── چک نسخه / آپدیت اجباری ───────────── */

    /**
     * در هر اجرا /api/app/version را می‌خواند:
     *  - versionCode < min → دیالوگ آپدیت اجباری (غیرقابل رد)
     *  - versionCode < latest → toast ملایم (یک‌بار در هر session)
     */
    private fun checkAppVersion() {
        thread {
            try {
                val url = URL(BuildConfig.SITE_URL.trimEnd('/') + "/api/app/version")
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 10_000
                conn.readTimeout = 10_000
                conn.instanceFollowRedirects = true
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                conn.disconnect()
                val json = JSONObject(body)
                val min = json.optInt("minVersionCode", 1)
                val latest = json.optInt("latestVersionCode", 1)
                val updateUrl = json.optString("updateUrl", "https://cafebazaar.ir/app/ir.fittup.app")
                val title = json.optString("forceUpdateTitle", "به‌روزرسانی لازم است")
                val msg = json.optString("forceUpdateBody", "برای ادامه استفاده از فیتاپ، نسخه جدید را از کافه‌بازار نصب کنید.")
                runOnUiThread {
                    when {
                        BuildConfig.VERSION_CODE < min -> showForceUpdateDialog(updateUrl, title, msg)
                        BuildConfig.VERSION_CODE < latest && !softUpdateToastShown -> {
                            softUpdateToastShown = true
                            toast("نسخه جدید فیتاپ در کافه‌بازار موجود است 🎉")
                        }
                    }
                }
            } catch (e: Exception) {
                // آفلاین/خطا — نادیده بگیر؛ در اجرای بعدی دوباره تلاش می‌شود
            }
        }
    }

    /** دیالوگ آپدیت اجباری — تنها دکمه «به‌روزرسانی» (باز کردن صفحه بازار) */
    private fun showForceUpdateDialog(updateUrl: String, title: String, message: String) {
        val dialog = AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton("به‌روزرسانی از بازار") { _, _ -> openBazaarPage(updateUrl) }
            .create()
        dialog.setCanceledOnTouchOutside(false)
        dialog.show()
    }

    /** باز کردن صفحه برنامه در بازار — https اول، سپس market:// */
    private fun openBazaarPage(updateUrl: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(updateUrl)))
        } catch (_: Exception) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=ir.fittup.app")))
            } catch (_: Exception) {
                toast("برنامه بازار در دسترس نیست")
            }
        }
    }

    private fun toast(msg: String) {
        runOnUiThread { Toast.makeText(this, msg, Toast.LENGTH_SHORT).show() }
    }

    /* ───────────── پل JS ───────────── */

    /** چک origin — پل فقط از دامنه خودمان قابل فراخوانی است (امنیت) */
    private fun bridgeAllowed(): Boolean {
        val u = lastMainUrl ?: return false
        return try {
            val host = URI(u).host ?: return false
            isAllowedHost(host)
        } catch (_: Exception) {
            false
        }
    }

    inner class NativeBridge {
        @JavascriptInterface
        fun isBazaarApp(): Boolean = bridgeAllowed()

        @JavascriptInterface
        fun appVersion(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun isPaymentAvailable(): Boolean = paymentReady && rsaKeyValid

        @JavascriptInterface
        fun purchaseSubscription(sku: String, payloadJson: String, callbackId: String, dynamicPriceToken: String) {
            if (!bridgeAllowed()) return
            runOnUiThread { startBazaarPurchase(sku, payloadJson, callbackId, dynamicPriceToken) }
        }

        @JavascriptInterface
        fun consumePurchase(purchaseToken: String) {
            if (!bridgeAllowed()) return
            consumePurchaseToken(purchaseToken)
        }

        @JavascriptInterface
        fun downloadFile(filename: String, dataUrl: String) {
            if (!bridgeAllowed()) return
            downloadDataUrl(filename, dataUrl)
        }

        @JavascriptInterface
        fun printPage() {
            if (!bridgeAllowed()) return
            printCurrentPage()
        }

        @JavascriptInterface
        fun showNotification(title: String, body: String) {
            if (!bridgeAllowed()) return
            showNativeNotification(title, body)
        }

        @JavascriptInterface
        fun requestSmsAutoRead() {
            if (!bridgeAllowed()) return
            runOnUiThread { maybeRequestSmsPermission() }
        }

        /**
         * مجوز اعلان‌های اندروید — از وب‌سایت با UI جذاب خودش صدا زده می‌شود
         * (بعد از توضیح و رضایت کاربر)، نه بی‌سبق در استارتاپ.
         */
        @JavascriptInterface
        fun requestNotificationPermission() {
            if (!bridgeAllowed()) return
            runOnUiThread { maybeRequestNotificationPermission() }
        }

        /**
         * ─── قفل pull-to-refresh برای اسکرول داخلی صفحه (فیکس باگ پروفایل) ───
         * باگ گزارش‌شده: در منوی پروفایل (و هر لیست داخلی اسکرول‌شونده)،
         * کشیدن انگشت به پایین برای «بالا بردن محتوا» باعث رفرش کامل صفحه
         * می‌شد — چون WebView در scrollY=0 بود و SwipeRefreshLayout فعال.
         * ریشه: اسکرولِ داخل عناصر داخلی (Sheet ها و لیست‌های overflow-y)
         * برای WebView نامرئی است. فیکس: سایت در لحظه‌ی شروع لمس روی هر
         * عنصر اسکرول‌شونده داخلی، این پل را با false صدا می‌زند → رفرش
         * قفل می‌شود؛ بعد از پایان لمس دوباره باز می‌شود. با این کار در هیچ
         * جای اپ، اسکرول به بالا باعث رفرش نمی‌شود و رفرش فقط از «واقعاً
         * بالای صفحه اصلی» کار می‌کند.
         */
        @JavascriptInterface
        fun setSwipeRefreshEnabled(enabled: Boolean) {
            if (!bridgeAllowed()) return
            runOnUiThread { swipeRefresh.isEnabled = enabled }
        }
    }

    /* ───────────── چرخه حیات ───────────── */

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // طبق الگوی اندروید — WebView اول back history
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onResume() {
        super.onResume()
        // چک نسخه در هر بازگشت (اگر ادمین min را بالا برده باشد فوراً بگیرد)
        checkAppVersion()
        // OTP خودکار: اگر مجوز داریم receiver را وصل کن + شاید کد از کلیپ‌بورد آمده
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED) {
            registerSmsReceiver()
        }
        maybeDispatchClipboardOtp()
    }

    override fun onPause() {
        // receiver پیامک فقط در foreground — باتری/حریم خصوصی
        unregisterSmsReceiver()
        // سشن OTP/لاگین — کوکی‌ها را فوراً روی دیسک flush کن (کرش/کشتن پروسه)
        try {
            CookieManager.getInstance().flush()
        } catch (_: Exception) {}
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        connection?.disconnect()
        payment = null
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "fitup_general"
    }
}
