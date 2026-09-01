import {
  BadRequestException,
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
    return this.prisma.category.findMany({
      orderBy: { nameEn: 'asc' },
      include: { _count: { select: { children: true, products: true } } },
    });
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
    if (dto.parentId != null) {
      await this.assertValidParent(dto.parentId, null);
    }

    // Category.id has no @default (D1): the slug is the id, and the storefront
    // URLs depend on that.
    const created = await this.prisma.category.create({
      data: { ...dto, id: dto.slug },
    });
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

    if (dto.parentId != null) {
      await this.assertValidParent(dto.parentId, id);

      // A root with children cannot become a child itself: that would push
      // its own children onto a third level the menu does not draw.
      if (before.parentId === null) {
        const children = await this.prisma.category.count({
          where: { parentId: id },
        });
        if (children > 0) {
          throw new ConflictException({
            statusCode: 409,
            message: 'Category has child categories',
            error: 'has_children',
          });
        }
      }
    }

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

  /**
   * Deletes a category, or refuses.
   *
   * Both guards exist because the alternative is worse than an error message:
   * `Category.parentId` defaults to `SetNull` on delete, so without the
   * children guard this would silently orphan a whole column of the menu.
   * `Product.categoryId` is a required relation (`Restrict`), so without the
   * products guard this would instead surface as a raw, untranslated P2003.
   */
  async remove(id: string, actorId: string) {
    const before = await this.findOne(id);

    const [children, products] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.product.count({ where: { categoryId: id } }),
    ]);

    if (children > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Category has child categories',
        error: 'has_children',
      });
    }

    if (products > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Category has products',
        error: 'has_products',
      });
    }

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

  /**
   * Checks the parent a write asks for.
   *
   * The menu is two levels deep — a root is a column, its children are that
   * column's entries — so a parent that is itself a child is refused rather
   * than silently rendered nowhere. Pointing a category at itself is caught
   * here too: it would otherwise detach that row and everything under it from
   * the tree.
   */
  private async assertValidParent(parentId: string, selfId: string | null) {
    if (parentId === selfId) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Parent must be a top-level category',
        error: 'parent_not_root',
      });
    }

    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { parentId: true },
    });

    if (parent === null) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Parent category not found',
        error: 'parent_not_found',
      });
    }

    if (parent.parentId !== null) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Parent must be a top-level category',
        error: 'parent_not_root',
      });
    }
  }

  private async assertSlugFree(slug: string, excludeId?: string) {
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Category slug already exists',
        error: 'duplicate_slug',
      });
    }
  }
}
