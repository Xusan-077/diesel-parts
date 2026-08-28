import { Module } from '@nestjs/common';
import { PaymeController } from './payme.controller';
import { PaymeService } from './payme.service';

@Module({
  controllers: [PaymeController],
  providers: [PaymeService],
})
export class PaymeModule {}
