// Package auth verifies Clerk session tokens.
package auth

import (
	"context"
	"net/http"

	"github.com/clerk/clerk-sdk-go/v2"
	clerkhttp "github.com/clerk/clerk-sdk-go/v2/http"
)

// RoleFacilities may post verified alerts and elevator statuses.
const RoleFacilities = "facilities"

// customClaims matches the session token template in Clerk: {"app_role": "{{user.public_metadata.role}}"}.
// It can't be named "role": Supabase reads that claim as the Postgres role ("authenticated").
type customClaims struct {
	AppRole string `json:"app_role"`
}

func Init(secretKey string) {
	clerk.SetKey(secretKey)
}

// Require rejects requests without a valid Clerk session token (Authorization: Bearer ...).
var Require = clerkhttp.RequireHeaderAuthorization(
	clerkhttp.CustomClaimsConstructor(func(context.Context) any { return &customClaims{} }),
)

// UserID returns the Clerk user ID (the token's sub claim).
func UserID(ctx context.Context) (string, bool) {
	claims, ok := clerk.SessionClaimsFromContext(ctx)
	if !ok {
		return "", false
	}
	return claims.Subject, true
}

// Role returns the app_role claim, or "" for regular students.
func Role(ctx context.Context) string {
	claims, ok := clerk.SessionClaimsFromContext(ctx)
	if !ok {
		return ""
	}
	if c, ok := claims.Custom.(*customClaims); ok {
		return c.AppRole
	}
	return ""
}

// Middleware is the shape api.NewRouter expects, so tests can swap in a fake.
type Middleware = func(http.Handler) http.Handler
