//! Sign in with ChatGPT — see docs/chatgpt-sign-in.md.
//!
//! OpenAI's open-source flow: OAuth 2 + OIDC with PKCE, a public client, and a
//! loopback redirect. Everything that touches a token happens here, and none of
//! them is ever returned to the webview. Commands fail with a stable code from
//! the list in src/platform/chatgpt.ts, never with a provider's response.

use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::URL_SAFE_NO_PAD as BASE64URL;
use base64::Engine;
use ring::rand::{SecureRandom, SystemRandom};
use ring::signature::{RsaPublicKeyComponents, RSA_PKCS1_2048_8192_SHA256};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_http::reqwest;
use tauri_plugin_opener::OpenerExt;

use crate::secret_store::{read_record, select_record_store, write_record, CmdResult, SecretStore, SecretStores};

const AUTHORIZE_URL: &str = "https://auth.openai.com/api/accounts/authorize";
const TOKEN_URL: &str = "https://auth.openai.com/api/accounts/oauth/token";
const DISCOVERY_URL: &str = "https://auth.openai.com/.well-known/openid-configuration";
const ISSUER: &str = "https://auth.openai.com";
const RESOURCE: &str = "https://api.openai.com/v1";
const SCOPES: &str = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
/// Without this scope the sign-in is valid but can't use the ChatGPT plan.
const DIRECT_SCOPE: &str = "chatgpt.tokens.use.direct";
const DYNAMIC_CLIENT: &str = "dynamic_agent_client";
const APP_NAME: &str = "BibleQL Reader";
const CALLBACK_PATH: &str = "/auth/callback";

const RECORD: &str = "chatgpt";
const FALLBACK_FILE: &str = "chatgpt.json";

const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const HTTP_TIMEOUT: Duration = Duration::from_secs(30);
/// Refresh this long before the access token actually expires.
const REFRESH_MARGIN_SECS: u64 = 120;
/// ID token clock skew allowance.
const LEEWAY_SECS: u64 = 60;
const REVOKE_ATTEMPTS: u32 = 3;

