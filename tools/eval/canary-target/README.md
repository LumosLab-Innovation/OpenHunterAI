# Synthetic object-ownership canary

This intentionally vulnerable fixture is for an explicitly authorized
staging/dev benchmark, never a production target. By default it binds only
`127.0.0.1`; the OpenHunter scan guard will not scan that private address.

Start locally to inspect the fixture (not to bypass the scan guard):

```bash
CANARY_USER_A_PASSWORD=<test-secret-a> CANARY_USER_B_PASSWORD=<test-secret-b> \
  node tools/eval/canary-target/server.mjs
```

To deploy on an explicitly authorized HTTPS staging host, an operator must set
`CANARY_BIND_HOST`, `CANARY_PUBLIC_STAGING=1`, and `CANARY_COOKIE_SECURE=1`,
configure TLS at the proxy, and restrict network access to the authorized test
team. Capture two saved browser sessions in OpenHunter (User A and User B),
then run the `canary_e2e` acceptance profile. Do not put test passwords in Git,
container images, logs, or report artifacts.

The manifest declares the intentionally vulnerable User-B object path, a fixed
negative control, and one own-object path per account. Set
`CANARY_FIX_VULNERABLE=1` and restart the fixture to simulate remediation;
the control paths remain unchanged. Run `node --test
tools/eval/canary-target/server.test.mjs` for fixture-level checks.
