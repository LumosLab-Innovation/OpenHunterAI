package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func main() {
	service := env("SERVICE_NAME", "zap-signal")
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true, "service": service, "integration_url": env("ZAPROXY_INTEGRATION_URL", "http://zaproxy-adapter:6100"),
		})
	})
	http.HandleFunc("/run", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]any{"accepted": true, "service": service})
	})
	addr := ":" + env("PORT", "5120")
	log.Printf("%s listening on %s", service, addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
