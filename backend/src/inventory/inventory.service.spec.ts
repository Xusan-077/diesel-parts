import { ConflictException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

describe('InventoryService.decrementOnHandOrThrow', () => {
  const service = new InventoryService({} as unknown as PrismaService);

  function makeTx(count: number) {
    const updateMany = jest.fn().mockResolvedValue({ count });
    const findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'inv-1', quantity: 3 });
    const tx = {
      inventory: { updateMany, findUniqueOrThrow },
    } as unknown as Prisma.TransactionClient;
    return { tx, updateMany, findUniqueOrThrow };
  }

  it('guards the non-negative check inside the WHERE clause', async () => {
    const { tx, updateMany } = makeTx(1);

    await service.decrementOnHandOrThrow(tx, 'inv-1', 7);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', quantity: { gte: 7 } },
      data: { quantity: { decrement: 7 } },
    });
  });

  it('throws 409 when nothing was updated (short stock or missing row)', async () => {
    const { tx } = makeTx(0);
    await expect(
      service.decrementOnHandOrThrow(tx, 'inv-1', 7),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
