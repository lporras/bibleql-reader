import { describe, it, expect } from "vitest";
import { AI_REPORT_FORM, MAX_REPORT_URL_LENGTH, buildAiReportUrl } from "./aiReport";

function fields(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe("buildAiReportUrl", () => {
  it("prefills the question, response and locale on the https form", () => {
    const url = buildAiReportUrl({ question: "Who was Ruth?", response: "Ruth was a Moabite.", locale: "en" });
    expect(url.startsWith(`${AI_REPORT_FORM.url}?`)).toBe(true);
    const p = fields(url);
    expect(p.get("usp")).toBe("pp_url");
    expect(p.get(AI_REPORT_FORM.question)).toBe("Who was Ruth?");
    expect(p.get(AI_REPORT_FORM.response)).toBe("Ruth was a Moabite.");
    expect(p.get(AI_REPORT_FORM.locale)).toBe("en");
  });

  it("round-trips accents, newlines and reserved characters", () => {
    const response = "Juan 3:16 — «Porque de tal manera amó Dios al mundo»\n\nVer también 1 Juan 4:9 & Romanos 5:8?";
    const p = fields(buildAiReportUrl({ question: "¿Qué dice?", response, locale: "es" }));
    expect(p.get(AI_REPORT_FORM.question)).toBe("¿Qué dice?");
    expect(p.get(AI_REPORT_FORM.response)).toBe(response);
  });

  it("cuts a long response to fit the URL limit and marks the cut", () => {
    const response = "ñ ".repeat(3000);
    const url = buildAiReportUrl({ question: "q", response, locale: "es" });
    expect(url.length).toBeLessThanOrEqual(MAX_REPORT_URL_LENGTH);
    const sent = fields(url).get(AI_REPORT_FORM.response) ?? "";
    expect(sent.endsWith("…")).toBe(true);
    expect(sent.length).toBeGreaterThan(100);
  });

  it("caps a long question so the response keeps most of the room", () => {
    const url = buildAiReportUrl({ question: "a".repeat(5000), response: "short", locale: "en" });
    expect(url.length).toBeLessThanOrEqual(MAX_REPORT_URL_LENGTH);
    expect(fields(url).get(AI_REPORT_FORM.question)).toHaveLength(301);
    expect(fields(url).get(AI_REPORT_FORM.response)).toBe("short");
  });
});
