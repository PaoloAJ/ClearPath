package barriers

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestQueries runs the SQL against a real database (local Supabase) to catch column or syntax
// mistakes. It's skipped unless ROUTING_TEST_DATABASE_URL is set.
func TestQueries(t *testing.T) {
	url := os.Getenv("ROUTING_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("ROUTING_TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	s := NewStore(pool)
	if err := s.Refresh(ctx); err != nil {
		t.Fatalf("Refresh: %v", err)
	}
	got, err := s.EdgesBlockedByAlert(ctx, "00000000-0000-0000-0000-000000000000", []int64{1, 2})
	if err != nil || len(got) != 0 {
		t.Fatalf("EdgesBlockedByAlert = %v, %v, want no edges", got, err)
	}
}
