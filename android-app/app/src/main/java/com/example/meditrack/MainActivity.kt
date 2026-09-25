package com.example.meditrack

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private var pendingPermissionRequest: PermissionRequest? = null

    // Points to local dev server (10.0.2.2 is host loopback in Android Emulator)
    private val webAppUrl = "https://meditrack-coral-delta.vercel.app/"

    private val requestCameraPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted: Boolean ->
            if (isGranted) {
                pendingPermissionRequest?.grant(pendingPermissionRequest?.resources)
                pendingPermissionRequest = null
            } else {
                pendingPermissionRequest?.deny()
                pendingPermissionRequest = null
                showCameraPermissionDialog()
            }
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Setup SwipeRefreshLayout and WebView programmatically
        swipeRefreshLayout = SwipeRefreshLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        
        swipeRefreshLayout.addView(webView)
        setContentView(swipeRefreshLayout)

        setupWebView()

        swipeRefreshLayout.setOnRefreshListener {
            webView.reload()
        }

        webView.loadUrl(webAppUrl)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webSettings: WebSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.mediaPlaybackRequiresUserGesture = false
        webSettings.databaseEnabled = true
        webSettings.cacheMode = WebSettings.LOAD_DEFAULT
        webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        webSettings.allowFileAccess = true
        webSettings.allowContentAccess = true

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                swipeRefreshLayout.isRefreshing = true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                swipeRefreshLayout.isRefreshing = false
            }
            
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                Log.e("MainActivity", "WebView Error: ${error?.errorCode} - ${error?.description} for URL: ${request?.url}")
                // Ignore errors for non-main frames
                if (request?.isForMainFrame == true) {
                    showOfflineError(error?.description?.toString())
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                val hasCameraPermission = ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.CAMERA
                ) == PackageManager.PERMISSION_GRANTED

                if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                    if (hasCameraPermission) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                    } else {
                        pendingPermissionRequest = request
                        requestCameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                } else {
                    request.deny()
                }
            }
        }
    }

    private fun showOfflineError(errorDetail: String? = null) {
        val detailText = if (!errorDetail.isNullOrEmpty()) "<p style='color: #888; font-size: 14px;'>Error: $errorDetail</p>" else ""
        val html = "<html><body style='text-align:center; padding-top: 50px; font-family: sans-serif; color: #333;'>" +
            "<h2>Unable to Connect to Web Server</h2>" +
            "<p>Could not reach <b>$webAppUrl</b></p>" +
            detailText +
            "<p style='margin-top:20px;'>Make sure your web dev server is running on port 8080 on your host PC, then pull down to refresh.</p>" +
            "</body></html>"
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
    }

    private fun showCameraPermissionDialog() {
        AlertDialog.Builder(this)
            .setTitle("Camera Permission Required")
            .setMessage("QR scanning will not work without camera permission. Please grant the permission to use this feature.")
            .setPositiveButton("Try Again") { _, _ ->
                requestCameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
