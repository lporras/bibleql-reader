// swift-tools-version:6.0
// 6.0 for `.macOS(.v15)`; the code itself stays in the Swift 5 language mode.

import PackageDescription

// The part of the plugin that talks to Foundation Models, shared by the iOS
// plugin (../ios) and the macOS bridge (../macos), which only adapt how events
// reach the webview.
let package = Package(
  name: "AppleAssistantCore",
  platforms: [
    .iOS(.v15),
    .macOS(.v15)
  ],
  products: [
    .library(name: "AppleAssistantCore", targets: ["AppleAssistantCore"])
  ],
  targets: [
    .target(name: "AppleAssistantCore", path: "Sources/AppleAssistantCore")
  ],
  swiftLanguageModes: [.v5]
)
