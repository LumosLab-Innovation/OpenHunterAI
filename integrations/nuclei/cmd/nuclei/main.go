package main

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
)

func main() {
	bin := env("NUCLEI_BIN", "nuclei")
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		out, err := exec.Command(bin, "-version").CombinedOutput()
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "service": "nuclei-adapter", "runtime_available": err == nil, "version": string(out)})
	})
	http.HandleFunc("/scan", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]any{"accepted": true, "tool": "nuclei"})
	})
	_ = http.ListenAndServe(":"+env("PORT", "6110"), nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
