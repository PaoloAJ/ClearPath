package main

import (
	"fmt"
	"os"
	"time"
)

type config struct {
	Port                   string
	DatabaseURL            string
	ClerkSecretKey         string
	GraphReloadInterval    time.Duration
	BarrierRefreshInterval time.Duration
}

func loadConfig() (config, error) {
	cfg := config{
		Port:           getenv("PORT", "8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		ClerkSecretKey: os.Getenv("CLERK_SECRET_KEY"),
	}
	if cfg.DatabaseURL == "" {
		return cfg, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.ClerkSecretKey == "" {
		return cfg, fmt.Errorf("CLERK_SECRET_KEY is required")
	}

	var err error
	if cfg.GraphReloadInterval, err = time.ParseDuration(getenv("GRAPH_RELOAD_INTERVAL", "5m")); err != nil {
		return cfg, fmt.Errorf("GRAPH_RELOAD_INTERVAL: %w", err)
	}
	if cfg.BarrierRefreshInterval, err = time.ParseDuration(getenv("BARRIER_REFRESH_INTERVAL", "15s")); err != nil {
		return cfg, fmt.Errorf("BARRIER_REFRESH_INTERVAL: %w", err)
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
