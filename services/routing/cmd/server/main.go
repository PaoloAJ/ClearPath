package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"clearpath/routing/internal/api"
	"clearpath/routing/internal/auth"
	"clearpath/routing/internal/barriers"
	"clearpath/routing/internal/graph"
)

func main() {
	if err := run(); err != nil {
		slog.Error("routing service stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	graphs := graph.NewStore(pool)
	if err := graphs.Reload(ctx); err != nil {
		return err
	}
	go graphs.Run(ctx, cfg.GraphReloadInterval)

	blocks := barriers.NewStore(pool)
	if err := blocks.Refresh(ctx); err != nil {
		return err
	}
	go blocks.Run(ctx, cfg.BarrierRefreshInterval)

	auth.Init(cfg.ClerkSecretKey)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           api.NewRouter(graphs, blocks, auth.Require),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	slog.Info("listening", "addr", srv.Addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