// ---------------------------------------------------------------------------
// The stored record

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct Registration {
    client_id: String,
    email: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct Session {
    sub: String,
    client_id: String,
    email: Option<String>,
    name: Option<String>,
    access_token: String,
    refresh_token: String,
    expires_at: u64,
    scopes: Vec<String>,
}

/// One active account, plus what later sign-ins need. A `client_id` is bound to
/// one user and workspace, so each account keeps its own and they never mix.
/// Everything but the session and the ID token survives signing out.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
struct Record {
    /// `ext_agent_host_id`: generated once per install.
    host_id: String,
    /// The registration "Continue with ChatGPT" reauthorizes.
    last_client_id: Option<String>,
    /// By `sub`.
    registrations: BTreeMap<String, Registration>,
    /// For `id_token_hint`. Kept when a refresh dies, dropped on sign-out.
    id_token: Option<String>,
    session: Option<Session>,
}

impl Record {
    fn registered_sub(&self, client_id: &str) -> Option<&str> {
        self.registrations.iter().find(|(_, r)| r.client_id == client_id).map(|(sub, _)| sub.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    sub: String,
    email: Option<String>,
    name: Option<String>,
    plan_enabled: bool,
}

fn account_of(session: &Session) -> Account {
    Account {
        sub: session.sub.clone(),
        email: session.email.clone(),
        name: session.name.clone(),
        plan_enabled: session.scopes.iter().any(|s| s == DIRECT_SCOPE),
    }
}

/// An unreadable record is an error, not an empty one: saving over it would
/// lose the registrations.
fn load(store: &dyn SecretStore) -> CmdResult<Record> {
    let mut record = match read_record(store, RECORD).map_err(|_| "storage".to_owned())? {
        Some(json) => serde_json::from_str::<Record>(&json).map_err(|_| "storage".to_owned())?,
        None => Record::default(),
    };
    if record.host_id.is_empty() {
        record.host_id = format!("urn:uuid:{}", uuid::Uuid::new_v4());
        save(store, &record)?;
    }
    Ok(record)
}

fn save(store: &dyn SecretStore, record: &Record) -> CmdResult<()> {
    let json = serde_json::to_string(record).map_err(|_| "storage".to_owned())?;
    write_record(store, RECORD, &json).map_err(|_| "storage".to_owned())
}

// ---------------------------------------------------------------------------
// The authorization request

fn random_token() -> CmdResult<String> {
    let mut bytes = [0u8; 32];
    SystemRandom::new().fill(&mut bytes).map_err(|_| "random".to_owned())?;
    Ok(BASE64URL.encode(bytes))
}

fn pkce_challenge(verifier: &str) -> String {
    BASE64URL.encode(Sha256::digest(verifier.as_bytes()))
}

/// One sign-in attempt. `client_id` is `None` for a new registration.
struct Attempt {
    client_id: Option<String>,
    verifier: String,
    state: String,
    nonce: String,
}

fn redirect_uri(port: u16) -> String {
    format!("http://127.0.0.1:{port}{CALLBACK_PATH}")
}

fn authorize_url(attempt: &Attempt, record: &Record, port: u16) -> CmdResult<String> {
    let challenge = pkce_challenge(&attempt.verifier);
    let redirect = redirect_uri(port);
    let mut params = vec![
        ("response_type", "code"),
        ("ext_agent_host_id", record.host_id.as_str()),
        ("redirect_uri", redirect.as_str()),
        ("scope", SCOPES),
        ("resource", RESOURCE),
        ("state", attempt.state.as_str()),
        ("nonce", attempt.nonce.as_str()),
        ("code_challenge_method", "S256"),
        ("code_challenge", challenge.as_str()),
    ];
    match &attempt.client_id {
        None => {
            params.push(("client_id", DYNAMIC_CLIENT));
            params.push(("agent_name_hint", APP_NAME));
        }
        Some(client_id) => {
            params.push(("client_id", client_id));
            if let Some(hint) = &record.id_token {
                params.push(("id_token_hint", hint));
            }
            let email = record.registered_sub(client_id).and_then(|sub| record.registrations[sub].email.as_deref());
            if let Some(email) = email {
                params.push(("login_hint", email));
            }
        }
    }
    url::Url::parse_with_params(AUTHORIZE_URL, &params).map(String::from).map_err(|_| "oauth_error".to_owned())
}

// ---------------------------------------------------------------------------
// The callback

#[derive(Debug, PartialEq)]
struct Callback {
    code: String,
    client_id: String,
    scope: Option<String>,
}

#[derive(Debug, PartialEq)]
enum Request {
    /// Not for this attempt: a favicon, a port scan, a stale browser tab. An
    /// attempt only ends on a callback carrying its own `state`, so that nothing
    /// else able to reach the port can end it.
    Ignored,
    Finished(CmdResult<Callback>),
}

/// `request_target` is the path and query from the request line.
fn parse_callback(request_target: &str, attempt: &Attempt) -> Request {
    let Ok(url) = url::Url::parse(&format!("http://127.0.0.1{request_target}")) else {
        return Request::Ignored;
    };
    if url.path() != CALLBACK_PATH {
        return Request::Ignored;
    }
    let params: BTreeMap<String, String> = url.query_pairs().into_owned().collect();
    if params.get("state") != Some(&attempt.state) {
        return Request::Ignored;
    }
    Request::Finished(finish_callback(&params, attempt))
}

fn finish_callback(params: &BTreeMap<String, String>, attempt: &Attempt) -> CmdResult<Callback> {
    if let Some(error) = params.get("error") {
        return Err(if error == "access_denied" { "access_denied" } else { "oauth_error" }.to_owned());
    }
    let issued = params.get("client_id").filter(|id| !id.is_empty());
    let client_id = match (&attempt.client_id, issued) {
        (Some(expected), Some(issued)) if expected != issued => return Err("account_mismatch".to_owned()),
        (Some(expected), _) => expected.clone(),
        (None, Some(issued)) if issued != DYNAMIC_CLIENT => issued.clone(),
        (None, _) => return Err("registration_incomplete".to_owned()),
    };
    let code = params.get("code").filter(|c| !c.is_empty()).ok_or_else(|| "oauth_error".to_owned())?;
    Ok(Callback { code: code.clone(), client_id, scope: params.get("scope").cloned() })
}

fn callback_page(locale: &str, denied: bool) -> String {
    let es = locale == "es";
    let message = match (es, denied) {
        (false, false) => "You can close this window and return to BibleQL Reader.",
        (false, true) => "Sign-in was cancelled. You can close this window.",
        (true, false) => "Puedes cerrar esta ventana y volver a BibleQL Reader.",
        (true, true) => "Se canceló el inicio de sesión. Puedes cerrar esta ventana.",
    };
    let lang = if es { "es" } else { "en" };
    format!(
        "<!doctype html><html lang=\"{lang}\"><meta charset=\"utf-8\"><title>{APP_NAME}</title>\
         <body style=\"font:16px system-ui;text-align:center;padding:3em\"><p>{message}</p></body></html>"
    )
}

fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let _ = write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
}

/// The request target of a GET, or `None` for anything else.
fn read_request_target(stream: &mut TcpStream) -> Option<String> {
    stream.set_nonblocking(false).ok()?;
    stream.set_read_timeout(Some(Duration::from_secs(2))).ok()?;
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 1024];
    while !buffer.windows(2).any(|w| w == b"\r\n") && buffer.len() < 16 * 1024 {
        let read = stream.read(&mut chunk).ok()?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
    }
    let text = String::from_utf8_lossy(&buffer);
    let mut parts = text.lines().next()?.split_whitespace();
    (parts.next()? == "GET").then(|| parts.next().map(str::to_owned)).flatten()
}

/// Polled rather than blocking on `accept`, so a cancel or the timeout ends it.
fn wait_for_callback(
    listener: &TcpListener,
    attempt: &Attempt,
    locale: &str,
    cancelled: &AtomicBool,
    timeout: Duration,
) -> CmdResult<Callback> {
    listener.set_nonblocking(true).map_err(|_| "oauth_error".to_owned())?;
    let deadline = Instant::now() + timeout;
    loop {
        if cancelled.load(Ordering::Relaxed) {
            return Err("cancelled".to_owned());
        }
        if Instant::now() >= deadline {
            return Err("timeout".to_owned());
        }
        let mut stream = match listener.accept() {
            Ok((stream, _)) => stream,
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(100));
                continue;
            }
            Err(_) => return Err("oauth_error".to_owned()),
        };
        let parsed = read_request_target(&mut stream).map(|target| parse_callback(&target, attempt));
        match parsed {
            Some(Request::Finished(result)) => {
                let denied = result.as_ref().err().is_some_and(|code| code == "access_denied");
                respond(&mut stream, "200 OK", &callback_page(locale, denied));
                return result;
            }
            _ => respond(&mut stream, "404 Not Found", ""),
        }
    }
}

// ---------------------------------------------------------------------------
// ID token validation

