import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import type { AiLocale, TranslateSourceFields } from '../ai/translation.schema';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  findAll() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  private async buildLocaleData(dto: CreateBrandDto | UpdateBrandDto) {
    const sourceLocale: AiLocale = dto.sourceLocale ?? 'uz';
    const existing: Partial<Record<AiLocale, TranslateSourceFields>> = {};
    if (dto.translationUz) existing.uz = dto.translationUz;
    if (dto.translationRu) existing.ru = dto.translationRu;
    if (dto.translationEn) existing.en = dto.translationEn;
    if (dto.translationZh) existing.zh = dto.translationZh;

    const result = await this.ai.translateEntity({
      sourceLocale,
      fields: { name: dto.name! },
      existing,
      force: dto.force,
      forceLocales: dto.forceLocales,
    });

    return {
      // Deprecated compat column — see schema.prisma's TODO(step-13).
      name: result.locales.uz?.name ?? dto.name!,
      nameUz: result.locales.uz?.name,
      nameOz: result.locales.oz?.name,
      nameRu: result.locales.ru?.name,
      nameEn: result.locales.en?.name,
      nameZh: result.locales.zh?.name,
      sourceLocale,
      translationStatus: result.status,
    };
  }

  async create(dto: CreateBrandDto) {
    await this.assertNameFree(dto.name);
    const localeData = await this.buildLocaleData(dto);
    // Brand.id has no @default (D1): the slug is the id, and the storefront
    // URLs depend on that.
    return this.prisma.brand.create({
      data: {
        id: dto.slug,
        slug: dto.slug,
        logoUrl: dto.logoUrl,
        ...localeData,
      },
    });
  }

  async update(id: string, dto: UpdateBrandDto) {
    await this.findOne(id);
    if (dto.name) await this.assertNameFree(dto.name, id);

    const localeData = dto.name ? await this.buildLocaleData(dto) : undefined;
    return this.prisma.brand.update({
      where: { id },
      data: {
        slug: dto.slug,
        logoUrl: dto.logoUrl,
        ...localeData,
      },
    });
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
