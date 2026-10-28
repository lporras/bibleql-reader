import { createGraphQLClient, GraphQLRequestError, type UpdateNotice } from "./graphqlClient";
import { createInstallationAuth } from "./installation";
import { installStore } from "../platform/install";
import { REGISTRATION_PLATFORM } from "../platform/host";

export { GraphQLRequestError, type UpdateNotice };

export const DEFAULT_ENDPOINT = "https://bibleql.org/graphql";

const REQUEST_TIMEOUT_MS = 15_000;

// Shown once, app-wide, when BibleQL says this build's key is deprecated
// (components/UpdateBanner.tsx). Outside React because every request can
// carry it, not just the ones made from components.
let updateNotice: UpdateNotice | null = null;
const updateListeners = new Set<() => void>();

export function subscribeUpdateNotice(listener: () => void): () => void {
  updateListeners.add(listener);
  return () => updateListeners.delete(listener);
}

export function getUpdateNotice(): UpdateNotice | null {
  return updateNotice;
}

const client = createGraphQLClient({
  endpoint: DEFAULT_ENDPOINT,
  // Looked up per call, so a test or the E2E suite's page.route sees it.
  fetch: (input, init) => fetch(input, init),
  appVersion: __APP_VERSION__,
  timeoutMs: REQUEST_TIMEOUT_MS,
  onUpdateRequired(notice) {
    if (updateNotice?.message === notice.message && updateNotice.updateUrl === notice.updateUrl) return;
    updateNotice = notice;
    updateListeners.forEach((listener) => listener());
  }
});

interface RegisterResponse {
  registerInstallation: { token: string };
}

// The server only accepts this unauthenticated, and only as the sole root
// field of the operation. The enum's GraphQL name is `PlatformEnum`; a wrong
// variable type fails validation before the resolver runs.
const REGISTER =
  "mutation($id:ID!,$p:PlatformEnum!,$v:String!){ registerInstallation(input:{installationId:$id, platform:$p, appVersion:$v}){ token } }";

const auth = createInstallationAuth(installStore, async (installationId) => {
  const data = await client.anonymous<RegisterResponse>(REGISTER, {
    id: installationId,
    p: REGISTRATION_PLATFORM,
    v: __APP_VERSION__
  });
  return data.registerInstallation.token;
});

/** Resolves once this installation has a token, registering if needed. */
export function ensureInstallToken(): Promise<unknown> {
  return auth.getToken();
}

export function gqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  return client.authenticated<T>(auth, query, variables);
}