#[derive(Debug, Deserialize)]
struct Jwk {
    kid: Option<String>,
    kty: String,
    n: Option<String>,
    e: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Jwks {
    keys: Vec<Jwk>,
}

#[derive(Debug, Deserialize)]
struct JwtHeader {
    alg: String,
    kid: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum Audience {
    One(String),
    Many(Vec<String>),
}

#[derive(Debug, Deserialize)]
struct IdClaims {
    iss: String,
    aud: Audience,
    exp: u64,
    nonce: Option<String>,
    sub: String,
    email: Option<String>,
    name: Option<String>,
}

/// RS256 only, the one algorithm OpenAI's discovery document lists. The header's
/// `alg` selects nothing, so a token can't talk its way into `none` or HMAC.
fn verify_id_token(token: &str, jwks: &Jwks, client_id: &str, nonce: &str, now: u64) -> Result<IdClaims, ()> {
    let mut parts = token.split('.');
    let (Some(header), Some(payload), Some(signature), None) = (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err(());
    };
    let decode = |part: &str| BASE64URL.decode(part).map_err(|_| ());
    let parsed_header: JwtHeader = serde_json::from_slice(&decode(header)?).map_err(|_| ())?;
    if parsed_header.alg != "RS256" {
        return Err(());
    }
    let key = jwks.keys.iter().find(|k| k.kty == "RSA" && k.kid.is_some() && k.kid == parsed_header.kid).ok_or(())?;
    let components = RsaPublicKeyComponents {
        n: decode(key.n.as_deref().ok_or(())?)?,
        e: decode(key.e.as_deref().ok_or(())?)?,
    };
    let signed = format!("{header}.{payload}");
    components.verify(&RSA_PKCS1_2048_8192_SHA256, signed.as_bytes(), &decode(signature)?).map_err(|_| ())?;

    let claims: IdClaims = serde_json::from_slice(&decode(payload)?).map_err(|_| ())?;
    let audience_ok = match &claims.aud {
        Audience::One(aud) => aud == client_id,
        Audience::Many(auds) => auds.iter().any(|aud| aud == client_id),
    };
    let valid = claims.iss == ISSUER
        && audience_ok
        && claims.exp + LEEWAY_SECS > now
        && claims.nonce.as_deref() == Some(nonce)
        && !claims.sub.is_empty();
    valid.then_some(claims).ok_or(())
}

// ---------------------------------------------------------------------------
// The token endpoint

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    expires_in: Option<u64>,
    scope: Option<String>,
}

#[derive(Debug, PartialEq)]
enum TokenError {
    /// The server's machine-readable code, if it gave one.
    Rejected(Option<String>),
    Network,
}

/// The docs don't pin down the shape of a token endpoint error, so this accepts
/// OAuth's `{"error":"code"}` and the Responses-style `{"error":{"code":"code"}}`.
fn error_code(body: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(body).ok()?;
    let error = value.get("error");
    error
        .and_then(|e| e.as_str())
        .or_else(|| error.and_then(|e| e.get("code")).and_then(|c| c.as_str()))
        .or_else(|| value.get("code").and_then(|c| c.as_str()))
        .map(str::to_owned)
}

fn http_client() -> CmdResult<reqwest::Client> {
    reqwest::Client::builder().timeout(HTTP_TIMEOUT).build().map_err(|_| "network".to_owned())
}

async fn post_token(form: &[(&str, &str)]) -> Result<TokenResponse, TokenError> {
    let client = http_client().map_err(|_| TokenError::Network)?;
    let response = client.post(TOKEN_URL).form(form).send().await.map_err(|_| TokenError::Network)?;
    let status = response.status();
    let body = response.text().await.map_err(|_| TokenError::Network)?;
    if status.is_success() {
        return serde_json::from_str(&body).map_err(|_| TokenError::Rejected(None));
    }
    if status.is_server_error() {
        return Err(TokenError::Network);
    }
    Err(TokenError::Rejected(error_code(&body)))
}

async fn get_json<T: serde::de::DeserializeOwned>(url: &str) -> CmdResult<T> {
    let response = http_client()?
        .get(url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|_| "network".to_owned())?;
    let body = response.text().await.map_err(|_| "network".to_owned())?;
    serde_json::from_str(&body).map_err(|_| "network".to_owned())
}

#[derive(Debug, Deserialize)]
struct Discovery {
    issuer: String,
    jwks_uri: String,
    revocation_endpoint: Option<String>,
}

async fn discovery() -> CmdResult<Discovery> {
    let found: Discovery = get_json(DISCOVERY_URL).await?;
    if found.issuer == ISSUER {
        Ok(found)
    } else {
        Err("oauth_error".to_owned())
    }
}

fn scopes_of(scope: Option<&str>) -> Vec<String> {
    scope.map(|s| s.split_whitespace().map(str::to_owned).collect()).unwrap_or_default()
}

fn expiry(expires_in: Option<u64>, now: u64) -> u64 {
    now + expires_in.unwrap_or(3600)
}

/// Validates what the token endpoint returned and builds the new session.
/// `expected_sub` is the account this client is registered to, if known.
fn build_session(
    token: TokenResponse,
    callback: &Callback,
    jwks: &Jwks,
    nonce: &str,
    expected_sub: Option<&str>,
    now: u64,
) -> CmdResult<(Session, String)> {
    let id_token = token.id_token.ok_or_else(|| "invalid_id_token".to_owned())?;
    let claims = verify_id_token(&id_token, jwks, &callback.client_id, nonce, now)
        .map_err(|_| "invalid_id_token".to_owned())?;
    if expected_sub.is_some_and(|sub| sub != claims.sub) {
        return Err("account_mismatch".to_owned());
    }
    let refresh_token = token.refresh_token.ok_or_else(|| "registration_incomplete".to_owned())?;
    let scopes = scopes_of(token.scope.as_deref().or(callback.scope.as_deref()));
    let session = Session {
        sub: claims.sub,
        client_id: callback.client_id.clone(),
        email: claims.email,
        name: claims.name,
        access_token: token.access_token,
        refresh_token,
        expires_at: expiry(token.expires_in, now),
        scopes,
    };
    Ok((session, id_token))
}

fn adopt_session(record: &mut Record, session: Session, id_token: String) {
    record.registrations.insert(
        session.sub.clone(),
        Registration { client_id: session.client_id.clone(), email: session.email.clone() },
    );
    record.last_client_id = Some(session.client_id.clone());
    record.id_token = Some(id_token);
    record.session = Some(session);
}

/// Replaces everything a refresh renews together. The refresh token rotates on
/// every refresh, and the docs promise a replacement; the fallback is only so a
/// response without one doesn't lose the sign-in.
fn apply_refresh(session: &mut Session, token: TokenResponse, now: u64) {
    session.access_token = token.access_token;
    if let Some(refresh_token) = token.refresh_token {
        session.refresh_token = refresh_token;
    }
    session.expires_at = expiry(token.expires_in, now);
    if token.scope.is_some() {
        session.scopes = scopes_of(token.scope.as_deref());
    }
}

/// These mean the refresh token will never work again. Anything else, network
/// failures above all, leaves the sign-in alone.
fn is_terminal_refresh_error(code: &str) -> bool {
    matches!(
        code,
        "invalid_grant"
            | "invalid_refresh_token"
            | "token_expired"
            | "refresh_token_expired"
            | "refresh_token_invalidated"
            | "refresh_token_reused"
    )
}

fn needs_refresh(session: &Session, now: u64) -> bool {
    session.expires_at <= now + REFRESH_MARGIN_SECS
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs())
}

