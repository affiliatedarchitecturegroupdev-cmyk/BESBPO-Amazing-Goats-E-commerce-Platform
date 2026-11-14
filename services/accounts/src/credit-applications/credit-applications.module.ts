import { Module } from '@nestjs/common';
import { CreditApplicationsController } from './credit-applications.controller';
import { CreditApplicationsService } from './credit-applications.service';

@Module({ controllers: [CreditApplicationsController], providers: [CreditApplicationsService] })
export class CreditApplicationsModule {}
