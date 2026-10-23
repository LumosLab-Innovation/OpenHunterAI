// strix-adapter wires worker S to either the packaged Strix runtime or a
// separate Codex-guided, reasoning-only path in the findings service.
//
// Boundary (infra/INTEGRATIONS.md): worker -> this adapter HTTP -> packaged
// Strix runtime -> sanitized signal output. The adapter:
//   - validates the request and re-checks the target is not private/local,
//   - invokes the Strix runtime non-interactively, bounded by a hard timeout
//     and constrained to the authorized scope (no destructive instruction),
//   - sanitizes runtime output before returning it,
//   - returns TOOL_UNAVAILABLE (503) when the runtime is absent, never a fake
//     success.
//
// The reasoning LLM is configured for the Strix runtime via env (model alias +
// provider key); business logic in core services still routes through the LLM
// Gateway. This adapter is the trust boundary for the third-party runtime.
package main

import (
	"encoding/json"
	"net/http"
	"os"
	"time"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/reason", reasonHandler)

	srv := &http.Server{
		Addr:              ":" + env("PORT", "6130"),
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
	_ = srv.ListenAndServe()
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	bin := env("STRIX_BIN", "strix")
	installed := runtimeAvailable(bin)
	configured := strixRuntimeConfigured()
	codexMode := boolEnv("STRIX_CODEX_REASONING")
	reasoning := codexMode && codexReasoningAvailable(r.Context())
	ready := reasoning
	mode := "unavailable"
	if codexMode {
		mode = "codex_reasoning"
	} else if installed && configured {
		ready = true
		mode = "strix_runtime"
	} else if boolEnv("STRIX_BUILTIN_PLANNER") {
		ready = true
		mode = "builtin_planner"
	}
	if !ready {
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	writeJSON(w, map[string]any{
		"ok":                  ready,
		"service":             "strix-adapter",
		"runtime_available":   installed,
		"runtime_configured":  configured,
		"runtime_bin":         bin,
		"builtin_planner":     boolEnv("STRIX_BUILTIN_PLANNER"),
		"reasoning_available": reasoning,
		"execution_mode":      mode,
	})
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func boolEnv(key string) bool {
	switch os.Getenv(key) {
	case "1", "true", "TRUE", "yes", "YES":
		return true
	default:
		return false
	}
}

func writeJSON(w http.ResponseWriter, body any) {
	w.Header().Set("content-type", "application/json")
	_ = json.NewEncoder(w).Encode(body)
}
