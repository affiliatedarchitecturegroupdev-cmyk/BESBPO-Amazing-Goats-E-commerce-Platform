import { Inject, Injectable } from '@nestjs/common';
import { documentState, DocumentState, PartnerDocument } from '../partner-domain';
import { PartnerStore, PARTNER_STORE } from '../partner.store';

export interface DocumentRow extends PartnerDocument {
  state: DocumentState;
}

@Injectable()
export class DocumentsService {
  constructor(@Inject(PARTNER_STORE) private readonly store: PartnerStore) {}

  /** Documents for the org, each tagged with how it stands against today. */
  async list(orgId: string, now = new Date()): Promise<DocumentRow[]> {
    const rows = await this.store.documents(orgId);
    return rows.map((row) => ({ ...row, state: documentState(row.expiresOn, now) }));
  }
}
