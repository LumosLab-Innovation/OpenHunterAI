package signal

import "testing"

func TestIntendedProvenanceForUnavailableRuntime(t *testing.T) {
	cases := map[string]string{"Z": "ghcr.io/zaproxy/zaproxy:2.17.0", "N": "v3.4.10", "O": "native", "S": "v1.6.2"}
	for workerType, want := range cases {
		got := intendedProvenance(workerType)
		if got.UpstreamRef != want || got.AdapterVersion == "" {
			t.Errorf("%s provenance = %+v, want ref %q", workerType, got, want)
		}
	}
}
