import { describe, it, expect } from 'vitest';
import { DocumentsService } from './documents.service';
import { InMemoryPartnerStore } from '../partner.store';
import type { PartnerDocument } from '../partner-domain';

const doc = (over: Partial<PartnerDocument> = {}): PartnerDocument => ({
  id: 'doc-1',
  orgId: 'org-1',
  name: 'Halaal certificate',
  expiresOn: '2027-01-12',
  ...over,
});

const service = (seed: PartnerDocument[]) => new DocumentsService(new InMemoryPartnerStore({ documents: seed }));
const now = new Date('2026-01-01T00:00:00Z');

describe('DocumentsService', () => {
  it('lists only the org’s own documents', async () => {
    const svc = service([doc(), doc({ id: 'doc-2', orgId: 'org-2' })]);
    const rows = await svc.list('org-1', now);
    expect(rows.map((r) => r.id)).toEqual(['doc-1']);
  });

  it('tags each document with how it stands against today', async () => {
    const svc = service([
      doc({ id: 'valid', expiresOn: '2027-03-30' }),
      doc({ id: 'soon', expiresOn: '2026-02-01' }),
      doc({ id: 'gone', expiresOn: '2025-12-01' }),
    ]);
    const rows = await svc.list('org-1', now);
    expect(rows.find((r) => r.id === 'valid')?.state).toBe('valid');
    expect(rows.find((r) => r.id === 'soon')?.state).toBe('expiring');
    expect(rows.find((r) => r.id === 'gone')?.state).toBe('expired');
  });
});
