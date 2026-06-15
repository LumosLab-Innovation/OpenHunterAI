package bus

import (
	"testing"
	"time"
)

func TestRetryDelayUsesIncreasingBackoff(t *testing.T) {
	cases := []struct {
		attempt uint64
		want    time.Duration
	}{
		{attempt: 0, want: time.Second},
		{attempt: 1, want: time.Second},
		{attempt: 2, want: 5 * time.Second},
		{attempt: 3, want: 15 * time.Second},
		{attempt: 4, want: 30 * time.Second},
		{attempt: 5, want: 60 * time.Second},
		{attempt: 6, want: 60 * time.Second},
	}

	for _, tc := range cases {
		if got := retryDelay(tc.attempt); got != tc.want {
			t.Fatalf("retryDelay(%d) = %s, want %s", tc.attempt, got, tc.want)
		}
	}
}
