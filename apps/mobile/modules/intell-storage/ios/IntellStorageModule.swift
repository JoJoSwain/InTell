import ExpoModulesCore

public class IntellStorageModule: Module {
  public func definition() -> ModuleDefinition {
    Name("IntellStorage")

    Function("progressDirectory") { () -> String in
      applicationSupport().path
    }

    Function("ensureExcludedDirectory") { (name: String) throws -> String in
      let directory = applicationSupport().appendingPathComponent(name, isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      var mutable = directory
      try mutable.setResourceValues(values)
      return directory.path
    }
  }

  private func applicationSupport() -> URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
    return base
  }
}
