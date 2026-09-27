import { ConflictException } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    brand: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      ...overrides,
    },
  } as unknown as PrismaService;
}

function makeAi(translateEntity: jest.Mock) {
  return { translateEntity } as unknown as AiService;
}

describe('BrandsService', () => {
  it('create() calls AiService with the dto name/sourceLocale and persists every returned locale column', async () => {
    const translateEntity = jest.fn().mockResolvedValue({
      status: 'COMPLETE',
      sourceLocale: 'uz',
      source: { name: 'Cummins' },
      corrections: [],
      locales: {
        uz: { name: 'Cummins' },
        oz: { name: 'Каммінс' },
        ru: { name: 'Каммінс' },
        en: { name: 'Cummins' },
        zh: { name: '康明斯' },
      },
    });
    let createdData: Record<string, unknown> | undefined;
    const create = jest
      .fn()
      .mockImplementation((args: { data: Record<string, unknown> }) => {
        createdData = args.data;
        return Promise.resolve({ id: 'cummins' });
      });
    const prisma = makePrisma({ create });
    const service = new BrandsService(prisma, makeAi(translateEntity));

    await service.create({ name: 'Cummins', slug: 'cummins' });

    expect(translateEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLocale: 'uz',
        fields: { name: 'Cummins' },
      }),
    );
    expect(createdData).toMatchObject({
      id: 'cummins',
      slug: 'cummins',
      name: 'Cummins',
      nameUz: 'Cummins',
      nameOz: 'Каммінс',
      nameRu: 'Каммінс',
      nameEn: 'Cummins',
      nameZh: '康明斯',
      sourceLocale: 'uz',
      translationStatus: 'COMPLETE',
    });
  });

  it('passes translationUz/Ru/En/Zh through as `existing` so a manual edit is never overwritten', async () => {
    const translateEntity = jest.fn().mockResolvedValue({
      status: 'COMPLETE',
      sourceLocale: 'uz',
      source: { name: 'Cummins' },
      corrections: [],
      locales: { uz: { name: 'Cummins' }, oz: { name: 'Каммінс' } },
    });
    const create = jest.fn().mockResolvedValue({ id: 'cummins' });
    const prisma = makePrisma({ create });
    const service = new BrandsService(prisma, makeAi(translateEntity));

    await service.create({
      name: 'Cummins',
      slug: 'cummins',
      translationRu: { name: "Kammins (qo'lda)" },
    });

    expect(translateEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        existing: { ru: { name: "Kammins (qo'lda)" } },
      }),
    );
  });

  it('rejects a duplicate name before ever calling AiService', async () => {
    const translateEntity = jest.fn();
    const prisma = makePrisma({
      findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
    });
    const service = new BrandsService(prisma, makeAi(translateEntity));

    await expect(
      service.create({ name: 'Cummins', slug: 'cummins-2' }),
    ).rejects.toThrow(ConflictException);
    expect(translateEntity).not.toHaveBeenCalled();
  });

  it('update() without a name change skips AiService and only updates slug/logoUrl', async () => {
    const translateEntity = jest.fn();
    const update = jest.fn().mockResolvedValue({ id: 'cummins' });
    const prisma = makePrisma({
      findUnique: jest.fn().mockResolvedValue({ id: 'cummins' }),
      update,
    });
    const service = new BrandsService(prisma, makeAi(translateEntity));

    await service.update('cummins', { logoUrl: 'https://x/logo.png' });

    expect(translateEntity).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'cummins' },
      data: { slug: undefined, logoUrl: 'https://x/logo.png' },
    });
  });
});
