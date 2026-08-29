import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../generated/prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/** What the audit trail keeps for a category write — enough to see the move. */
function auditSnapshot(row: {
  slug: string;
  nameUz: string;
  type: string;
  parentId: string | null;
  order: number;
}) {
  return {
    slug: row.slug,
    name: row.nameUz,
    type: row.type,
    parentId: row.parentId,
    order: row.order,
  };
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.category.findMany({ orderBy: { nameEn: 'asc' } });
  }

  /**
   * The whole category tree, roots first, each with a nested `children` array.
   * Read flat and shaped in memory — the tree is ~60 rows, so one query beats a
   * nested include that fans out per root. A row whose parent is missing is
   * treated as a root (matches the storefront menu's `buildCatalogTree`): a
   * category absent from the menu is harder to notice than one a level too high.
   */
  async findTree() {
    const all = await this.prisma.category.findMany({
      orderBy: [{ order: 'asc' }, { nameUz: 'asc' }],
    });

    type Node = (typeof all)[number] & { children: Node[] };
    const byId = new Map<string, Node>(
      all.map((row) => [row.id, { ...row, children: [] }]),
    );

    const roots: Node[] = [];
    for (const node of byId.values()) {
      const parent =
        node.parentId === null ? undefined : byId.get(node.parentId);
      if (parent === undefined || parent.id === node.id) {
        roots.push(node);
      } else {
        parent.children.push(node);
      }
    }
    return roots;
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto, actorId: string) {
    await this.assertSlugFree(dto.slug);
    const created = await this.prisma.category.create({ data: dto });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'Category',
      entityId: created.id,
      after: auditSnapshot(created),
    });
    return created;
  }

  async update(id: string, dto: UpdateCategoryDto, actorId: string) {
    const before = await this.findOne(id);
    if (dto.slug) await this.assertSlugFree(dto.slug, id);
    const after = await this.prisma.category.update({
      where: { id },
      data: dto,
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Category',
      entityId: id,
      before: auditSnapshot(before),
      after: auditSnapshot(after),
    });
    return after;
  }

  async remove(id: string, actorId: string) {
    const before = await this.findOne(id);
    await this.prisma.category.delete({ where: { id } });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.DELETE,
      entityType: 'Category',
      entityId: id,
      before: auditSnapshot(before),
    });
    return { success: true };
  }

  private async assertSlugFree(slug: string, excludeId?: string) {
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Category slug already exists');
    }
  }
}
