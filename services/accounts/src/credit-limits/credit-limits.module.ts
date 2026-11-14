import { Module } from '@nestjs/common';
import { CreditLimitsController } from './credit-limits.controller';
import { CreditLimitsService } from './credit-limits.service';

@Module({ controllers: [CreditLimitsController], providers: [CreditLimitsService] })
export class CreditLimitsModule {}
