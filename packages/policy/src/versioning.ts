/**
 * Policy versioning (T-060).
 *
 * A legal page is not a document you edit; it is a document with a history. A
 * shopper is entitled to see what they agreed to, and to see what changed since
 * — POPIA requires a privacy notice that is current and traceable, and the
 * Consumer Protection Act requires terms that are available before payment. So a
 * policy here is a list of numbered versions, each with the date it took effect
 * and a plain-language note of what changed.
 *
 * Everything in this file is pure: no clock, no I/O, no store. `at` is always
 * passed in. That is what lets the versioning rules be tested without a database
 * and reused by a future admin editor that writes new versions.
 */

/** One block of a policy: a heading and its paragraphs. */
export interface PolicySection {
  heading: string;
  paragraphs: string[];
  /** A bulleted list, rendered after the paragraphs. */
  bullets?: string[];
}

/** One published version of a policy. */
export interface PolicyVersion {
  /** 1 for the first version, incrementing by one. */
  version: number;
  /** ISO date (YYYY-MM-DD) the version took effect. */
  effectiveFrom: string;
  /** What changed in this version, in plain language. */
  changeNote: string;
  /** Who approved it. A legal page is a gated path, so this is not decorative. */
  approvedBy: string;
  sections: PolicySection[];
}

/** A policy and its full history, oldest version first. */
export interface PolicyDocument {
  /** URL segment, e.g. `privacy`. */
  slug: string;
  title: string;
  /** A one-line description, used for metadata and the footer. */
  summary: string;
  versions: PolicyVersion[];
}

/** Thrown when a document's history is not a valid chain of versions. */
export class PolicyHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyHistoryError';
  }
}

/**
 * Checks that a document's versions form a valid history: numbering starts at 1,
 * increments by one, dates do not go backwards, and every version explains
 * itself.
 *
 * This is a startup assertion, not a user-facing error. A history with a gap or
 * a silent version would let a change reach a shopper with no record of what
 * changed, which is the one thing the versioning exists to prevent.
 */
export function assertValidHistory(doc: PolicyDocument): void {
  if (doc.versions.length === 0) {
    throw new PolicyHistoryError(`${doc.slug} has no versions`);
  }

  doc.versions.forEach((version, index) => {
    const expected = index + 1;
    if (version.version !== expected) {
      throw new PolicyHistoryError(
        `${doc.slug} version ${expected} is out of order: found ${version.version}`,
      );
    }
    if (!version.changeNote.trim()) {
      throw new PolicyHistoryError(`${doc.slug} version ${version.version} has no change note`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(version.effectiveFrom)) {
      throw new PolicyHistoryError(
        `${doc.slug} version ${version.version} has a bad date: ${version.effectiveFrom}`,
      );
    }
    if (version.sections.length === 0) {
      throw new PolicyHistoryError(`${doc.slug} version ${version.version} has no sections`);
    }
    if (index > 0 && version.effectiveFrom < doc.versions[index - 1].effectiveFrom) {
      throw new PolicyHistoryError(
        `${doc.slug} version ${version.version} takes effect before version ${expected - 1}`,
      );
    }
  });
}

/**
 * The version in force at `at`, or undefined when the policy had not started yet.
 *
 * A version applies from its `effectiveFrom` date inclusive until the next
 * version's date — the same half-open `[from, to)` window the pricing rules use.
 * When two versions share a date the later one wins, so a same-day correction is
 * the one a shopper sees.
 */
export function versionAt(doc: PolicyDocument, at: string): PolicyVersion | undefined {
  const date = at.slice(0, 10);
  let found: PolicyVersion | undefined;
  for (const version of doc.versions) {
    if (version.effectiveFrom <= date) found = version;
  }
  return found;
}

/**
 * The version a shopper sees now. Every policy in this repo is dated, so this is
 * the latest version that has taken effect — not simply the last in the list, in
 * case a future version is drafted with a date in the future.
 */
export function currentVersion(doc: PolicyDocument, now: string = new Date().toISOString()): PolicyVersion {
  return versionAt(doc, now) ?? doc.versions[0];
}

/** The history a shopper can browse, newest first. */
export function versionHistory(doc: PolicyDocument): PolicyVersion[] {
  return [...doc.versions].sort((a, b) => b.version - a.version);
}

/** The version before this one, or undefined for the first. */
export function previousVersion(doc: PolicyDocument, version: number): PolicyVersion | undefined {
  return doc.versions.find((v) => v.version === version - 1);
}

/** What changed between two versions, section by section. */
export interface VersionDiff {
  from: number;
  to: number;
  added: string[];
  removed: string[];
  changed: string[];
}

/**
 * A section-level comparison of two versions, keyed by heading.
 *
 * Section-level rather than line-level: a shopper reading "what changed" wants
 * "the retention section now says 7 years", not a word diff. A heading that
 * appears in both but whose text differs is `changed`; one that appears only in
 * the newer version is `added`; only in the older, `removed`.
 */
export function diffVersions(doc: PolicyDocument, fromVersion: number, toVersion: number): VersionDiff {
  const from = doc.versions.find((v) => v.version === fromVersion);
  const to = doc.versions.find((v) => v.version === toVersion);
  if (!from) throw new PolicyHistoryError(`${doc.slug} has no version ${fromVersion}`);
  if (!to) throw new PolicyHistoryError(`${doc.slug} has no version ${toVersion}`);

  const before = new Map(from.sections.map((s) => [s.heading, sectionText(s)]));
  const after = new Map(to.sections.map((s) => [s.heading, sectionText(s)]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [heading, text] of after) {
    if (!before.has(heading)) added.push(heading);
    else if (before.get(heading) !== text) changed.push(heading);
  }
  for (const heading of before.keys()) {
    if (!after.has(heading)) removed.push(heading);
  }

  return { from: fromVersion, to: toVersion, added, removed, changed };
}

function sectionText(section: PolicySection): string {
  return [...section.paragraphs, ...(section.bullets ?? [])].join('\n');
}

/**
 * Whether a version is the first, which the UI labels differently: the first
 * version has nothing to compare against, so the history shows its note alone
 * rather than an empty diff.
 */
export function isFirstVersion(doc: PolicyDocument, version: number): boolean {
  return doc.versions.length > 0 && doc.versions[0].version === version;
}

/** The version id used in a URL, e.g. `v2`. */
export function versionLabel(version: number): string {
  return `v${version}`;
}

/** Parses a `v2` style label back to a number, or undefined. */
export function parseVersionLabel(label: string | undefined): number | undefined {
  if (!label) return undefined;
  const match = /^v(\d+)$/.exec(label);
  return match ? Number(match[1]) : undefined;
}
