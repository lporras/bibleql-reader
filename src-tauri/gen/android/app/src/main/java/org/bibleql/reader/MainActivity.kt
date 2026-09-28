package org.bibleql.reader

import android.os.Bundle
import android.util.Log
import androidx.activity.enableEdgeToEdge
import app.tauri.plugin.PluginManager

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    releaseStalePluginManagerActivity()
    super.onCreate(savedInstanceState)
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
