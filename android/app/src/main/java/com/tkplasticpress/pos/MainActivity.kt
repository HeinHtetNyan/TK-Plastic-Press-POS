package com.tkplasticpress.pos

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    
    // URLs are set in android/local.properties as pos.url / pos.fallback_urls
    // (never hardcoded here). Change them there and rebuild to roll out a new host.
    private val POS_URLS: List<String> = (listOf(BuildConfig.POS_URL) + BuildConfig.POS_FALLBACK_URLS
        .split(",")
        .map { it.trim() }
        .filter { it.isNotEmpty() })
        .distinct()
    private val POS_URL get() = POS_URLS[currentUrlIndex]

    private var currentUrlIndex = 0
    private var retryCount = 0
    private val maxRetriesPerUrl = 3
    private val retryHandler = Handler(Looper.getMainLooper())

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        swipeRefreshLayout = findViewById(R.id.swipeRefresh)

        setupWebView()

        // Set correct network availability BEFORE loading URL so navigator.onLine
        // is accurate on first render (avoids sync engine skipping initial syncAll)
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val activeNet = cm.activeNetworkInfo
        webView.setNetworkAvailable(activeNet?.isConnectedOrConnecting == true)

        setupNetworkListener()

        swipeRefreshLayout.setOnRefreshListener {
            webView.reload()
        }

        // Handle the back button to navigate within the webview if possible
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })

        if (savedInstanceState == null) {
            webView.loadUrl(POS_URL)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        
        // Essential WebSettings for React + IndexedDB + Service Workers
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        
        // Performance optimizations
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.setSupportMultipleWindows(false)
        settings.mediaPlaybackRequiresUserGesture = false

        // Enable cookies
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        // Force hardware acceleration
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress == 100) {
                    progressBar.visibility = View.GONE
                    swipeRefreshLayout.isRefreshing = false
                } else {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                swipeRefreshLayout.isRefreshing = true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefreshLayout.isRefreshing = false
                // A real page load made it through — stop counting failures against
                // the current host (stays on a fallback host once one works).
                retryCount = 0
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                
                // Allow our specific domain and localhost
                if (url.startsWith(POS_URL) || url.startsWith("http://localhost") || url.startsWith("https://localhost")) {
                    return false
                }
                
                // If it's a completely external link, open in default browser
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                } catch (e: Exception) {
                    // Fallback
                    return false
                }
                return true
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                // Only the top-level page load matters here — a failed sub-resource
                // (an image, an API call) shouldn't restart the whole WebView.
                if (request?.isForMainFrame != true) return
                handleMainFrameLoadFailure()
            }
        }
    }

    private fun handleMainFrameLoadFailure() {
        retryHandler.removeCallbacksAndMessages(null)

        if (retryCount < maxRetriesPerUrl) {
            retryCount++
            // Short exponential-ish backoff: 1.5s, 3s, 4.5s — absorbs transient
            // network blips before giving up on the current host.
            val delayMs = 1500L * retryCount
            retryHandler.postDelayed({ webView.loadUrl(POS_URL) }, delayMs)
            return
        }

        // Current host is exhausted — move to the next configured fallback, if any.
        if (currentUrlIndex < POS_URLS.lastIndex) {
            currentUrlIndex++
            retryCount = 0
            retryHandler.postDelayed({ webView.loadUrl(POS_URL) }, 1000L)
        }
        // No hosts left: leave the WebView's own error page showing, as before.
    }

    private fun setupNetworkListener() {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        connectivityManager.registerNetworkCallback(networkRequest, object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread {
                    webView.setNetworkAvailable(true)
                }
            }

            override fun onLost(network: Network) {
                runOnUiThread {
                    webView.setNetworkAvailable(false)
                }
            }
        })
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        webView.restoreState(savedInstanceState)
    }

    override fun onDestroy() {
        retryHandler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
