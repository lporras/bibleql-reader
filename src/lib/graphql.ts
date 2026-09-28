export const DEFAULT_ENDPOINT = "https://bibleql.org/graphql";

export class GraphQLRequestError extends Error {}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export const HAS_BIBLEQL_KEY = Boolean(__BIBLEQL_API_KEY__);

const REQUEST_TIMEOUT_MS = 15_000;

export async function gqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  endpoint: string = DEFAULT_ENDPOINT
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (__BIBLEQL_API_KEY__) headers.Authorization = `Bearer ${__BIBLEQL_API_KEY__}`;

  // A stalled request would otherwise leave its query pending forever (fetch
  // has no timeout of its own), and TanStack Query only retries on failure.
  // Aborting turns the stall into an error it can retry. AbortController +
  // setTimeout rather than AbortSignal.timeout(), which older WKWebView lacks.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables: variables ?? {} }),
      signal: controller.signal
    });
  } catch {
    throw new GraphQLRequestError(
      controller.signal.aborted
        ? `The request to ${endpoint} got no reply within ${REQUEST_TIMEOUT_MS / 1000}s. Try again in a moment.`
        : `The request to ${endpoint} failed before a reply came back — a server error, a rate limit, or a blocked cross-origin request. Try again in a moment.`
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    throw new GraphQLRequestError("The API key was rejected (401/403).");
  }

  const json: GraphQLResponse<T> | null = await res.json().catch(() => null);
  if (!json) throw new GraphQLRequestError("The API returned a response that was not JSON.");
  if (json.errors?.length) throw new GraphQLRequestError(json.errors[0].message);
  return json.data as T;
}
