# OpenHunter Canary Contract

This contract is only for the optional `canary_e2e` benchmark profile. Normal
self-host scans do not require a canary endpoint or a dedicated test backend.

Staging/dev targets that run `acceptanceProfile=canary_e2e` must expose a hidden
test-only namespace under `/openhunter-canary`.

## Manifest

`GET /openhunter-canary/manifest.json`

```json
{
  "scenario": "object_ownership",
  "vulnerablePath": "/openhunter-canary/objects/vulnerable/user-b-object",
  "fixedPath": "/openhunter-canary/objects/fixed/user-b-object",
  "userAOwnPath": "/openhunter-canary/objects/own/user-a-object",
  "userBOwnPath": "/openhunter-canary/objects/own/user-b-object"
}
```

The manifest and paths must remain inside the explicitly authorized public host and path
scope. Production targets must not expose this namespace.

## Expected Behavior

- User A and User B login sessions are captured manually through OpenHunter.
- Browser Inspector identifies the two sessions through own-object positive
  controls, then replays User A against the vulnerable and fixed paths.
- User A's own path and User B's own path must each return `2xx` only for their
  respective session; the other session must receive `403` or `404`.
- `vulnerablePath` intentionally returns `2xx` for User A accessing User B's canary object.
- `fixedPath` returns `403` or `404` for the same cross-user access.
- The current browser worker stores only sanitized status/path metadata and emits a candidate, not a validated finding. It must not claim baseline/exploit `http_exchange` references until a separate verifier persists and checks those artifacts.
- OpenHunter must not store raw response bodies, HAR, cookies, tokens, browser storage, or passwords.
