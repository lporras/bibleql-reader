// swift-tools-version:6.0

import PackageDescription

let package = Package(
  name: "tauri-plugin-appleai",
  platforms: [
    .iOS(.v15)
  ],
  products: [
    .library(
      name: "tauri-plugin-appleai",
      type: .static,
      targets: ["tauri-plugin-appleai"])
  ],
  dependencies: [
    // Populated by tauri-plugin's build script with the Tauri iOS API.
    .package(name: "Tauri", path: "../.tauri/tauri-api"),
    .package(path: "../core")
  ],
  targets: [
    .target(
      name: "tauri-plugin-appleai",
      dependencies: [
        .byName(name: "Tauri"),
        .product(name: "AppleAssistantCore", package: "core")
      ],
      path: "Sources")
  ],
  swiftLanguageModes: [.v5]
)
