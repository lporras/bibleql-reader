import AppleAssistantCore
import Foundation
import SwiftRs
import Tauri

struct AvailabilityArgs: Decodable {
  let locale: String
}

struct RespondArgs: Decodable {
  let instructions: String
  let prompt: String
  let onEvent: Channel
}

class AppleAIPlugin: Plugin {
  @objc public func availability(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(AvailabilityArgs.self)
    invoke.resolve(["status": AppleAssistant.availability(locale: args.locale)])
  }

  /// Resolves once the request is under way; the reply arrives on `onEvent`.
  @objc public func respond(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(RespondArgs.self)
    let channel = args.onEvent
    AppleAssistant.respond(instructions: args.instructions, prompt: args.prompt) { event in
      guard let data = event.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      else { return }
      channel.send(object.mapValues { $0 as Any? })
    }
    invoke.resolve()
  }
}

@_cdecl("init_plugin_appleai")
func initPlugin() -> Plugin {
  return AppleAIPlugin()
}
