package com.youyou.taurinotes

import android.app.Activity
import android.content.Intent
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File

@InvokeArg
class ShareLibraryArgs {
  var path: String = ""
  var mime: String = "application/octet-stream"
}

@TauriPlugin
class SharePlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun shareFile(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(ShareLibraryArgs::class.java)
      val source = File(args.path)
      if (!source.isFile) {
        invoke.reject("知识库文件不存在")
        return
      }
      val sharedDir = File(activity.cacheDir, "shared").apply { mkdirs() }
      val target = File(sharedDir, source.name)
      source.copyTo(target, overwrite = true)
      val uri = FileProvider.getUriForFile(
        activity,
        "${activity.packageName}.fileprovider",
        target,
      )
      val intent = Intent(Intent.ACTION_SEND).apply {
        type = args.mime
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      activity.startActivity(Intent.createChooser(intent, "分享知识库"))
      invoke.resolve(JSObject())
    } catch (error: Exception) {
      invoke.reject(error.message ?: "分享失败")
    }
  }
}