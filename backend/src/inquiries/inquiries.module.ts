import { Module } from '@nestjs/common';
import { InquiriesController } from './inquiries.controller';
import { SellerInquiriesController } from './seller-inquiries.controller';
import { InquiriesService } from './inquiries.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InquiriesController, SellerInquiriesController],
  providers: [InquiriesService],
  exports: [InquiriesService],
})
export class InquiriesModule {}
