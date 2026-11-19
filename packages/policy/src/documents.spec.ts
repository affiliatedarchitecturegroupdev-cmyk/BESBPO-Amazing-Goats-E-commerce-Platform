import { describe, expect, it } from 'vitest';
import { COOKIES, POLICIES, policyBySlug, PRIVACY, TERMS } from './documents';
import { assertValidHistory, currentVersion, diffVersions, versionAt } from './versioning';

/**
 * These tests hold the *content* to the same standard as the code: every
 * document is a valid history, every section says something, and the facts a
 * shopper is told match the rules the platform actually implements. A policy
 * page that contradicts the cut-off engine or the VAT rule is worse than no page
 * at all, because it is a promise the platform breaks.
 */
describe('the policy set', () => {
  it('has every document the storefront links', () => {
    expect(POLICIES.map((p) => p.slug).sort()).toEqual(
      ['about', 'contact', 'cookies', 'privacy', 'returns', 'terms'].sort(),
    );
  });

  it('has a unique slug per document', () => {
    const slugs = POLICIES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('finds a document by slug, and nothing for an unknown one', () => {
    expect(policyBySlug('privacy')).toBe(PRIVACY);
    expect(policyBySlug('nope')).toBeUndefined();
  });

  it.each(POLICIES.map((p) => [p.slug, p] as const))('%s is a valid version history', (_slug, doc) => {
    expect(() => assertValidHistory(doc)).not.toThrow();
  });

  it.each(POLICIES.map((p) => [p.slug, p] as const))('%s has a title, a summary and a first version', (_slug, doc) => {
    expect(doc.title.length).toBeGreaterThan(0);
    expect(doc.summary.length).toBeGreaterThan(0);
    expect(doc.versions[0].version).toBe(1);
  });

  it.each(POLICIES.map((p) => [p.slug, p] as const))('%s has no empty section', (_slug, doc) => {
    for (const version of doc.versions) {
      for (const section of version.sections) {
        expect(section.heading.trim(), `${doc.slug} v${version.version} heading`).not.toBe('');
        const hasContent = section.paragraphs.some((p) => p.trim()) || (section.bullets ?? []).length > 0;
        expect(hasContent, `${doc.slug} v${version.version} "${section.heading}"`).toBe(true);
      }
    }
  });
});

describe('privacy notice (POPIA)', () => {
  const headings = PRIVACY.versions[0].sections.map((s) => s.heading.toLowerCase());

  it('covers what POPIA requires a notice to say', () => {
    // The task card names these; a notice missing one is not a POPIA notice.
    expect(headings.some((h) => h.includes('what we collect'))).toBe(true);
    expect(headings.some((h) => h.includes('lawful basis'))).toBe(true);
    expect(headings.some((h) => h.includes('how long'))).toBe(true);
    expect(headings.some((h) => h.includes('your rights'))).toBe(true);
    expect(headings.some((h) => h.includes('who we are'))).toBe(true);
  });

  it('names the information officer and the Information Regulator', () => {
    const text = JSON.stringify(PRIVACY);
    expect(text).toMatch(/information officer/i);
    expect(text).toMatch(/Information Regulator/i);
  });

  it('describes the append-only access log the platform actually keeps', () => {
    // db/migrations/0001 creates audit.data_access_log with a trigger that
    // blocks update and delete, so this claim is true.
    expect(JSON.stringify(PRIVACY)).toMatch(/append-only audit log/i);
  });

  it('says that order messages are not marketing, matching the consent rule', () => {
    // services/notifications/src/consent: transactional messages need no opt-in.
    expect(JSON.stringify(PRIVACY)).toMatch(/an order you place is not marketing/i);
  });

  it('flags the EU analytics transfer, because Koyeb runs in Frankfurt', () => {
    expect(JSON.stringify(PRIVACY)).toMatch(/European Union/i);
  });
});

describe('terms of sale (CPA)', () => {
  const text = JSON.stringify(TERMS);

  it('states that prices exclude VAT at 15%', () => {
    expect(text).toMatch(/exclude VAT unless/i);
    expect(text).toMatch(/15%/);
  });

  it('describes the real cut-off: Sunday 17:00 for chilled meat', () => {
    // services/commerce/src/cycles/cutoff.ts: chilledMeatCycle → Sunday 17:00.
    expect(text).toMatch(/Sunday at 17:00/);
  });

  it('describes the real delivery window: Wednesday to Friday', () => {
    expect(text).toMatch(/Wednesday to Friday/);
  });

  it('says perishables cannot be cancelled after cut-off, which is the engine rule', () => {
    expect(text).toMatch(/perishable item cannot be cancelled/i);
  });

  it('does not take away CPA rights', () => {
    expect(text).toMatch(/Consumer Protection Act 68 of 2008/);
    expect(text).toMatch(/nothing here takes away/i);
  });

  it('warns about penalty interest only at the rate the NCA allows', () => {
    expect(text).toMatch(/National Credit Act/);
  });
});

describe('cookie notice', () => {
  it('lists the session cookie under its real name', () => {
    // packages/rbac/src/session.ts: SESSION_COOKIE = 'ag_session'.
    expect(JSON.stringify(COOKIES)).toMatch(/ag_session/);
  });

  it('says the session cookie is httpOnly, which it is', () => {
    expect(JSON.stringify(COOKIES)).toMatch(/httpOnly/);
  });

  it('separates essential from optional cookies', () => {
    expect(JSON.stringify(COOKIES)).toMatch(/essential/i);
    expect(JSON.stringify(COOKIES)).toMatch(/optional/i);
  });
});

describe('versioning works on the real documents', () => {
  it('the current version of every policy is v1 today', () => {
    for (const doc of POLICIES) {
      expect(currentVersion(doc, '2026-11-14').version).toBe(1);
    }
  });

  it('a policy added later keeps v1 visible in its history', () => {
    // This is the whole point of the task: a shopper can always see the first
    // version. Simulate the company publishing v2 and confirm v1 survives.
    const withV2 = {
      ...PRIVACY,
      versions: [
        ...PRIVACY.versions,
        {
          ...PRIVACY.versions[0],
          version: 2,
          effectiveFrom: '2027-01-01',
          changeNote: 'Retention period confirmed as 7 years.',
        },
      ],
    };
    expect(() => assertValidHistory(withV2)).not.toThrow();
    expect(versionAt(withV2, '2026-12-01')?.version).toBe(1);
    expect(versionAt(withV2, '2027-01-01')?.version).toBe(2);
    expect(diffVersions(withV2, 1, 2)).toEqual({ from: 1, to: 2, added: [], removed: [], changed: [] });
  });
});
