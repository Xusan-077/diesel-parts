import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BrandsController } from './brands.controller';
import { PublicBrandsController } from './public-brands.controller';
import { BrandsService } from './brands.service';

@Module({
  imports: [AiModule],
  controllers: [BrandsController, PublicBrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
