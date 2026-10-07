package pl.chwalczyk.kartkoweczka

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@InvokeArg
class UpdateArgs {
  var install: Boolean = false
}

@TauriPlugin
class AndroidUpdaterPlugin(private val activity: Activity) : Plugin(activity) {
  private val executor = Executors.newSingleThreadExecutor()
  private val busy = AtomicBoolean(false)
  private val manifestUrl = "https://github.com/Zofikar/kartkoweczka/releases/latest/download/version_mainfest.json"

  @Command
  fun update(invoke: Invoke) {
    val args = invoke.parseArgs(UpdateArgs::class.java)
    if (!busy.compareAndSet(false, true)) {
      invoke.reject("An update operation is already running")
      return
    }
    executor.execute {
      var completionOnUiThread = false
      try {
        val installed = packageInfo()
        val manifest = readManifest()
        val version = manifest.getString("version")
        val response = JSObject()
        if (versionParts(version) <= versionParts(installed.versionName ?: "")) {
          response.put("version", JSONObject.NULL)
        } else {
          response.put("version", version)
          if (args.install) {
            if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
              completionOnUiThread = true
              activity.runOnUiThread {
                try {
                  activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${activity.packageName}")))
                  response.put("status", "permission")
                  invoke.resolve(response)
                } catch (error: Exception) {
                  invoke.reject(error.message ?: "Cannot open installation settings")
                } finally {
                  busy.set(false)
                }
              }
              return@execute
            }
            val apk = download(manifest.getJSONObject("downloads").getString("Android_arm"))
            verify(apk, installed, version)
            completionOnUiThread = true
            activity.runOnUiThread {
              try {
                val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.updates", apk)
                activity.startActivity(Intent(Intent.ACTION_VIEW).apply {
                  setDataAndType(uri, "application/vnd.android.package-archive")
                  addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                })
                response.put("status", "installer")
                invoke.resolve(response)
              } catch (error: Exception) {
                invoke.reject(error.message ?: "Cannot open Android installer")
              } finally {
                busy.set(false)
              }
            }
            return@execute
          }
        }
        invoke.resolve(response)
      } catch (error: Exception) {
        completionOnUiThread = false
        File(activity.cacheDir, "updates/update.apk").delete()
        invoke.reject(error.message ?: "Android update failed")
      } finally {
        if (!completionOnUiThread) busy.set(false)
      }
    }
  }

  // Only stable versions from our release workflow are accepted.
  private fun versionParts(value: String): Long {
    return UpdatePolicy.versionParts(value)
  }

  private fun connection(address: String): HttpURLConnection {
    var url = URL(address)
    repeat(6) {
      UpdatePolicy.validateConnection(url)
      val connection = url.openConnection() as HttpURLConnection
      connection.connectTimeout = 15000
      connection.readTimeout = 30000
      connection.instanceFollowRedirects = false
      connection.setRequestProperty("User-Agent", "Kartkoweczka-Android-Updater")
      val status = connection.responseCode
      if (status in setOf(301, 302, 303, 307, 308)) {
        val location = connection.getHeaderField("Location")
        connection.disconnect()
        require(location != null) { "Missing redirect location" }
        url = URL(url, location)
      } else {
        if (status != 200) {
          connection.disconnect()
          error("Update server returned HTTP $status")
        }
        return connection
      }
    }
    error("Too many update redirects")
  }

  private fun readManifest(): JSONObject {
    val connection = connection(manifestUrl)
    try {
      val bytes = connection.inputStream.use { it.readBytesLimited(1024 * 1024) }
      return JSONObject(bytes.toString(Charsets.UTF_8))
    } finally {
      connection.disconnect()
    }
  }

  private fun java.io.InputStream.readBytesLimited(limit: Int): ByteArray {
    val output = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(8192)
    while (true) {
      val count = read(buffer)
      if (count < 0) break
      require(output.size() + count <= limit) { "Release manifest is too large" }
      output.write(buffer, 0, count)
    }
    return output.toByteArray()
  }

  private fun download(address: String): File {
    UpdatePolicy.validateRepository(address)
    val directory = File(activity.cacheDir, "updates").apply { mkdirs() }
    val apk = File(directory, "update.apk")
    val connection = connection(address)
    try {
      connection.inputStream.use { input ->
        apk.outputStream().use { output ->
          val buffer = ByteArray(65536)
          var total = 0L
          while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            total += count
            require(total <= 250L * 1024 * 1024) { "APK exceeds download size limit" }
            output.write(buffer, 0, count)
          }
          require(total > 0) { "Downloaded APK is empty" }
        }
      }
      return apk
    } finally {
      connection.disconnect()
    }
  }

  @Suppress("DEPRECATION")
  private fun packageInfo(): PackageInfo =
    activity.packageManager.getPackageInfo(activity.packageName, PackageManager.GET_SIGNATURES)

  @Suppress("DEPRECATION")
  private fun verify(apk: File, installed: PackageInfo, expectedVersion: String) {
    val candidate = activity.packageManager.getPackageArchiveInfo(apk.path, PackageManager.GET_SIGNATURES)
      ?: error("Invalid APK")
    val candidateCode = if (Build.VERSION.SDK_INT >= 28) candidate.longVersionCode else candidate.versionCode.toLong()
    val installedCode = if (Build.VERSION.SDK_INT >= 28) installed.longVersionCode else installed.versionCode.toLong()
    val expected = installed.signatures?.map { it.toCharsString() }?.toSet() ?: emptySet()
    val actual = candidate.signatures?.map { it.toCharsString() }?.toSet() ?: emptySet()
    UpdatePolicy.validateCandidate(installed.packageName, candidate.packageName,
      installed.versionName ?: "", candidate.versionName ?: "", expectedVersion,
      installedCode, candidateCode, expected, actual)
    // Archive metadata checks are defense in depth. Android's package installer
    // verifies APK content signatures and update compatibility before installing.
  }
}