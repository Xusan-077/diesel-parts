import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CategoriesController } from './categories.controller';
import { PublicCategoriesController } from './public-categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [AuditModule],
  controllers: [CategoriesController, PublicCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
