# Web authentication boundary

The Web UI is not an account provider with public owner registration. A Delta node has enrolled signing identities and scoped API tokens. Only an existing owner can enroll another public key, issue a token or change administrative trust.

## First owner

The local installer prints a random, five-minute, one-use setup link. Its secret is in the URL fragment (not an HTTP query), is removed from browser history during exchange and is checked against a private hashed setup record. Exchange creates a one-hour setup session, not an indefinitely unlocked account. Create a recovery phrase/key, save it, confirm the backup and enroll it. The browser signs a challenge locally and switches to the enrolled identity; the temporary setup credential is revoked during session rotation.

No unauthenticated request can create an owner. If setup access is lost, an operator with access to the node's private owner credential can issue fresh setup access locally. Do not expose the private profile or installer output publicly.

## Returning users

The browser sends a public key and a one-use, short-lived signed challenge. A seed phrase/private key is never submitted to the server. The challenge is bound to the node, audience and remember choice. A remembered session lasts at most thirty days; otherwise the signed-login session lasts eight hours. Revoking a key revokes its issued tokens. Logout clears the browser cookie and revokes that session token.

Sessions use random 256-bit opaque HttpOnly, SameSite=Strict cookies, plus Secure for HTTPS origins. Session credentials are stored in a private server-side file; they are not in UI assets or localStorage. An explicitly supplied API token is held only in browser sessionStorage; logging out clears that browser reference but does not revoke the original reusable API token.

A valid saved session can legitimately restore sign-in without asking again. This is not anonymous owner access. The production build does not accept stale local demo preferences as an authenticated user. Management screens are mounted only after the API confirms a principal.

## Network boundary

Configure `PUBLIC_ORIGIN=https://your-domain.example` when using an HTTPS reverse proxy and add that exact origin to the Core profile's `identity_origins` allowlist before key login. Restart the Core after changing its private configuration. Local SSH-tunnel use can retain `http://127.0.0.1:7710`.

Session issuance rejects non-loopback plaintext HTTP. The server does not blindly trust forwarded protocol/IP headers. Session endpoints enforce the exact Origin and bounded request/rate limits. Static files carry anti-framing headers; API/session responses are not cacheable.

Web proxies the user's credential to Core, never the Web service's privileged token. Core independently enforces scopes on direct API calls and on delegated plugin calls. Hiding or disabling a UI control is not an authorization boundary. MCP gateways have separate scoped credentials.

## Native applications

Desktop/Android intentionally use their OS-owned local application profile through private IPC, not a browser owner cookie. Android profile and peer secrets use Android Keystore encryption. Desktop profile access relies on OS account/file permissions. A new native local Core is loopback-only; pairing does not create an inbound VPN or grant administrative trust automatically.

## Verification

`tests/sessions.test.mjs` covers origin rejection, forged cookies, one-use setup, private cookie attributes, persistent scoped sessions, malformed setup records and rate limits. `tests/auth-gate-live.mjs` exercises a real Core/Web/browser setup, clean/forged/revoked sessions, first-owner enrollment, setup-token revocation, challenge replay rejection and direct anonymous owner-API denial. These are isolated fixtures, not a claim that a particular user's deployed node was inspected.
