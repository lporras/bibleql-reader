import { describe, expect, it, vi } from "vitest";
import { createGraphQLClient, GraphQLRequestError, type GraphQLClientOptions } from "./graphqlClient";
import type { InstallationAuth } from "./installation";

// Every response is canned: the injected fetch never touches a network.
function reply(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function setup(responses: Response[], options: Partial<GraphQLClientOptions> = {}) {
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const next = responses.shift();
    if (!next) throw new Error("no more canned responses");
    return next;
  });
  const client = createGraphQLClient({
    endpoint: "https://bibleql.test/graphql",
    fetch: fetch as unknown as typeof globalThis.fetch,
    appVersion: "1.2.3",
    timeoutMs: 1000,
    ...options
  });
  const auth: InstallationAuth = {
    getToken: vi.fn(async () => "old"),
    refreshToken: vi.fn(async () => "new")
  };
  const headersOf = (call: number) => fetch.mock.calls[call][1]?.headers as Record<string, string>;
  return { client, auth, fetch, headersOf };
}

const UNAUTHENTICATED = { errors: [{ message: "Invalid or missing API key", extensions: { code: "UNAUTHENTICATED" } }] };

describe("createGraphQLClient", () => {
  it("sends the installation token and the app version", async () => {
    const { client, auth, headersOf } = setup([reply(200, { data: { ok: 1 } })]);

    await expect(client.authenticated(auth, "query { ok }")).resolves.toEqual({ ok: 1 });
    expect(headersOf(0).Authorization).toBe("Bearer old");
    expect(headersOf(0)["X-App-Version"]).toBe("1.2.3");
  });

  it("sends no Authorization header on an anonymous request", async () => {
    const { client, headersOf } = setup([reply(200, { data: { registerInstallation: { token: "t" } } })]);

    await client.anonymous("mutation { registerInstallation }");
    expect(headersOf(0).Authorization).toBeUndefined();
  });

  it("re-registers and retries exactly once after a 401", async () => {
    const { client, auth, fetch, headersOf } = setup([reply(401, UNAUTHENTICATED), reply(200, { data: { ok: 1 } })]);

    await expect(client.authenticated(auth, "query { ok }")).resolves.toEqual({ ok: 1 });
    expect(auth.refreshToken).toHaveBeenCalledWith("old");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(headersOf(1).Authorization).toBe("Bearer new");
  });

  it("gives up after a second 401 instead of looping", async () => {
    const { client, auth, fetch } = setup([reply(401, UNAUTHENTICATED), reply(401, UNAUTHENTICATED)]);

    const err = await client.authenticated(auth, "query { ok }").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GraphQLRequestError);
    expect((err as GraphQLRequestError).code).toBe("UNAUTHENTICATED");
    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("maps a 429 to RATE_LIMITED with its retryAfter, without re-registering", async () => {
    const body = { errors: [{ message: "Daily request limit of 1000 exceeded", extensions: { code: "RATE_LIMITED", retryAfter: 42 } }] };
    const { client, auth } = setup([reply(429, body, { "Retry-After": "42" })]);

    const err = (await client.authenticated(auth, "query { ok }").catch((e: unknown) => e)) as GraphQLRequestError;
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryAfter).toBe(42);
    expect(err.message).toContain("Daily request limit");
    expect(auth.refreshToken).not.toHaveBeenCalled();
  });

  it("reads retryAfter from the header when the body has none", async () => {
    const { client, auth } = setup([new Response("Too Many Requests", { status: 429, headers: { "Retry-After": "30" } })]);

    const err = (await client.authenticated(auth, "query { ok }").catch((e: unknown) => e)) as GraphQLRequestError;
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryAfter).toBe(30);
  });

  it("reports updateRequired from the response extensions", async () => {
    const onUpdateRequired = vi.fn();
    const body = {
      data: { ok: 1 },
      extensions: { updateRequired: true, message: "Please update", updateUrl: "https://example.org/releases" }
    };
    const { client, auth } = setup([reply(200, body)], { onUpdateRequired });

    await expect(client.authenticated(auth, "query { ok }")).resolves.toEqual({ ok: 1 });
    expect(onUpdateRequired).toHaveBeenCalledWith({ message: "Please update", updateUrl: "https://example.org/releases" });
  });

  it("carries a GraphQL error's code through", async () => {
    const body = { errors: [{ message: "Query is blank", extensions: { code: "INVALID_INPUT" } }] };
    const { client, auth } = setup([reply(200, body)]);

    const err = (await client.authenticated(auth, "query { ok }").catch((e: unknown) => e)) as GraphQLRequestError;
    expect(err.message).toBe("Query is blank");
    expect(err.code).toBe("INVALID_INPUT");
  });

  it("turns a network failure into a NETWORK error", async () => {
    const { client, auth } = setup([]);

    const err = (await client.authenticated(auth, "query { ok }").catch((e: unknown) => e)) as GraphQLRequestError;
    expect(err.code).toBe("NETWORK");
  });
});
