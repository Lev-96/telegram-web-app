// The panel modules this app replaces, and with what. Everything NOT listed is
// the desktop panel's own code, unchanged. Read by vite.config.ts; tsconfig.json
// carries the same map under `paths` (tests/overrides.test.ts keeps the two in
// step), so the typecheck sees exactly what the bundle contains.
//
// Each replacement exports the same names as the module it replaces.
export const overrides = {
  // Sign in / out through /owner-web/session/*: the desktop's /session/logout
  // would delete every token of the user, the desktop's included.
  "@/api/auth": "src/overrides/auth.ts",
  // The session token lives in sessionStorage, not localStorage.
  "@/infrastructure/KeyValueStore": "src/overrides/KeyValueStore.ts",
  // A shell that works from 360px up: the desktop's is a fixed 240px sidebar.
  "@/components/Layout": "src/overrides/Layout.tsx",
  // A light sign-in screen (the desktop's carries a three.js scene), which in
  // Telegram explains how to get back in instead of asking for a password.
  "@/routes/Login": "src/overrides/Login.tsx",
  // Desktop-panel telemetry must not count browser traffic as the desktop's.
  "@/telemetry/TelemetryTracker": "src/overrides/TelemetryTracker.tsx",
};
