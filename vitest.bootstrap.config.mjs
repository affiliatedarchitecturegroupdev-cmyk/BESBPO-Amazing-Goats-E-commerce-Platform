import { defineConfig } from 'vitest/config';

// Root test for the monorepo wiring itself (scripts/bootstrap.spec.mjs).
// Deliberately not named vitest.config.* — workspace packages have no config of
// their own, so a root vitest.config.mjs would be inherited and override their
// test discovery. Run it explicitly: vitest run --config vitest.bootstrap.config.mjs
export default defineConfig({
  test: { include: ['scripts/**/*.spec.mjs'] },
});
