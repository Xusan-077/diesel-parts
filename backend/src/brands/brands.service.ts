import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(dto: CreateBrandDto) {
    await this.assertNameFree(dto.name);
    // Brand.id has no @default (D1): the slug is the id, and the storefront
    // URLs depend on that.
    return this.prisma.brand.create({ data: { ...dto, id: dto.slug } });
  }

  async update(id: string, dto: UpdateBrandDto) {
    await this.findOne(id);
    if (dto.name) await this.assertNameFree(dto.name, id);
    return this.prisma.brand.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.brand.delete({ where: { id } });
    return { success: true };
  }

  private async assertNameFree(name: string, excludeId?: string) {
    // Brand.name is not unique in the DB (a findFirst, not findUnique); this
    // check keeps the app-level "one brand per name" guarantee.
    const existing = await this.prisma.brand.findFirst({ where: { name } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Brand name already exists');
    }
  }
}
