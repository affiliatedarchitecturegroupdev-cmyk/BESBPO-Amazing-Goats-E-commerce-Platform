import { defineConfig } from 'vitest/config';

// Root test for the deployment manifests (infra/deploy.spec.mjs).
// Like vitest.bootstrap.config.mjs it is deliberately not named
// vitest.config.* — a root config is inherited by every workspace that has none
// of its own, and its `test.include` would override their discovery. Run it
// explicitly: vitest run --config vitest.deploy.config.mjs
export default defineConfig({
  test: { include: ['infra/**/*.spec.mjs'] },
});
