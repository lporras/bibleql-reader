import type { InstallationAuth } from "./installation";

// The BibleQL transport, with its dependencies injected so the auth retry
// and error mapping are unit-tested without a network (graphqlClient.test.ts).
// lib/graphql.ts wires the real one.

export type GraphQLErrorCode =
  | "UNAUTHENTICATED"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "NETWORK"
  | "BAD_RESPONSE"
  | (string & {});

export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    readonly code?: GraphQLErrorCode,
    /** Seconds, on RATE_LIMITED. */
    readonly retryAfter?: number
  ) {
    super(message);
    this.name = "GraphQLRequestError";
  }
}

/** Sent by the server, in the top-level `extensions`, to a deprecated key. */
export interface UpdateNotice {
  message: string;
  updateUrl: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string; retryAfter?: number } }[];
  extensions?: { updateRequired?: boolean; message?: string; updateUrl?: string };
}

export interface GraphQLClientOptions {
  endpoint: string;
  fetch: typeof fetch;
  appVersion: string;
  timeoutMs: number;
  onUpdateRequired?(notice: UpdateNotice): void;
}

export interface GraphQLClient {
  /** No Authorization header — only `registerInstallation` is allowed this way. */
  anonymous<T>(query: string, variables?: Record<string, unknown>): Promise<T>;
  /** With the installation token; on a rejected token, registers again and retries once. */
  authenticated<T>(auth: InstallationAuth, query: string, variables?: Record<string, unknown>): Promise<T>;
}

const DEFAULT_UPDATE_MESSAGE = "This version of the app is out of date. Please update to keep using BibleQL.";
const DEFAULT_UPDATE_URL = "https://github.com/lporras/bibleql-reader/releases";

export function createGraphQLClient(options: GraphQLClientOptions): GraphQLClient {
  const { endpoint, appVersion, timeoutMs, onUpdateRequired } = options;

  async function send<T>(query: string, variables: Record<string, unknown> | undefined, token: string | null): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json", "X-App-Version": appVersion };
    if (token) headers.Authorization = `Bearer ${token}`;

    // A stalled request would otherwise leave its query pending forever (fetch
    // has no timeout of its own), and TanStack Query only retries on failure.
    // Aborting turns the stall into an error it can retry. AbortController +
    // setTimeout rather than AbortSignal.timeout(), which older WKWebView lacks.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await options.fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables: variables ?? {} }),
        signal: controller.signal
      });
    } catch {
      throw new GraphQLRequestError(
        controller.signal.aborted
          ? `The request to ${endpoint} got no reply within ${timeoutMs / 1000}s. Try again in a moment.`
          : `The request to ${endpoint} failed before a reply came back — a server error, a rate limit, or a blocked cross-origin request. Try again in a moment.`,
        "NETWORK"
      );
    } finally {
      clearTimeout(timer);
    }

    const json: GraphQLResponse<T> | null = await res.json().catch(() => null);
    const first = json?.errors?.[0];

    if (res.status === 401) {
      throw new GraphQLRequestError(first?.message ?? "The API key was rejected (401).", "UNAUTHENTICATED");
    }
    if (res.status === 403) {
      throw new GraphQLRequestError(first?.message ?? "The API key was rejected (403).", "FORBIDDEN");
    }
    if (res.status === 429) {
      const header = Number(res.headers.get("Retry-After"));
      const retryAfter = first?.extensions?.retryAfter ?? (Number.isFinite(header) && header > 0 ? header : undefined);
      throw new GraphQLRequestError(
        first?.message ?? "BibleQL's rate limit was reached. Try again later.",
        "RATE_LIMITED",
        retryAfter
      );
    }
    if (!json) throw new GraphQLRequestError("The API returned a response that was not JSON.", "BAD_RESPONSE");

    if (json.extensions?.updateRequired) {
      onUpdateRequired?.({
        message: json.extensions.message || DEFAULT_UPDATE_MESSAGE,
        updateUrl: json.extensions.updateUrl || DEFAULT_UPDATE_URL
      });
    }

    if (first) throw new GraphQLRequestError(first.message, first.extensions?.code, first.extensions?.retryAfter);
    return json.data as T;
  }

  return {
    anonymous: (query, variables) => send(query, variables, null),

    async authenticated<T>(auth: InstallationAuth, query: string, variables?: Record<string, unknown>): Promise<T> {
      const token = await auth.getToken();
      try {
        return await send<T>(query, variables, token);
      } catch (err) {
        if (!(err instanceof GraphQLRequestError) || err.code !== "UNAUTHENTICATED") throw err;
        // Revoked or invalid: register again and retry exactly once. A
        // second rejection propagates rather than looping.
        return send<T>(query, variables, await auth.refreshToken(token));
      }
    }
  };
}
