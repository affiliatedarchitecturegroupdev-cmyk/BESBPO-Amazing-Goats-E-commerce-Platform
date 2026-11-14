import { Module } from '@nestjs/common';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({ imports: [DispatchModule], controllers: [SmsController], providers: [SmsService] })
export class SmsModule {}
