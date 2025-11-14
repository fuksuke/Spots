# Playwright E2E Tests

## Setup
1. Install dependencies (Playwright is listed in `devDependencies`).
2. Install browser binaries with `npx playwright install`.
3. Export credentials forテストアカウント:
   ```bash
   export E2E_EMAIL="tester@example.com"
   export E2E_PASSWORD="secret"
   export E2E_ADMIN_EMAIL="admin@example.com"
   export E2E_ADMIN_PASSWORD="admin-secret"
   ```
   Alternatively set them inline when running the tests.

## Running locally
```
npm run test:e2e
```
The Playwright config starts both backend (`npm run dev --workspace backend`) and frontend (`npm run dev`). Use `CI=1 npm run test:e2e` to run headless without reusing existing servers.
