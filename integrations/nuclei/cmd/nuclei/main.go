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
		runtimeAvailable := err == nil
		if !runtimeAvailable {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": runtimeAvailable, "service": "nuclei-adapter", "runtime_available": runtimeAvailable, "version": string(out)})
	})
	http.HandleFunc("/scan", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotImplemented)
		_ = json.NewEncoder(w).Encode(map[string]any{"code": "TOOL_UNAVAILABLE", "tool": "nuclei", "message": "Nuclei execution is disabled until curated templates are packaged and enforced"})
	})
	_ = http.ListenAndServe(":"+env("PORT", "6110"), nil)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