// ---------------------------------------------------------------------------
// State

#[derive(Default)]
pub struct ChatgptState {
    store: OnceLock<Arc<dyn SecretStore>>,
    /// Held across each load-change-save, and across the network call in a
    /// refresh: the refresh token rotates, so two refreshes at once would spend
    /// it twice, and OpenAI treats reuse as terminal.
    record_lock: tauri::async_runtime::Mutex<()>,
    /// The sign-in in progress. Starting another one cancels it.
    pending: Mutex<Option<Arc<AtomicBool>>>,
}

impl ChatgptState {
    fn store(&self, app: &AppHandle) -> CmdResult<Arc<dyn SecretStore>> {
        if let Some(store) = self.store.get() {
            return Ok(store.clone());
        }
        let stores = app.state::<SecretStores>();
        let file = stores.fallback(app, FALLBACK_FILE).map_err(|_| "storage".to_owned())?;
        Ok(self.store.get_or_init(|| select_record_store(stores.native(), file, RECORD)).clone())
    }

    fn begin_attempt(&self) -> Arc<AtomicBool> {
        let cancelled = Arc::new(AtomicBool::new(false));
        let mut pending = self.pending.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(previous) = pending.replace(cancelled.clone()) {
            previous.store(true, Ordering::Relaxed);
        }
        cancelled
    }
}

/// Credential-store calls can block (a Keychain or Secret Service prompt), so
/// they run on the blocking pool.
async fn blocking<T: Send + 'static>(
    store: &Arc<dyn SecretStore>,
    f: impl FnOnce(&dyn SecretStore) -> CmdResult<T> + Send + 'static,
) -> CmdResult<T> {
    let store = store.clone();
    tauri::async_runtime::spawn_blocking(move || f(store.as_ref())).await.map_err(|_| "storage".to_owned())?
}

async fn load_record(store: &Arc<dyn SecretStore>) -> CmdResult<Record> {
    blocking(store, load).await
}

async fn save_record(store: &Arc<dyn SecretStore>, record: Record) -> CmdResult<()> {
    blocking(store, move |store| save(store, &record)).await
}

/// A usable access token for a request to OpenAI, refreshed first if it is about
/// to expire. Stays on this side of the IPC boundary.
#[allow(dead_code)] // Used by the Responses and model commands from the next phases on.
pub(crate) async fn valid_access_token(app: &AppHandle, state: &ChatgptState) -> CmdResult<String> {
    let store = state.store(app)?;
    let _guard = state.record_lock.lock().await;
    let mut record = load_record(&store).await?;
    let Some(session) = record.session.as_mut() else {
        return Err("reauth_required".to_owned());
    };
    let now = now_secs();
    if !needs_refresh(session, now) {
        return Ok(session.access_token.clone());
    }
    let form = [
        ("grant_type", "refresh_token"),
        ("client_id", session.client_id.as_str()),
        ("refresh_token", session.refresh_token.as_str()),
        ("resource", RESOURCE),
    ];
    match post_token(&form).await {
        Ok(token) => {
            apply_refresh(session, token, now);
            let access_token = session.access_token.clone();
            save_record(&store, record).await?;
            Ok(access_token)
        }
        Err(TokenError::Rejected(Some(code))) if is_terminal_refresh_error(&code) => {
            record.session = None;
            save_record(&store, record).await?;
            Err("reauth_required".to_owned())
        }
        Err(TokenError::Rejected(Some(code))) if code == "invalid_client" => Err("invalid_client".to_owned()),
        Err(TokenError::Rejected(_)) => Err("refresh_failed".to_owned()),
        Err(TokenError::Network) => Err("network".to_owned()),
    }
}

// ---------------------------------------------------------------------------
// Commands

