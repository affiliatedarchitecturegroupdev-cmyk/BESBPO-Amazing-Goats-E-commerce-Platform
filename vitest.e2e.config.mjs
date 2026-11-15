import { defineConfig } from 'vitest/config';

// End-to-end journey tests (T-035). These compose the real service modules —
// commerce, payments, logistics — through their source, so a change that breaks
// a cross-service contract fails here even when each service's own tests pass.
//
// Deliberately not named vitest.config.* : a root config is inherited by every
// workspace with none of its own and its `test.include` would override their
// discovery. Run it explicitly: vitest run --config vitest.e2e.config.mjs
export default defineConfig({
  test: { include: ['tests/**/*.spec.ts'] },
});
