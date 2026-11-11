// Google Play's AI-Generated Content policy requires a way to report
// offensive AI output from inside the app. The Assistant's "Report" action
// opens this Google Form in the system browser, prefilled with the exchange
// being reported; the user picks a reason and submits it there. Nothing is
// sent from the app itself.
//
// The entry ids come from the form's "Pre-fill form" link — recreate the
// form and they change.
export const AI_REPORT_FORM = {
  url: "https://docs.google.com/forms/d/e/1FAIpQLSeIvJlMw1pmmOxueU4DZET5QbLEd8fiCFVfOZD-k_aQcmXVCw/viewform",
  question: "entry.292224901",
  response: "entry.1167945072",
  locale: "entry.2124557561",
};

/** Prefill travels in a GET query string; past ~2,000 characters some browsers and servers balk. */
export const MAX_REPORT_URL_LENGTH = 1800;
const QUESTION_BUDGET = 300;

interface ReportArgs {
  question: string;
  response: string;
  locale: string;
}

function clip(text: string, length: number): string {
  return text.length <= length ? text : `${text.slice(0, Math.max(0, length)).trimEnd()}…`;
}

function build(question: string, response: string, locale: string): string {
  const params = new URLSearchParams({
    usp: "pp_url",
    [AI_REPORT_FORM.question]: question,
    [AI_REPORT_FORM.response]: response,
    [AI_REPORT_FORM.locale]: locale,
  });
  return `${AI_REPORT_FORM.url}?${params}`;
}

/**
 * The prefilled form URL for one question/answer pair. The question gets a
 * small fixed budget; the response is cut to whatever fits under
 * MAX_REPORT_URL_LENGTH once encoded (accents and newlines encode to
 * several characters, so the cut is found by search, not arithmetic).
 */
export function buildAiReportUrl({ question, response, locale }: ReportArgs): string {
  const q = clip(question.trim(), QUESTION_BUDGET);
  const r = response.trim();
  const full = build(q, r, locale);
  if (full.length <= MAX_REPORT_URL_LENGTH) return full;

  let lo = 0;
  let hi = r.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (build(q, clip(r, mid), locale).length <= MAX_REPORT_URL_LENGTH) lo = mid;
    else hi = mid - 1;
  }
  return build(q, clip(r, lo), locale);
}
