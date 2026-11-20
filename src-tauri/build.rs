fn main() {
    // Foundation Models (plugins/tauri-plugin-appleai) exists only on macOS 26+,
    // and the app still runs on 15: weak-link it, or dyld refuses to launch the
    // app on an older macOS. The plugin checks for it with #available. (iOS does
    // the same in gen/apple/project.yml.) Read at build time: the target, not the host.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        println!("cargo:rustc-link-arg=-Wl,-weak_framework,FoundationModels");
        // The plugin's Swift references the Swift runtime as @rpath/libswift*.dylib;
        // since macOS 12 that runtime ships in the OS, at /usr/lib/swift. Without
        // this rpath dyld can't find it and the app aborts at launch.
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
    }
    tauri_build::build()
}
