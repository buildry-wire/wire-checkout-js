# Changelog

Format: Keep a Changelog; semver.

## [Unreleased]

## [1.0.1] - 2026-10-12

### Changed
- README: amounts are whole tögrög (MNT integer, no fractional part — `50000` is 50,000 ₮, not 500.00). Examples no longer use the `sandbox` operator or test mode, which the production API does not offer; omitting `allowed_operators` routes to the operators enabled on your project.

## [1.0.0] - 2026-06-07
First public release.

### Added
- `WireCheckout` client-side presenter for Wire hosted checkout.
- `redirectToCheckout` (full-page) and `open` (popup / overlay) presentation modes.
- Status-API polling state machine with configurable interval and timeout — the
  status API is the single source of truth for completion.
- URL/token parsing and https host validation.
- Injectable `Browser` seam (fetch + window abstractions) for testability.
- Zero runtime dependencies; ESM + CJS + type declarations.
