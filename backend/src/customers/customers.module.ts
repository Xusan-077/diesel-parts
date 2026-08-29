import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CustomersController } from './customers.controller';
import { SellerCustomersController } from './seller-customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [AuditModule],
  controllers: [CustomersController, SellerCustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
