import { Module } from '@nestjs/common';
import { DecisioningController } from './decisioning.controller';
import { DecisioningService } from './decisioning.service';

@Module({ controllers: [DecisioningController], providers: [DecisioningService] })
export class DecisioningModule {}
