import { Module } from '@nestjs/common';
import { DiscountRequestsController } from './discount-requests.controller';
import { DiscountRequestsService } from './discount-requests.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [DiscountRequestsController],
  providers: [DiscountRequestsService],
  exports: [DiscountRequestsService],
})
export class DiscountRequestsModule {}
