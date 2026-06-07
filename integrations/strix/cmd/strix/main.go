package main

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		runtimeBin := env("STRIX_BIN", "strix")
		_, err := exec.LookPath(runtimeBin)
		runtimeAvailable := err == nil
		if !runtimeAvailable {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": runtimeAvailable, "service": "strix-adapter", "runtime_available": runtimeAvailable, "runtime_bin": runtimeBin})
	})
	http.HandleFunc("/reason", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotImplemented)
		_ = json.NewEncoder(w).Encode(map[string]any{"code": "TOOL_UNAVAILABLE", "tool": "strix", "message": "Strix runtime is not wired in this adapter image"})
	})
	_ = http.ListenAndServe(":"+env("PORT", "6130"), nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
