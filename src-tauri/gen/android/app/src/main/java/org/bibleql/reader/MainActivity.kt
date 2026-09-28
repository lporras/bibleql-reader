package org.bibleql.reader

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import app.tauri.plugin.PluginManager

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    releaseStalePluginManagerActivity()
    super.onCreate(savedInstanceState)
    padContentForSystemBars()
  }

  // Edge-to-edge is mandatory from targetSdk 35 on (and enableEdgeToEdge()
  // above asks for it anyway), so the webview is laid out under the status bar,
  // the navigation bar and any display cutout — the title bar's buttons end up
  // beneath the clock/battery icons and the bottom of the page beneath the
  // nav buttons. Android WebView doesn't reliably report those bars through
  // CSS env(safe-area-inset-*), so inset the content view natively instead.
  // The keyboard's inset is folded into the bottom padding too, because
  // edge-to-edge also turns off adjustResize.
  private fun padContentForSystemBars() {
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
      view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
      WindowInsetsCompat.CONSUMED
    }
    // With 3-button navigation, edge-to-edge lays a translucent scrim over the
    // nav bar in the *system* theme's colour, which clashes whenever the app's
    // own light/dark toggle disagrees with it. SystemBars paints that strip
    // itself, so the scrim is only in the way.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(SystemBars(), "AndroidSystemBars")
  }

  // The strips padContentForSystemBars() leaves behind the status and nav bars
  // show the content view's background, and the bars' icon contrast defaults to
  // the system theme. The app has its own theme toggle, so the frontend
  // (platform/host.ts, syncSystemBars) calls this whenever the theme changes, to
  // paint those strips in the page's surface colour and flip the icons to match.
  // Exposed to the page as window.AndroidSystemBars. It only recolours bars, so
  // there is nothing here worth guarding from the page.
  private inner class SystemBars {
    @JavascriptInterface
    fun setColors(color: String, dark: Boolean) {
      val parsed = try {
        Color.parseColor(color)
      } catch (err: IllegalArgumentException) {
        Log.w("MainActivity", "Ignoring unparseable system bar colour: $color")
        return
      }
      // @JavascriptInterface methods run on a WebView binder thread.
      runOnUiThread {
        findViewById<View>(android.R.id.content).setBackgroundColor(parsed)
        WindowCompat.getInsetsController(window, window.decorView).apply {
          isAppearanceLightStatusBars = !dark
          isAppearanceLightNavigationBars = !dark
        }
      }
    }
  }

  // Workaround for an upstream bug in tauri 2.11.6
  // (mobile/android/.../plugin/PluginManager.kt).
  //
  // PluginManager is a process-wide `object`, and its onActivityCreate bails out
  // with `if (::activity.isInitialized) return` — its own TODO admits it never
  // swaps to a different activity on destroy. But androidx unregisters every
  // ActivityResultLauncher when the activity that registered it reaches
  // DESTROYED. So the first time this activity is recreated while the process
  // lives on, PluginManager is still holding launchers bound to the dead
  // activity, and *every* startActivityForResult — the save dialog, the file
  // picker, permission requests — dies with "Attempting to launch an
  // unregistered ActivityResultLauncher".
  //
  // Clearing the backing field makes ::activity.isInitialized false again, so
  // the super.onCreate() below (which calls PluginManager.onActivityCreate(this)
  // via TauriActivity) re-registers all three launchers against the live
  // activity. Reflection is the only way in: the field is a lateinit var, so it
  // cannot be un-set through the generated setter.
  //
  // Drop this once upstream re-registers on recreate.
  private fun releaseStalePluginManagerActivity() {
    try {
      val field = PluginManager::class.java.getDeclaredField("activity")
      field.isAccessible = true
      if (field.get(PluginManager) !== this) {
        field.set(PluginManager, null)
      }
    } catch (err: Throwable) {
      // Never take the activity down over this — worst case we're back to the
      // upstream behaviour we're working around.
      Log.w("MainActivity", "Could not reset PluginManager's activity reference", err)
    }
  }
}