async fn sign_in(app: &AppHandle, state: &ChatgptState, new_account: bool, locale: String, cancelled: Arc<AtomicBool>) -> CmdResult<Account> {
    let store = state.store(app)?;
    let record = {
        let _guard = state.record_lock.lock().await;
        load_record(&store).await?
    };
    // "Use a different account" is only for after signing out: one session at a
    // time, and replacing it here would strand its refresh token unrevoked.
    if new_account && record.session.is_some() {
        return Err("sign_out_first".to_owned());
    }
    let attempt = Attempt {
        client_id: if new_account { None } else { record.last_client_id.clone() },
        verifier: random_token()?,
        state: random_token()?,
        nonce: random_token()?,
    };

    // Listen before opening the browser, as the flow requires.
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|_| "oauth_error".to_owned())?;
    let port = listener.local_addr().map_err(|_| "oauth_error".to_owned())?.port();
    let url = authorize_url(&attempt, &record, port)?;
    app.opener().open_url(url, None::<&str>).map_err(|_| "browser".to_owned())?;

    let (callback, attempt) = tauri::async_runtime::spawn_blocking(move || {
        wait_for_callback(&listener, &attempt, &locale, &cancelled, SIGN_IN_TIMEOUT).map(|callback| (callback, attempt))
    })
    .await
    .map_err(|_| "oauth_error".to_owned())??;

    // Save a newly issued client before anything else can fail, so that a failed
    // exchange retries with it rather than registering yet another client.
    if attempt.client_id.is_none() {
        let _guard = state.record_lock.lock().await;
        let mut latest = load_record(&store).await?;
        latest.last_client_id = Some(callback.client_id.clone());
        save_record(&store, latest).await?;
    }

    let redirect = redirect_uri(port);
    let form = [
        ("grant_type", "authorization_code"),
        ("client_id", callback.client_id.as_str()),
        ("code", callback.code.as_str()),
        ("code_verifier", attempt.verifier.as_str()),
        ("redirect_uri", redirect.as_str()),
        ("resource", RESOURCE),
    ];
    let token = post_token(&form).await.map_err(|error| match error {
        TokenError::Network => "network".to_owned(),
        TokenError::Rejected(Some(code)) if code == "invalid_grant" => "invalid_grant".to_owned(),
        TokenError::Rejected(_) => "oauth_error".to_owned(),
    })?;
    let found = discovery().await?;
    let jwks: Jwks = get_json(&found.jwks_uri).await?;

    let _guard = state.record_lock.lock().await;
    let mut latest = load_record(&store).await?;
    let expected_sub = latest.registered_sub(&callback.client_id).map(str::to_owned);
    let (session, id_token) =
        build_session(token, &callback, &jwks, &attempt.nonce, expected_sub.as_deref(), now_secs())?;
    let account = account_of(&session);
    adopt_session(&mut latest, session, id_token);
    save_record(&store, latest).await?;
    Ok(account)
}

#[tauri::command]
pub async fn chatgpt_sign_in(
    app: AppHandle,
    state: State<'_, ChatgptState>,
    new_account: bool,
    locale: String,
) -> CmdResult<Account> {
    let cancelled = state.begin_attempt();
    sign_in(&app, &state, new_account, locale, cancelled).await
}

#[tauri::command]
pub fn chatgpt_cancel_sign_in(state: State<'_, ChatgptState>) {
    if let Some(pending) = state.pending.lock().unwrap_or_else(|e| e.into_inner()).take() {
        pending.store(true, Ordering::Relaxed);
    }
}

#[tauri::command]
pub async fn chatgpt_account(app: AppHandle, state: State<'_, ChatgptState>) -> CmdResult<Option<Account>> {
    let store = state.store(&app)?;
    let _guard = state.record_lock.lock().await;
    Ok(load_record(&store).await?.session.as_ref().map(account_of))
}

/// `true` once the server has confirmed the refresh token is gone. The docs treat
/// an empty 200 as success, including for an already-invalid token.
async fn revoke(session: &Session) -> bool {
    let Ok(found) = discovery().await else {
        return false;
    };
    let (Some(endpoint), Ok(client)) = (found.revocation_endpoint, http_client()) else {
        return false;
    };
    let form = [
        ("token", session.refresh_token.as_str()),
        ("token_type_hint", "refresh_token"),
        ("client_id", session.client_id.as_str()),
    ];
    for attempt in 0..REVOKE_ATTEMPTS {
        if attempt > 0 {
            tauri::async_runtime::spawn_blocking(move || std::thread::sleep(Duration::from_secs(1 << attempt)))
                .await
                .ok();
        }
        match client.post(&endpoint).form(&form).send().await {
            Ok(response) if response.status().is_success() => return true,
            Ok(response) if !response.status().is_server_error() => return false,
            _ => {}
        }
    }
    false
}

#[derive(Debug, Serialize)]
pub struct SignOutResult {
    revoked: bool,
}

