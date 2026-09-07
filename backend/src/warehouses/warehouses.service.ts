import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
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
    await this.findOne(id);
    try {
      return await this.prisma.warehouse.update({ where: { id }, data: dto });
    } catch (error) {
      throw this.translateWriteError(error, dto.code);
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.warehouse.delete({ where: { id } });
    return { success: true };
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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(`Ombor kodi band: ${code ?? ''}`.trim());
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
