import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';

const INCLUDE = {
  user: { select: { id: true, phone: true, role: true, isActive: true } },
  warehouse: { select: { id: true, name: true } },
} as const;

@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.seller.findMany({
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!seller) throw new NotFoundException('Seller not found');
    return seller;
  }

  async create(dto: CreateSellerDto) {
    const existing = await this.prisma.seller.findUnique({
      where: { userId: dto.userId },
    });
    if (existing)
      throw new ConflictException('This user already has a seller profile');

    return this.prisma.seller.create({
      data: { userId: dto.userId, warehouseId: dto.warehouseId },
      include: INCLUDE,
    });
  }

  async update(id: string, dto: UpdateSellerDto) {
    await this.findOne(id);
    return this.prisma.seller.update({
      where: { id },
      data: dto,
      include: INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.seller.delete({ where: { id } });
    return { success: true };
  }
}
