import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

// Apple Intelligence's on-device model, through the Foundation Models framework
// (iOS/iPadOS/macOS 26+). The app's deployment targets are lower, so every use
// is behind `canImport` (an older SDK) and `#available` (an older OS), and the
// framework is weak-linked by the app (see docs/apple-intelligence.md).
//
// Nothing here leaves the device: the framework gives third-party apps only the
// on-device model, never Private Cloud Compute.
//
// Events reach the caller as JSON strings, the same shape on iOS and macOS:
//   {"type":"partial","answer":"…","references":[{"ref":"…","why":"…"}]}
//   {"type":"completed"}
//   {"type":"failed","code":"…","message":"…"}
// Exactly one `completed` or `failed` ends every reply.
public enum AppleAssistant {
  /// One of: available, deviceNotEligible, appleIntelligenceNotEnabled,
  /// modelNotReady, unsupportedLocale, unsupportedOS, unavailable.
  public static func availability(locale: String) -> String {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, macOS 26.0, *) {
      let model = SystemLanguageModel.default
      switch model.availability {
      case .available:
        return model.supportsLocale(Locale(identifier: locale)) ? "available" : "unsupportedLocale"
      case .unavailable(.deviceNotEligible):
        return "deviceNotEligible"
      case .unavailable(.appleIntelligenceNotEnabled):
        return "appleIntelligenceNotEnabled"
      case .unavailable(.modelNotReady):
        return "modelNotReady"
      default:
        return "unavailable"
      }
    }
    #endif
    return "unsupportedOS"
  }

  /// Streams one reply. Returns at once; `onEvent` is called from a background task.
  public static func respond(instructions: String, prompt: String, onEvent: @escaping @Sendable (String) -> Void) {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, macOS 26.0, *) {
      Task.detached {
        await stream(instructions: instructions, prompt: prompt, onEvent: onEvent)
      }
      return
    }
    #endif
    onEvent(failed("unsupportedOS", nil))
  }

  static func failed(_ code: String, _ message: String?) -> String {
    var event: [String: Any] = ["type": "failed", "code": code]
    if let message { event["message"] = message }
    return json(event)
  }

  static func json(_ object: [String: Any]) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: object),
          let text = String(data: data, encoding: .utf8)
    else { return #"{"type":"failed","code":"unknown"}"# }
    return text
  }
}

#if canImport(FoundationModels)

// The reply's shape, enforced by guided generation: the model can't return
// anything else, so there's no JSON to parse or repair (compare the ChatGPT
// route in src/lib/ai.ts). Properties generate in declaration order, so
// the answer streams first, as on the other providers.
//
// The schema, names included, is shown to the model, so it's all Spanish and
// gives no example reference, for the same reasons as the instructions
// (buildAppleInstructions in src/lib/ai.ts): English invited refusals and leaked
// English words into Spanish answers ("fulfillment", "Zechariah"), and an
// example got copied into every answer. `partial` maps the fields back to the
// `answer`/`references`/`ref`/`why` the webview expects.
@available(iOS 26.0, macOS 26.0, *)
@Generable
struct GeneratedAnswer {
  // Paragraphs, not one string: in a guided string a blank line ends the
  // field, so a one-string answer stopped wherever the model began its second
  // paragraph or a list ("…these are the main ones:" and nothing after).
  @Guide(description: "La respuesta completa, un párrafo o un elemento de lista por entrada.", .count(1...6))
  var parrafos: [String]

  @Guide(description: "Pasajes bíblicos que respaldan la respuesta.", .count(2...5))
  var referencias: [GeneratedReference]
}

@available(iOS 26.0, macOS 26.0, *)
@Generable
struct GeneratedReference {
  @Guide(description: "Un solo pasaje: libro, capítulo y versículos, con el nombre completo del libro en el idioma de la respuesta, sin abreviar.")
  var cita: String

  @Guide(description: "Una sola frase corta y completa sobre por qué este pasaje es relevante, en el idioma de la respuesta.")
  var motivo: String
}

@available(iOS 26.0, macOS 26.0, *)
extension AppleAssistant {
  static func stream(instructions: String, prompt: String, onEvent: @Sendable (String) -> Void, attempt: Int = 1) async {
    let session = LanguageModelSession(instructions: instructions)
    var started = false
    do {
      let replies = session.streamResponse(to: prompt, generating: GeneratedAnswer.self)
      for try await snapshot in replies {
        started = true
        onEvent(partial(snapshot.content))
      }
      onEvent(json(["type": "completed"]))
    } catch let error as LanguageModelSession.GenerationError {
      // Refusals of harmless Bible questions come and go between identical
      // requests (docs/apple-intelligence.md). One that arrives before any
      // words is retried once, in a fresh session, before it reaches the reader.
      let retryable = code(error) == "refusal" || code(error) == "guardrailViolation"
      if retryable && !started && attempt == 1 {
        await stream(instructions: instructions, prompt: prompt, onEvent: onEvent, attempt: 2)
        return
      }
      onEvent(failed(code(error), error.localizedDescription))
    } catch is CancellationError {
      onEvent(failed("cancelled", nil))
    } catch {
      onEvent(failed("unknown", error.localizedDescription))
    }
  }

  static func partial(_ answer: GeneratedAnswer.PartiallyGenerated) -> String {
    // A reference counts once its `ref` is there; the webview drops the rest.
    let references: [[String: String]] = (answer.referencias ?? []).compactMap { reference in
      guard let ref = reference.cita else { return nil }
      var entry = ["ref": ref]
      if let why = reference.motivo { entry["why"] = why }
      return entry
    }
    return json(["type": "partial", "answer": joined(answer.parrafos ?? []), "references": references])
  }

  /// The paragraphs as the text the webview renders (src/lib/aiText.ts): a
  /// blank line between paragraphs, a single newline between list items.
  static func joined(_ paragraphs: [String]) -> String {
    let parts = paragraphs.map(tidy).filter { !$0.isEmpty }
    var text = ""
    for (index, part) in parts.enumerated() {
      if index > 0 { text += isListItem(parts[index - 1]) && isListItem(part) ? "\n" : "\n\n" }
      text += part
    }
    return text
  }

  /// Trims a paragraph and drops bold markers that don't pair up: the model
  /// sometimes ends a paragraph with a stray "**", which would show as is.
  static func tidy(_ paragraph: String) -> String {
    let text = paragraph.trimmingCharacters(in: .whitespacesAndNewlines)
    let pairs = text.components(separatedBy: "**").count - 1
    return pairs % 2 == 0 ? text : text.replacingOccurrences(of: "**", with: "")
  }

  static func isListItem(_ line: String) -> Bool {
    line.range(of: #"^(\d{1,2}[.)]|[-*•])\s"#, options: .regularExpression) != nil
  }

  static func code(_ error: LanguageModelSession.GenerationError) -> String {
    switch error {
    case .exceededContextWindowSize: return "exceededContextWindowSize"
    case .assetsUnavailable: return "assetsUnavailable"
    case .guardrailViolation: return "guardrailViolation"
    case .unsupportedLanguageOrLocale: return "unsupportedLanguageOrLocale"
    case .rateLimited: return "rateLimited"
    case .concurrentRequests: return "concurrentRequests"
    case .refusal: return "refusal"
    default: return "unknown"
    }
  }
}

#endif
