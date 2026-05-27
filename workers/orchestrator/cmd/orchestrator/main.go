package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func main() {
	service := env("SERVICE_NAME", "orchestrator")
	http.HandleFunc("/health", health(service))
	http.HandleFunc("/events/scan.created", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]any{"accepted": true, "service": service})
	})
	addr := ":" + env("PORT", "5100")
	log.Printf("%s listening on %s", service, addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

func health(service string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true, "service": service, "nats_url": env("NATS_URL", "nats://localhost:4222"),
		})
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
