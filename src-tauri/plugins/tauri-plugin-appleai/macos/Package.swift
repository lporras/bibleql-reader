// swift-tools-version:6.0

import PackageDescription

// macOS: desktop Tauri has no Swift plugin host, so build.rs compiles this with
// swift-rs and links it into the app. It exports plain C functions (src/lib.rs
// declares them) over the shared core.
let package = Package(
  name: "AppleAIMac",
  platforms: [
    .macOS(.v15)
  ],
  products: [
    .library(name: "AppleAIMac", type: .static, targets: ["AppleAIMac"])
  ],
  dependencies: [
    .package(path: "../core")
  ],
  targets: [
    .target(
      name: "AppleAIMac",
      dependencies: [.product(name: "AppleAssistantCore", package: "core")],
      path: "Sources/AppleAIMac")
  ],
  swiftLanguageModes: [.v5]
)
