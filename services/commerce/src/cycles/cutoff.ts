/**
 * The cut-off engine moved to `@ag/cutoff` so logistics can answer "when is the
 * next delivery, and by when must I order" from the same rule rather than a
 * second copy (docs/04-cutoff-engine.md). This module stays as the import path
 * the cycle engine and produce onboarding already use.
 */
export * from '@ag/cutoff';
