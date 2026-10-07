package pl.chwalczyk.kartkoweczka

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Inset the native container, including fixed-position WebView overlays.
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, windowInsets ->
      val safeArea = windowInsets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      val keyboard = windowInsets.getInsets(WindowInsetsCompat.Type.ime())
      view.setPadding(
        safeArea.left,
        safeArea.top,
        safeArea.right,
        maxOf(safeArea.bottom, keyboard.bottom)
      )
      WindowInsetsCompat.CONSUMED
    }
    ViewCompat.requestApplyInsets(content)
  }
}
