import { Module } from '@nestjs/common';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({ imports: [DispatchModule], controllers: [EmailController], providers: [EmailService] })
export class EmailModule {}
