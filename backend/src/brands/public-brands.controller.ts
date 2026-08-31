import { Controller, Get } from '@nestjs/common';
import { BrandsService } from './brands.service';

/** Unauthenticated storefront read: the brand list for catalog filters. */
@Controller('catalog/brands')
export class PublicBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  findAll() {
    return this.brands.findAll();
  }
}
