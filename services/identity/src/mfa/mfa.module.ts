import { Module } from '@nestjs/common';
import { createFieldCipher, selectStore } from '@ag/db';
import type { Db, FieldCipher } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { MFA_STORE, InMemoryMfaStore, MfaStore } from './mfa-domain';
import { PgMfaStore } from './mfa.sql-store';

/**
 * The MFA store, chosen by `STORE_DRIVER` like the other identity stores. The
 * SQL adapter needs the field cipher (the TOTP secret is encrypted at rest), so
 * it is only built when the SQL driver is selected — a memory-driver service
 * boots with no database and no encryption key.
 */
export function mfaStore(db?: Db, cipher?: FieldCipher): MfaStore {
  return selectStore<MfaStore>(
    new InMemoryMfaStore(),
    () => new PgMfaStore(db!, cipher ?? createFieldCipher()),
  );
}

@Module({
  controllers: [MfaController],
  providers: [
    MfaService,
    {
      provide: MFA_STORE,
      useFactory: (db?: Db) => mfaStore(db),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class MfaModule {}
