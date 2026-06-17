# OpenHunter Canary Contract

Staging/dev targets that run `acceptanceProfile=canary_e2e` must expose a hidden
test-only namespace under `/openhunter-canary`.

## Manifest

`GET /openhunter-canary/manifest.json`

```json
{
  "scenario": "object_ownership",
  "vulnerablePath": "/openhunter-canary/objects/vulnerable/user-b-object",
  "fixedPath": "/openhunter-canary/objects/fixed/user-b-object"
}
```

The manifest and paths must remain inside the verified allowed host and path
scope. Production targets must not expose this namespace.

## Expected Behavior

- User A and User B login sessions are captured manually through OpenHunter.
- Browser Inspector replays User A against both paths.
- `vulnerablePath` intentionally returns `2xx` for User A accessing User B's canary object.
- `fixedPath` returns `403` or `404` for the same cross-user access.
- OpenHunter stores only sanitized status/path metadata and optional masked thumbnail evidence. It must not store raw response bodies, HAR, cookies, tokens, browser storage, or passwords.
