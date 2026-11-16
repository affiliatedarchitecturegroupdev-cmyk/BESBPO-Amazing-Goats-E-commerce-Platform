import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { USERS_STORE, InMemoryUsersStore } from './users.store';

@Module({
  controllers: [UsersController],
  providers: [UsersService, { provide: USERS_STORE, useFactory: () => new InMemoryUsersStore() }],
  exports: [UsersService],
})
export class UsersModule {}
