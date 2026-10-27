import Foundation
import QuickLook
import SwiftRs
import Tauri
import UIKit

struct PreviewArgs: Decodable {
  let path: String
}

class QuickLookPlugin: Plugin, QLPreviewControllerDataSource {
  private var item: URL?

  @objc public func preview(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PreviewArgs.self)
    guard let source = Self.fileURL(args.path) else {
      invoke.reject("Not a file path: \(args.path)")
      return
    }

    // The save dialog returns wherever the user put the file in Files, which
    // can be outside the app's sandbox and readable only under its security
    // scope. Quick Look reads lazily, after this call returns, so preview a
    // private copy rather than holding the scope open for as long as it shows.
    let scoped = source.startAccessingSecurityScopedResource()
    defer { if scoped { source.stopAccessingSecurityScopedResource() } }
    let copy = FileManager.default.temporaryDirectory.appendingPathComponent(source.lastPathComponent)
    do {
      try? FileManager.default.removeItem(at: copy)
      try FileManager.default.copyItem(at: source, to: copy)
    } catch {
      invoke.reject("Couldn't read \(source.lastPathComponent): \(error.localizedDescription)")
      return
    }
    item = copy

    DispatchQueue.main.async {
      let controller = QLPreviewController()
      controller.dataSource = self
      self.manager.viewController?.present(controller, animated: true)
      invoke.resolve()
    }
  }

  // Accepts a file:// URL (what the iOS save dialog returns) or a plain path.
  private static func fileURL(_ path: String) -> URL? {
    if path.hasPrefix("file:") {
      return URL(string: path)
        ?? URL(fileURLWithPath: String(path.dropFirst("file://".count)).removingPercentEncoding ?? path)
    }
    return URL(fileURLWithPath: path)
  }

  func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
    item == nil ? 0 : 1
  }

  func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
    item! as NSURL
  }
}

@_cdecl("init_plugin_quicklook")
func initPlugin() -> Plugin {
  return QuickLookPlugin()
}
