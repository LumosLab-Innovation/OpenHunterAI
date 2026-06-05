package main

import (
	"encoding/json"
	"net/http"
	"os"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		mcpURL := env("PLAYWRIGHT_MCP_URL", "")
		runtimeAvailable := mcpURL != ""
		if !runtimeAvailable {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": runtimeAvailable, "service": "playwright-adapter", "mode": "mcp", "runtime_available": runtimeAvailable, "mcp_url": mcpURL})
	})
	_ = http.ListenAndServe(":"+env("PORT", "6140"), nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
