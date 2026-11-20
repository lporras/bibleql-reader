import AppleAssistantCore
import Foundation

// The C ABI src/lib.rs calls. Strings go both ways as NUL-terminated UTF-8, and
// every result comes back through `callback` with the caller's `context`, so no
// memory allocated here is ever freed on the Rust side or vice versa.

public typealias AppleAICallback = @convention(c) (UnsafeMutableRawPointer?, UnsafePointer<CChar>) -> Void

/// Calls `callback` once, before returning, with the availability code.
@_cdecl("appleai_availability")
public func appleaiAvailability(
  _ locale: UnsafePointer<CChar>,
  _ context: UnsafeMutableRawPointer?,
  _ callback: AppleAICallback
) {
  let status = AppleAssistant.availability(locale: String(cString: locale))
  status.withCString { callback(context, $0) }
}

/// Returns at once. `callback` gets each event's JSON from a background thread,
/// and the last call is always a `completed` or `failed` event.
@_cdecl("appleai_respond")
public func appleaiRespond(
  _ instructions: UnsafePointer<CChar>,
  _ prompt: UnsafePointer<CChar>,
  _ context: UnsafeMutableRawPointer?,
  _ callback: AppleAICallback
) {
  // A raw pointer isn't Sendable; the Rust side owns what it points to until
  // the final event, so carrying its address across is safe.
  let address = UInt(bitPattern: context)
  AppleAssistant.respond(
    instructions: String(cString: instructions),
    prompt: String(cString: prompt)
  ) { event in
    event.withCString { callback(UnsafeMutableRawPointer(bitPattern: address), $0) }
  }
}
