# OrcaRouter Cyber Inference

OpenHunterAI ships a named **OrcaRouter Cyber Inference** provider in the LLM
Gateway. It is the route for security teams doing **authorized, scoped**
security work: cyber models for red teams and gateway controls for blue teams
on one OpenAI-compatible endpoint.

- Provider home: [OrcaRouter](https://www.orcarouter.ai)
- Cyber provider page: <https://www.orcarouter.ai/cyber>
- Cyber model catalog: <https://www.orcarouter.ai/models?tier=cyber>
- Inference API: `https://api.orcarouter.ai/v1`
- Account authorization: `https://www.orcarouter.ai`

The cyber tier is for teams whose OrcaRouter workspace is verified for it.
Verification does not change OpenHunterAI's own controls: every scan still
requires a verified domain, an approved scope, and the existing approval gates.

## Two ways to connect

Both paths end in the same durable `sk-orca-…` key. The provider, model
discovery, and the reasoning routes never branch on which path was used.

### API key

Set `ORCAROUTER_API_KEY` in the private `.env.local`, or paste the key on
**Setup & models → Configure AI reasoning → OrcaRouter Cyber Inference**. The
panel stores it through the workspace's existing provider-secret mechanism.
Keys are masked in the UI and never returned to the browser.

### OAuth 2.0 + PKCE (Flow A, loopback redirect)

Choose **Connect with OrcaRouter**. The local API binds an ephemeral
`127.0.0.1` port, opens
`https://www.orcarouter.ai/auth?…&code_challenge_method=S256`, and exchanges the
returned code at `https://www.orcarouter.ai/api/v1/auth/keys`. There is no
client secret and no redirect URI to pre-register.

- The verifier and state are fresh cryptographic randomness per attempt; the
  verifier never leaves the process and is never logged.
- The granted `scope` is read back and must be `api`; a downgrade is reported,
  not assumed.
- The result is a durable API key. It is reused until revoked. A relay `401`
  marks the exact credential generation `needsReauth`; there is no refresh
  grant and no re-authorization on every launch.
- **Show me a code** starts Flow B (out-of-band) for browsers that cannot reach
  loopback. It still uses S256.
- Closing the page, cancelling, denial, exchange errors, and timeouts all
  release the login lock.
- A successful Cancel discards a late exchange result; before persistence,
  expired or superseded attempts cannot save a key. Once saving has begun, cancellation
  is no longer accepted and the UI refreshes the connection status.

`ORCA_BASE_URL` sets a shared self-hosted base; explicit `ORCA_AUTH_BASE_URL`
and `ORCA_API_BASE_URL` win over it. Remote origins must be HTTPS; HTTP is
allowed only for loopback.

## Models

The reasoning model list is discovered from the authoritative catalog at
`GET https://api.orcarouter.ai/v1/models?capability=chat` with the workspace's
Bearer key. The API process holds the key; the browser receives only selector
metadata. If discovery fails, a small verified fallback list is shown and
marked as degraded — never free-text entry.

Recommended ordering:

- **Default:** `orcarouter/auto` — automatic routing, works with any key.
- **Dedicated cyber models** (verified security teams):
  `orca/orcacyber-ultra-1.0` for large-codebase security scanning and multi-step
  reasoning, and `orca/orcacyber-zero-1.5` for the OrcaCyber harness. IDs are
  shown exactly as the catalog lists them, preserving the vendor namespace.
- **General fallback:** `orcarouter/fusion`.

The host's reasoning entry points accept text prompts only. Image, audio,
embedding, image-generation, video, and rerank catalog filters exist in the
shared catalog module, but OpenHunterAI has no corresponding input surface, so
they are not exposed in this panel. Multimodal selection fails closed: a model
is offered only when the catalog explicitly declares the required input
modality.

## Configuration

```dotenv
# Either paste in Setup & models, or set here before `node ops/local.mjs restart`.
ORCAROUTER_API_KEY=

# Route both reasoning roles through the named provider.
LLM_LOW_REASONING_PROVIDER=orcarouter
LLM_LOW_REASONING_MODEL=orcarouter/auto
LLM_HIGH_REASONING_PROVIDER=orcarouter
LLM_HIGH_REASONING_MODEL=orcarouter/auto
```

All calls still pass through the LLM Gateway: use-case allowance, prompt
sanitization, budgets, timeout, and fallback behavior are unchanged.

## Evidence

The UI capture is generated from the production frontend bundle with dedicated
test data. `orca-evidence/` is a run output, not part of the patch: independent
verification builds the frontend, renders the real Setup page, and archives the
screenshots and manifest.

```bash
npm --prefix frontend install
python3 -I ops/evidence/orcarouter_capture.py
```

The generated `orca-evidence/manifest.json` records the authoritative catalog
source (`https://api.orcarouter.ai/v1/models?capability=chat`), the model count,
and SHA-256 hashes for both screenshots.
