import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { QueryWarehousesDto } from './dto/query-warehouses.dto';

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: QueryWarehousesDto = {}) {
    return this.prisma.warehouse.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: { name: 'asc' },
      include: { manager: { select: { id: true, name: true } } },
    });
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { manager: { select: { id: true, name: true } } },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return { ...warehouse, stockSummary: await this.stockSummary(id) };
  }

  async create(dto: CreateWarehouseDto) {
    const code = dto.code ?? (await this.nextCode());
    try {
      return await this.prisma.warehouse.create({ data: { ...dto, code } });
    } catch (error) {
      throw this.translateWriteError(error, code);
    }
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    await this.ensureExists(id);
    try {
      return await this.prisma.warehouse.update({ where: { id }, data: dto });
    } catch (error) {
      throw this.translateWriteError(error, dto.code);
    }
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.warehouse.delete({ where: { id } });
    return { success: true };
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.warehouse.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Warehouse not found');
  }

  /** On-hand quantity, distinct SKUs and stock value held in one warehouse. */
  private async stockSummary(warehouseId: string) {
    const rows = await this.prisma.inventory.findMany({
      where: { warehouseId },
      select: {
        quantity: true,
        averageCost: true,
        product: { select: { averageCost: true, purchasePrice: true } },
      },
    });

    return rows.reduce(
      (acc, row) => {
        const unit =
          toNumber(row.averageCost) ??
          toNumber(row.product.averageCost) ??
          toNumber(row.product.purchasePrice) ??
          0;
        return {
          skuCount: acc.skuCount + 1,
          totalQuantity: acc.totalQuantity + row.quantity,
          stockValue: acc.stockValue + row.quantity * unit,
        };
      },
      { skuCount: 0, totalQuantity: 0, stockValue: 0 },
    );
  }

  /** Next free `W<n>`, one past the highest existing `W`-prefixed number. */
  private async nextCode(): Promise<string> {
    const rows = await this.prisma.warehouse.findMany({
      where: { code: { startsWith: 'W' } },
      select: { code: true },
    });
    const highest = rows.reduce((max, row) => {
      const n = Number(row.code.slice(1));
      return Number.isInteger(n) && n > max ? n : max;
    }, 0);
    return `W${highest + 1}`;
  }

  private translateWriteError(error: unknown, code?: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new ConflictException(`Ombor kodi band: ${code ?? ''}`.trim());
      }
      if (error.code === 'P2003') {
        return new BadRequestException(
          'Menejer sifatida ko‘rsatilgan foydalanuvchi topilmadi',
        );
      }
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
