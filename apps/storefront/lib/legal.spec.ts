import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POLICIES, policyBySlug } from '@ag/policy';

/**
 * The footer links every policy by slug, and Next routes on the file system. If a
 * policy exists without a page the footer ships a 404; if a page exists without a
 * policy nothing links to it. So the two are checked against each other here
 * rather than discovered in production.
 */
const LEGAL_DIR = join(__dirname, '..', 'app', '(legal)');

describe('legal routes', () => {
  it.each(POLICIES.map((p) => p.slug))('/%s has a page, a history and a version route', (slug) => {
    expect(existsSync(join(LEGAL_DIR, slug, 'page.tsx'))).toBe(true);
    expect(existsSync(join(LEGAL_DIR, slug, 'history', 'page.tsx'))).toBe(true);
    expect(existsSync(join(LEGAL_DIR, slug, 'v', '[version]', 'page.tsx'))).toBe(true);
  });

  it('has no legal page that is not in the policy set', () => {
    // Guards the other direction: a page left behind after a policy is retired.
    const slugs = POLICIES.map((p) => p.slug);
    for (const slug of ['privacy', 'terms', 'cookies', 'returns', 'contact', 'about']) {
      expect(slugs, `${slug} has a page but no policy`).toContain(slug);
    }
  });

  it('resolves every footer link to a document', () => {
    for (const policy of POLICIES) {
      expect(policyBySlug(policy.slug), policy.slug).toBeDefined();
    }
  });
});

describe('checkout consent', () => {
  it('links the terms, the privacy notice and the returns policy before payment', () => {
    // The CPA requires the terms to be available before payment. Read the
    // checkout source so removing a link fails a test rather than a shopper.
    const source = require('node:fs').readFileSync(
      join(__dirname, '..', 'app', 'checkout', 'page.tsx'),
      'utf8',
    ) as string;
    expect(source).toMatch(/href="\/terms"/);
    expect(source).toMatch(/href="\/privacy"/);
    expect(source).toMatch(/href="\/returns"/);
    expect(source).toMatch(/name="acceptTerms"/);
  });
});

describe('guest checkout stays open (T-059 guard fix)', () => {
  it('does not guard /checkout, which is built around guest checkout', () => {
    // The first version of the storefront guard listed /checkout, which would
    // have sent every first-time buyer to sign in. Checkout reads a cart cookie
    // and takes a name and phone number on the page; it needs no session.
    const source = require('node:fs').readFileSync(
      join(__dirname, '..', 'middleware.ts'),
      'utf8',
    ) as string;
    const guarded = /const GUARDED_PATHS = \[([^\]]*)\]/.exec(source)?.[1] ?? '';
    expect(guarded).toContain('/account');
    expect(guarded).not.toContain('/checkout');
  });

  it('the checkout page still offers guest checkout', () => {
    const source = require('node:fs').readFileSync(
      join(__dirname, '..', 'app', 'checkout', 'page.tsx'),
      'utf8',
    ) as string;
    expect(source).toMatch(/Guest or sign in/i);
  });
});

describe('footer', () => {
  it('links every policy and routes partner ads through the sponsored filter', () => {
    const source = require('node:fs').readFileSync(
      join(__dirname, '..', 'components', 'SiteFooter.tsx'),
      'utf8',
    ) as string;
    expect(source).toMatch(/POLICIES\.map/);
    expect(source).toMatch(/renderableAds/);
    expect(source).toMatch(/A10/);
  });
});
