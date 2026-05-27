package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func main() {
	service := env("SERVICE_NAME", "nuclei-signal")
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true, "service": service, "integration_url": env("NUCLEI_INTEGRATION_URL", "http://nuclei-adapter:6110"),
		})
	})
	http.HandleFunc("/run", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]any{"accepted": true, "service": service})
	})
	addr := ":" + env("PORT", "5130")
	log.Printf("%s listening on %s", service, addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
