// swift-tools-version:5.3

import PackageDescription

let package = Package(
  name: "tauri-plugin-quicklook",
  platforms: [
    .iOS(.v13)
  ],
  products: [
    .library(
      name: "tauri-plugin-quicklook",
      type: .static,
      targets: ["tauri-plugin-quicklook"])
  ],
  dependencies: [
    // Populated by tauri-plugin's build script with the Tauri iOS API.
    .package(name: "Tauri", path: "../.tauri/tauri-api")
  ],
  targets: [
    .target(
      name: "tauri-plugin-quicklook",
      dependencies: [
        .byName(name: "Tauri")
      ],
      path: "Sources")
  ]
)
