package expo.modules.intellstorage

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class IntellStorageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("IntellStorage")

    Function("progressDirectory") {
      val directory = File(context.filesDir, "SQLite")
      directory.mkdirs()
      directory.absolutePath
    }

    // Android exclusion is the backup XML (domain "file"), not a file flag.
    // The same call still runs on every ensure so iOS can re-apply its flag (N2).
    Function("ensureExcludedDirectory") { name: String ->
      val directory = File(context.filesDir, name)
      directory.mkdirs()
      directory.absolutePath
    }
  }

  private val context
    get() = requireNotNull(appContext.reactContext)
}
