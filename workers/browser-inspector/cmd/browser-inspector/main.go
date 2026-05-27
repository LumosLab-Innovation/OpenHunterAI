package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func main() {
	service := env("SERVICE_NAME", "browser-inspector")
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true, "service": service, "mode": "playwright-mcp", "mcp_url": env("PLAYWRIGHT_MCP_URL", ""),
		})
	})
	http.HandleFunc("/inspect", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]any{"accepted": true, "service": service})
	})
	addr := ":" + env("PORT", "5110")
	log.Printf("%s listening on %s", service, addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
