package main

import (
	"encoding/json"
	"net/http"
	"os"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		runtimeRoot := env("OPENHACK_ROOT", "/runtime/openhack")
		runtimeAvailable := pathExists(runtimeRoot)
		if !runtimeAvailable {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": runtimeAvailable, "service": "openhack-adapter", "runtime_available": runtimeAvailable, "runtime_root": runtimeRoot})
	})
	http.HandleFunc("/hunt", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotImplemented)
		_ = json.NewEncoder(w).Encode(map[string]any{"code": "TOOL_UNAVAILABLE", "tool": "openhack", "message": "OpenHack runtime is not wired in this adapter image"})
	})
	_ = http.ListenAndServe(":"+env("PORT", "6120"), nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
