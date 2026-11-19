import Link from 'next/link';
import {
  currentVersion,
  diffVersions,
  isFirstVersion,
  previousVersion,
  versionHistory,
  type PolicyDocument,
  type PolicyVersion,
} from '@ag/policy';

/**
 * Renders one policy version, with its version number, effective date and change
 * note (T-060).
 *
 * The version stamp is the point of the task: a shopper must be able to see which
 * version they are reading and what changed, from the first version onward. So
 * every page carries the version, and links to the history where the full list
 * lives.
 */
export function PolicyBody({
  doc,
  version,
  basePath,
}: {
  doc: PolicyDocument;
  version: PolicyVersion;
  /** The route prefix this document is served under, e.g. `/privacy`. */
  basePath: string;
}) {
  return (
    <article>
      <header style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 18 }}>
        <h1 style={{ marginBottom: 6 }}>{doc.title}</h1>
        <p className="p" style={{ margin: 0 }}>{doc.summary}</p>
        <p className="p" style={{ marginTop: 8 }}>
          <span className="tag">Version {version.version}</span>{' '}
          <span className="p">In force from {version.effectiveFrom}</span>
        </p>
      </header>

      {version.sections.map((section) => (
        <section key={section.heading} style={{ marginBottom: 22 }}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          {section.bullets && section.bullets.length > 0 && (
            <ul>
              {section.bullets.map((bullet, index) => (
                <li key={index}>{bullet}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <footer style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 12 }}>
        <p className="p">
          <strong>What changed in this version:</strong> {version.changeNote}
        </p>
        <p className="p">
          Approved by: {version.approvedBy}.{' '}
          <Link href={`${basePath}/history`}>See every version of this policy</Link>.
        </p>
        <p className="p">
          This page is a draft prepared for legal review. Items in square brackets need company
          input before it is final.
        </p>
      </footer>
    </article>
  );
}

/**
 * The version history, newest first. Each entry links to that version, and a
 * version after the first shows what changed against the one before it.
 */
export function PolicyHistory({
  doc,
  basePath,
}: {
  doc: PolicyDocument;
  basePath: string;
}) {
  const history = versionHistory(doc);

  return (
    <article>
      <h1>{doc.title}: version history</h1>
      <p className="p">
        Every version of this policy, newest first. A shopper can read any version, so a change is
        never silent.
      </p>

      <ol style={{ paddingLeft: 0, listStyle: 'none' }}>
        {history.map((version) => {
          const previous = previousVersion(doc, version.version);
          const diff = previous ? diffVersions(doc, previous.version, version.version) : undefined;
          const changed = diff && (diff.added.length || diff.removed.length || diff.changed.length);

          return (
            <li key={version.version} className="card" style={{ marginBottom: 12 }}>
              <div className="row">
                <strong>
                  Version {version.version}
                  {isFirstVersion(doc, version.version) && <span className="tag"> First version</span>}
                </strong>
                <span className="p">In force from {version.effectiveFrom}</span>
              </div>

              <p className="p" style={{ marginTop: 6 }}>{version.changeNote}</p>

              {diff && changed ? (
                <p className="p">
                  {diff.changed.length > 0 && <>Changed: {diff.changed.join('; ')}. </>}
                  {diff.added.length > 0 && <>Added: {diff.added.join('; ')}. </>}
                  {diff.removed.length > 0 && <>Removed: {diff.removed.join('; ')}.</>}
                </p>
              ) : null}

              <p style={{ marginBottom: 0 }}>
                <Link href={`${basePath}/v/${version.version}`}>Read version {version.version}</Link>
                {version.version !== currentVersion(doc).version && (
                  <> · <Link href={basePath}>Read the current version</Link></>
                )}
              </p>
            </li>
          );
        })}
      </ol>

      <p className="p">
        <Link href={basePath}>Back to {doc.title.toLowerCase()}</Link>
      </p>
    </article>
  );
}
