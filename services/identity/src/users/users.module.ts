import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { USERS_STORE, InMemoryUsersStore, UsersStore } from './users.store';
import { PgUsersStore } from './users.sql-store';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USERS_STORE,
      useFactory: (db?: Db) =>
        selectStore<UsersStore>(new InMemoryUsersStore(), () => new PgUsersStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
