# FinFlow Frontend

## Production readiness notes

- The app now includes a top-level error boundary so unexpected UI failures surface a graceful fallback instead of a blank screen.
- Dashboard and transaction views now show loading skeletons and empty states during slow or empty responses.
- The production build is validated with Vite before release.

## Verification

- `npm run build`
- `npm run dev`
