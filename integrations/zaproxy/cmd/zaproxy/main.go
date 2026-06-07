package main

import (
	"encoding/json"
	"net/http"
	"os"
)

func main() {
	baseURL := env("ZAP_BASE_URL", "http://zap:8080")
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		res, err := http.Get(baseURL + "/JSON/core/view/version/")
		available := err == nil && res.StatusCode < 500
		if res != nil {
			_ = res.Body.Close()
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "service": "zaproxy-adapter", "runtime_available": available, "base_url": baseURL})
	})
	http.HandleFunc("/scan/passive", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotImplemented)
		_ = json.NewEncoder(w).Encode(map[string]any{"code": "TOOL_UNAVAILABLE", "tool": "zaproxy", "message": "ZAP passive scan execution is not wired in this adapter yet"})
	})
	_ = http.ListenAndServe(":"+env("PORT", "6100"), nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
