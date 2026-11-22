import { serializeJsonLd, type JsonLdNode } from '../lib/jsonld';

/**
 * Renders one or more schema.org nodes as `application/ld+json` blocks.
 *
 * `dangerouslySetInnerHTML` is the only way to put JSON inside a script tag, and
 * it is safe here because `serializeJsonLd` escapes every character that could
 * close the element. Nothing in the payload is interpolated as HTML.
 */
export function JsonLd({ nodes }: { nodes: (JsonLdNode | undefined)[] }) {
  const payloads = nodes.filter((n): n is JsonLdNode => n !== undefined);
  if (payloads.length === 0) return null;
  return (
    <>
      {payloads.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }}
        />
      ))}
    </>
  );
}
