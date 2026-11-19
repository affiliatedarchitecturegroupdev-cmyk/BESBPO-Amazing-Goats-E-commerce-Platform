import { describe, expect, it } from 'vitest';
import {
  assertValidHistory,
  currentVersion,
  diffVersions,
  isFirstVersion,
  parseVersionLabel,
  PolicyHistoryError,
  previousVersion,
  versionAt,
  versionHistory,
  versionLabel,
  type PolicyDocument,
} from './versioning';

function doc(): PolicyDocument {
  return {
    slug: 'privacy',
    title: 'Privacy',
    summary: 's',
    versions: [
      {
        version: 1,
        effectiveFrom: '2026-01-01',
        changeNote: 'First published version.',
        approvedBy: 'legal',
        sections: [
          { heading: 'Who we are', paragraphs: ['We are Amazing Goats.'] },
          { heading: 'Retention', paragraphs: ['We keep invoices for 5 years.'] },
        ],
      },
      {
        version: 2,
        effectiveFrom: '2026-06-01',
        changeNote: 'Retention changed to 7 years; added a security section.',
        approvedBy: 'legal',
        sections: [
          { heading: 'Who we are', paragraphs: ['We are Amazing Goats.'] },
          { heading: 'Retention', paragraphs: ['We keep invoices for 7 years.'] },
          { heading: 'Security', paragraphs: ['We use an append-only audit log.'] },
        ],
      },
    ],
  };
}

describe('assertValidHistory', () => {
  it('accepts a well-formed history', () => {
    expect(() => assertValidHistory(doc())).not.toThrow();
  });

  it('rejects a document with no versions', () => {
    expect(() => assertValidHistory({ ...doc(), versions: [] })).toThrow(PolicyHistoryError);
  });

  it('rejects a gap in the numbering, which would hide a version from shoppers', () => {
    const d = doc();
    d.versions[1].version = 3;
    expect(() => assertValidHistory(d)).toThrow(/out of order/);
  });

  it('rejects a version with no change note', () => {
    const d = doc();
    d.versions[1].changeNote = '   ';
    expect(() => assertValidHistory(d)).toThrow(/no change note/);
  });

  it('rejects a malformed date', () => {
    const d = doc();
    d.versions[1].effectiveFrom = '01/06/2026';
    expect(() => assertValidHistory(d)).toThrow(/bad date/);
  });

  it('rejects a version that takes effect before its predecessor', () => {
    const d = doc();
    d.versions[1].effectiveFrom = '2025-12-01';
    expect(() => assertValidHistory(d)).toThrow(/before version 1/);
  });

  it('rejects a version with no sections', () => {
    const d = doc();
    d.versions[1].sections = [];
    expect(() => assertValidHistory(d)).toThrow(/no sections/);
  });
});

describe('versionAt', () => {
  it('returns the first version before the second takes effect', () => {
    expect(versionAt(doc(), '2026-03-01')?.version).toBe(1);
  });

  it('returns the second version from its effective date', () => {
    expect(versionAt(doc(), '2026-06-01')?.version).toBe(2);
  });

  it('is half-open: the new version applies on its own date, not the day after', () => {
    expect(versionAt(doc(), '2026-05-31')?.version).toBe(1);
    expect(versionAt(doc(), '2026-06-01')?.version).toBe(2);
  });

  it('ignores the time part of a timestamp', () => {
    expect(versionAt(doc(), '2026-06-01T23:59:59Z')?.version).toBe(2);
  });

  it('returns undefined before the policy existed', () => {
    expect(versionAt(doc(), '2025-12-31')).toBeUndefined();
  });

  it('lets a same-day correction win, so the shopper sees the latest text', () => {
    const d = doc();
    d.versions[1].effectiveFrom = '2026-01-01';
    expect(versionAt(d, '2026-01-01')?.version).toBe(2);
  });
});

describe('currentVersion', () => {
  it('returns the latest version in force', () => {
    expect(currentVersion(doc(), '2026-07-01').version).toBe(2);
  });

  it('returns the first version when no version is in force yet', () => {
    // A document dated in the future must still render something rather than
    // throwing; the page shows it as the current draft.
    expect(currentVersion(doc(), '2025-01-01').version).toBe(1);
  });
});

describe('versionHistory', () => {
  it('lists newest first', () => {
    expect(versionHistory(doc()).map((v) => v.version)).toEqual([2, 1]);
  });
});

describe('previousVersion', () => {
  it('finds the version before the given one', () => {
    expect(previousVersion(doc(), 2)?.version).toBe(1);
  });

  it('returns undefined for the first version, which has nothing before it', () => {
    expect(previousVersion(doc(), 1)).toBeUndefined();
  });
});

describe('diffVersions', () => {
  it('reports a changed section and an added one', () => {
    const diff = diffVersions(doc(), 1, 2);
    expect(diff.changed).toEqual(['Retention']);
    expect(diff.added).toEqual(['Security']);
    expect(diff.removed).toEqual([]);
  });

  it('reports a removed section', () => {
    const d = doc();
    d.versions[1].sections = [{ heading: 'Who we are', paragraphs: ['We are Amazing Goats.'] }];
    const diff = diffVersions(d, 1, 2);
    expect(diff.removed).toEqual(['Retention']);
  });

  it('reports no change for identical versions', () => {
    const d = doc();
    d.versions[1].sections = d.versions[0].sections;
    expect(diffVersions(d, 1, 2)).toEqual({ from: 1, to: 2, added: [], removed: [], changed: [] });
  });

  it('treats a bullet-list change as a change to that section', () => {
    const d = doc();
    d.versions[0].sections[1].bullets = ['a'];
    d.versions[1].sections[1].bullets = ['a', 'b'];
    expect(diffVersions(d, 1, 2).changed).toEqual(['Retention']);
  });

  it('throws for a version that does not exist', () => {
    expect(() => diffVersions(doc(), 1, 9)).toThrow(/no version 9/);
  });
});

describe('isFirstVersion', () => {
  it('is true only for version 1', () => {
    expect(isFirstVersion(doc(), 1)).toBe(true);
    expect(isFirstVersion(doc(), 2)).toBe(false);
  });
});

describe('version labels', () => {
  it('round-trips a label', () => {
    expect(versionLabel(3)).toBe('v3');
    expect(parseVersionLabel('v3')).toBe(3);
  });

  it('rejects a malformed label', () => {
    expect(parseVersionLabel('3')).toBeUndefined();
    expect(parseVersionLabel('v')).toBeUndefined();
    expect(parseVersionLabel(undefined)).toBeUndefined();
  });
});
