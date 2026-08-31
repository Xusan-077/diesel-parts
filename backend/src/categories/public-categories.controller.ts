import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';

/** Unauthenticated storefront read: the whole category tree for the mega-menu. */
@Controller('catalog/categories')
export class PublicCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  findTree() {
    return this.categories.findTree();
  }
}