/// Clears the tokens whether or not the revocation was confirmed. The frontend
/// tells the user when it wasn't, so they can disconnect in ChatGPT's settings.
#[tauri::command]
pub async fn chatgpt_sign_out(app: AppHandle, state: State<'_, ChatgptState>) -> CmdResult<SignOutResult> {
    let store = state.store(&app)?;
    let _guard = state.record_lock.lock().await;
    let mut record = load_record(&store).await?;
    let revoked = match &record.session {
        Some(session) => revoke(session).await,
        None => true,
    };
    record.session = None;
    record.id_token = None;
    save_record(&store, record).await?;
    Ok(SignOutResult { revoked })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ring::signature::{KeyPair, RsaKeyPair, RSA_PKCS1_SHA256};

    const CLIENT: &str = "oaiapp_123";
    const NONCE: &str = "the-nonce";
    const NOW: u64 = 1_800_000_000;

    fn attempt(client_id: Option<&str>) -> Attempt {
        Attempt {
            client_id: client_id.map(str::to_owned),
            verifier: "the-verifier".into(),
            state: "the-state".into(),
            nonce: NONCE.into(),
        }
    }

    fn query_of(url: &str) -> BTreeMap<String, String> {
        url::Url::parse(url).unwrap().query_pairs().into_owned().collect()
    }

    fn record() -> Record {
        Record { host_id: "urn:uuid:host".into(), ..Default::default() }
    }

    fn finished(target: &str, attempt: &Attempt) -> CmdResult<Callback> {
        match parse_callback(target, attempt) {
            Request::Finished(result) => result,
            Request::Ignored => panic!("{target} was ignored"),
        }
    }

    // -- PKCE ----------------------------------------------------------------

    #[test]
    fn pkce_challenge_matches_the_rfc_7636_example() {
        assert_eq!(
            pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn random_tokens_differ_and_are_url_safe() {
        let (a, b) = (random_token().unwrap(), random_token().unwrap());
        assert_ne!(a, b);
        assert!(a.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
    }

    // -- Authorize URL -------------------------------------------------------

    #[test]
    fn first_sign_in_registers_dynamically() {
        let url = authorize_url(&attempt(None), &record(), 4242).unwrap();
        assert!(url.starts_with(AUTHORIZE_URL));
        let query = query_of(&url);
        assert_eq!(query["client_id"], DYNAMIC_CLIENT);
        assert_eq!(query["agent_name_hint"], APP_NAME);
        assert_eq!(query["ext_agent_host_id"], "urn:uuid:host");
        assert_eq!(query["response_type"], "code");
        assert_eq!(query["redirect_uri"], "http://127.0.0.1:4242/auth/callback");
        assert_eq!(query["scope"], SCOPES);
        assert_eq!(query["resource"], RESOURCE);
        assert_eq!(query["state"], "the-state");
        assert_eq!(query["nonce"], NONCE);
        assert_eq!(query["code_challenge_method"], "S256");
        assert_eq!(query["code_challenge"], pkce_challenge("the-verifier"));
        assert!(!query.contains_key("id_token_hint"));
        assert!(!query.contains_key("login_hint"));
    }

    #[test]
    fn reauthorizing_reuses_the_client_and_sends_hints() {
        let mut record = record();
        record.id_token = Some("old.id.token".into());
        record.registrations.insert(
            "sub-1".into(),
            Registration { client_id: CLIENT.into(), email: Some("a+b@example.com".into()) },
        );
        let query = query_of(&authorize_url(&attempt(Some(CLIENT)), &record, 1).unwrap());
        assert_eq!(query["client_id"], CLIENT);
        assert_eq!(query["id_token_hint"], "old.id.token");
        assert_eq!(query["login_hint"], "a+b@example.com");
        assert!(!query.contains_key("agent_name_hint"));
    }

    #[test]
    fn after_sign_out_no_id_token_hint_is_sent() {
        let query = query_of(&authorize_url(&attempt(Some(CLIENT)), &record(), 1).unwrap());
        assert!(!query.contains_key("id_token_hint"));
    }

    // -- Callback ------------------------------------------------------------

    #[test]
    fn registration_callback_returns_the_issued_client() {
        let callback =
            finished("/auth/callback?code=c1&state=the-state&client_id=oaiapp_9&scope=openid+email", &attempt(None));
        let callback = callback.unwrap();
        assert_eq!(callback.code, "c1");
        assert_eq!(callback.client_id, "oaiapp_9");
        assert_eq!(callback.scope.as_deref(), Some("openid email"));
    }

    #[test]
    fn registration_without_an_issued_client_is_incomplete() {
        let code = |target| finished(target, &attempt(None)).unwrap_err();
        assert_eq!(code("/auth/callback?code=c1&state=the-state"), "registration_incomplete");
        assert_eq!(code("/auth/callback?code=c1&state=the-state&client_id="), "registration_incomplete");
        // Docs: never keep the placeholder as if it had been issued.
        assert_eq!(
            code("/auth/callback?code=c1&state=the-state&client_id=dynamic_agent_client"),
            "registration_incomplete"
        );
    }

    #[test]
    fn reauth_keeps_its_client_when_the_callback_omits_it() {
        let callback = finished("/auth/callback?code=c1&state=the-state", &attempt(Some(CLIENT))).unwrap();
        assert_eq!(callback.client_id, CLIENT);
    }

    #[test]
    fn reauth_rejects_a_different_client() {
        let result = finished("/auth/callback?code=c1&state=the-state&client_id=oaiapp_other", &attempt(Some(CLIENT)));
        assert_eq!(result.unwrap_err(), "account_mismatch");
    }

    #[test]
    fn access_denied_stops_without_a_code() {
        let result = finished("/auth/callback?error=access_denied&state=the-state", &attempt(None));
        assert_eq!(result.unwrap_err(), "access_denied");
    }

    #[test]
    fn other_oauth_errors_and_a_missing_code_fail() {
        assert_eq!(finished("/auth/callback?error=server_error&state=the-state", &attempt(None)).unwrap_err(), "oauth_error");
        assert_eq!(finished("/auth/callback?state=the-state", &attempt(Some(CLIENT))).unwrap_err(), "oauth_error");
    }

    #[test]
    fn requests_that_are_not_this_attempts_callback_are_ignored() {
        let attempt = attempt(None);
        for target in [
            "/favicon.ico",
            "/callback?code=c1&state=the-state",
            "/auth/callback",
            "/auth/callback?code=c1&state=wrong",
            // An error from someone without the state must not end the attempt.
            "/auth/callback?error=access_denied&state=wrong",
            "/auth/callback?error=access_denied",
        ] {
            assert_eq!(parse_callback(target, &attempt), Request::Ignored, "{target}");
        }
    }

    // -- The listener, over a real loopback socket ---------------------------

    fn get(port: u16, target: &str) -> String {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        write!(stream, "GET {target} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        response
    }

    #[test]
    fn listener_survives_stray_requests_until_its_callback_arrives() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let client = std::thread::spawn(move || {
            let stray = get(port, "/favicon.ico");
            let wrong = get(port, "/auth/callback?code=evil&state=wrong");
            let good = get(port, "/auth/callback?code=c1&state=the-state&client_id=oaiapp_9");
            (stray, wrong, good)
        });

        let cancelled = AtomicBool::new(false);
        let callback =
            wait_for_callback(&listener, &attempt(None), "es", &cancelled, Duration::from_secs(10)).unwrap();

        assert_eq!(callback.code, "c1");
        let (stray, wrong, good) = client.join().unwrap();
        assert!(stray.starts_with("HTTP/1.1 404"));
        assert!(wrong.starts_with("HTTP/1.1 404"));
        assert!(good.starts_with("HTTP/1.1 200"));
        assert!(good.contains("Puedes cerrar"));
    }

    #[test]
    fn listener_stops_on_cancel_and_on_timeout() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let cancelled = AtomicBool::new(true);
        let result = wait_for_callback(&listener, &attempt(None), "en", &cancelled, Duration::from_secs(10));
        assert_eq!(result.unwrap_err(), "cancelled");

        let cancelled = AtomicBool::new(false);
        let result = wait_for_callback(&listener, &attempt(None), "en", &cancelled, Duration::from_millis(1));
        assert_eq!(result.unwrap_err(), "timeout");
    }

    // -- ID token ------------------------------------------------------------

    fn test_key() -> RsaKeyPair {
        // Generated for these tests alone; it signs nothing else.
        let b64 = include_str!("../testdata/chatgpt_id_token_test_key.b64");
        let der = base64::engine::general_purpose::STANDARD.decode(b64.trim()).unwrap();
        RsaKeyPair::from_pkcs8(&der).unwrap()
    }

    fn test_jwks() -> Jwks {
        let key = test_key();
        let public = RsaPublicKeyComponents::<Vec<u8>>::from(key.public_key());
        Jwks {
            keys: vec![Jwk {
                kid: Some("key-1".into()),
                kty: "RSA".into(),
                n: Some(BASE64URL.encode(public.n)),
                e: Some(BASE64URL.encode(public.e)),
            }],
        }
    }

    fn jwt(header: serde_json::Value, claims: serde_json::Value) -> String {
        let signed = format!(
            "{}.{}",
            BASE64URL.encode(header.to_string()),
            BASE64URL.encode(claims.to_string())
        );
        let key = test_key();
        let mut signature = vec![0; key.public().modulus_len()];
        key.sign(&RSA_PKCS1_SHA256, &SystemRandom::new(), signed.as_bytes(), &mut signature).unwrap();
        format!("{signed}.{}", BASE64URL.encode(signature))
    }

    fn header() -> serde_json::Value {
        serde_json::json!({ "alg": "RS256", "kid": "key-1" })
    }

    fn claims() -> serde_json::Value {
        serde_json::json!({
            "iss": ISSUER, "aud": CLIENT, "exp": NOW + 3600, "nonce": NONCE,
            "sub": "sub-1", "email": "a@example.com", "name": "A"
        })
    }

    fn verify(token: &str) -> Result<IdClaims, ()> {
        verify_id_token(token, &test_jwks(), CLIENT, NONCE, NOW)
    }

    fn with(field: &str, value: serde_json::Value) -> serde_json::Value {
        let mut claims = claims();
        claims[field] = value;
        claims
    }

    #[test]
    fn a_valid_id_token_passes() {
        let claims = verify(&jwt(header(), claims())).unwrap();
        assert_eq!(claims.sub, "sub-1");
        assert_eq!(claims.email.as_deref(), Some("a@example.com"));
    }

    #[test]
    fn audience_may_be_a_list() {
        assert!(verify(&jwt(header(), with("aud", serde_json::json!(["other", CLIENT])))).is_ok());
    }

    #[test]
    fn wrong_claims_are_rejected() {
        for (field, value) in [
            ("iss", serde_json::json!("https://evil.example")),
            ("aud", serde_json::json!("oaiapp_other")),
            ("aud", serde_json::json!(["oaiapp_other"])),
            ("exp", serde_json::json!(NOW - LEEWAY_SECS - 1)),
            ("nonce", serde_json::json!("other-nonce")),
            ("nonce", serde_json::Value::Null),
            ("sub", serde_json::json!("")),
        ] {
            assert!(verify(&jwt(header(), with(field, value.clone()))).is_err(), "{field}: {value}");
        }
    }

    #[test]
    fn a_tampered_payload_is_rejected() {
        let token = jwt(header(), claims());
        let parts: Vec<&str> = token.split('.').collect();
        let forged = BASE64URL.encode(with("sub", serde_json::json!("someone-else")).to_string());
        assert!(verify(&format!("{}.{forged}.{}", parts[0], parts[2])).is_err());
    }

    #[test]
    fn other_algorithms_and_unknown_keys_are_rejected() {
        let none = format!(
            "{}.{}.",
            BASE64URL.encode(serde_json::json!({ "alg": "none", "kid": "key-1" }).to_string()),
            BASE64URL.encode(claims().to_string())
        );
        assert!(verify(&none).is_err());
        assert!(verify(&jwt(serde_json::json!({ "alg": "HS256", "kid": "key-1" }), claims())).is_err());
        assert!(verify(&jwt(serde_json::json!({ "alg": "RS256", "kid": "other" }), claims())).is_err());
        assert!(verify(&jwt(serde_json::json!({ "alg": "RS256" }), claims())).is_err());
    }

    #[test]
    fn malformed_tokens_are_rejected() {
        for token in ["", "a.b", "a.b.c", "a.b.c.d"] {
            assert!(verify(token).is_err(), "{token}");
        }
    }

    // -- Sessions ------------------------------------------------------------

    fn token_response(id_token: Option<String>, scope: Option<&str>) -> TokenResponse {
        TokenResponse {
            access_token: "access".into(),
            refresh_token: Some("refresh".into()),
            id_token,
            expires_in: Some(3600),
            scope: scope.map(str::to_owned),
        }
    }

    fn callback(scope: Option<&str>) -> Callback {
        Callback { code: "c".into(), client_id: CLIENT.into(), scope: scope.map(str::to_owned) }
    }

    fn session_from(scope: Option<&str>, callback_scope: Option<&str>, expected: Option<&str>) -> CmdResult<Session> {
        let token = token_response(Some(jwt(header(), claims())), scope);
        build_session(token, &callback(callback_scope), &test_jwks(), NONCE, expected, NOW).map(|(session, _)| session)
    }

    #[test]
    fn plan_usage_depends_on_the_granted_scope() {
        let enabled = session_from(Some("openid chatgpt.tokens.use.direct"), None, None).unwrap();
        assert!(account_of(&enabled).plan_enabled);
        assert_eq!(enabled.expires_at, NOW + 3600);

        // A valid sign-in, still: it just can't use the plan.
        let disabled = session_from(Some("openid email"), None, None).unwrap();
        assert!(!account_of(&disabled).plan_enabled);
        assert_eq!(account_of(&disabled).email.as_deref(), Some("a@example.com"));
    }

    #[test]
    fn the_callback_scope_stands_in_when_the_token_response_has_none() {
        let session = session_from(None, Some("chatgpt.tokens.use.direct"), None).unwrap();
        assert!(account_of(&session).plan_enabled);
    }

    #[test]
    fn a_different_account_on_reauth_is_rejected() {
        assert_eq!(session_from(None, None, Some("sub-2")).unwrap_err(), "account_mismatch");
        assert!(session_from(None, None, Some("sub-1")).is_ok());
    }

    #[test]
    fn a_token_response_without_an_id_token_fails() {
        let token = token_response(None, None);
        let result = build_session(token, &callback(None), &test_jwks(), NONCE, None, NOW);
        assert_eq!(result.unwrap_err(), "invalid_id_token");
    }

    fn session() -> Session {
        Session {
            sub: "sub-1".into(),
            client_id: CLIENT.into(),
            email: None,
            name: None,
            access_token: "old-access".into(),
            refresh_token: "old-refresh".into(),
            expires_at: NOW,
            scopes: vec!["openid".into()],
        }
    }

    #[test]
    fn a_refresh_replaces_everything_together() {
        let mut session = session();
        apply_refresh(&mut session, token_response(None, Some(DIRECT_SCOPE)), NOW);
        assert_eq!(session.access_token, "access");
        assert_eq!(session.refresh_token, "refresh");
        assert_eq!(session.expires_at, NOW + 3600);
        assert_eq!(session.scopes, vec![DIRECT_SCOPE.to_owned()]);
    }

    #[test]
    fn a_refresh_without_a_new_refresh_token_keeps_the_old_one() {
        let mut session = session();
        let token = TokenResponse { refresh_token: None, scope: None, ..token_response(None, None) };
        apply_refresh(&mut session, token, NOW);
        assert_eq!(session.refresh_token, "old-refresh");
        assert_eq!(session.scopes, vec!["openid".to_owned()]);
    }

    #[test]
    fn refresh_happens_shortly_before_expiry() {
        let mut session = session();
        session.expires_at = NOW + REFRESH_MARGIN_SECS + 1;
        assert!(!needs_refresh(&session, NOW));
        session.expires_at = NOW + REFRESH_MARGIN_SECS;
        assert!(needs_refresh(&session, NOW));
    }

    #[test]
    fn only_the_documented_codes_end_a_sign_in() {
        for code in [
            "invalid_grant",
            "invalid_refresh_token",
            "token_expired",
            "refresh_token_expired",
            "refresh_token_invalidated",
            "refresh_token_reused",
        ] {
            assert!(is_terminal_refresh_error(code), "{code}");
        }
        for code in ["invalid_client", "server_error", "temporarily_unavailable", ""] {
            assert!(!is_terminal_refresh_error(code), "{code}");
        }
    }

    #[test]
    fn error_codes_are_read_from_either_shape() {
        assert_eq!(error_code(r#"{"error":"invalid_grant"}"#).as_deref(), Some("invalid_grant"));
        assert_eq!(error_code(r#"{"error":{"code":"token_expired"}}"#).as_deref(), Some("token_expired"));
        assert_eq!(error_code(r#"{"code":"refresh_token_reused"}"#).as_deref(), Some("refresh_token_reused"));
        assert_eq!(error_code(r#"{"detail":"nope"}"#), None);
        assert_eq!(error_code("<html>"), None);
    }

    // -- The record ----------------------------------------------------------

    #[test]
    fn signing_in_remembers_the_registration() {
        let mut record = record();
        adopt_session(&mut record, session(), "id.token".into());
        assert_eq!(record.last_client_id.as_deref(), Some(CLIENT));
        assert_eq!(record.registered_sub(CLIENT), Some("sub-1"));
        assert_eq!(record.id_token.as_deref(), Some("id.token"));
    }

    #[test]
    fn the_account_never_carries_a_token() {
        let json = serde_json::to_string(&account_of(&session())).unwrap();
        assert!(!json.contains("old-access"));
        assert!(!json.contains("old-refresh"));
    }

    #[test]
    fn the_record_round_trips_through_a_store_larger_than_one_chunk() {
        let path = std::env::temp_dir()
            .join(format!("bibleql-chatgpt-{}-{}", std::process::id(), random_token().unwrap()))
            .join(FALLBACK_FILE);
        let store = crate::secret_store::FileStore::new(path.clone());
        let mut record = record();
        let mut big = session();
        big.access_token = "a".repeat(4000);
        big.refresh_token = "r".repeat(4000);
        adopt_session(&mut record, big, "i".repeat(4000));

        save(&store, &record).unwrap();

        assert_eq!(load(&store).unwrap(), record);
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn the_host_id_is_generated_once() {
        let path = std::env::temp_dir()
            .join(format!("bibleql-chatgpt-{}-{}", std::process::id(), random_token().unwrap()))
            .join(FALLBACK_FILE);
        let store = crate::secret_store::FileStore::new(path.clone());
        let first = load(&store).unwrap().host_id;
        assert!(first.starts_with("urn:uuid:"));
        assert!(uuid::Uuid::parse_str(first.trim_start_matches("urn:uuid:")).is_ok());
        assert_eq!(load(&store).unwrap().host_id, first);
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn an_unreadable_record_is_an_error_rather_than_a_blank_slate() {
        let path = std::env::temp_dir()
            .join(format!("bibleql-chatgpt-{}-{}", std::process::id(), random_token().unwrap()))
            .join(FALLBACK_FILE);
        let store = crate::secret_store::FileStore::new(path.clone());
        write_record(&store, RECORD, "not json").unwrap();
        assert_eq!(load(&store).unwrap_err(), "storage");
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }
}
