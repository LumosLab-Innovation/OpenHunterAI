package main

import (
	"encoding/json"
	"net/http"
	"os"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "service": "playwright-adapter", "mode": "mcp", "mcp_url": env("PLAYWRIGHT_MCP_URL", "")})
	})
	_ = http.ListenAndServe(":"+env("PORT", "6140"), nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
