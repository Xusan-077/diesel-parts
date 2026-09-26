import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { CreateAuditEntryDto } from './dto/create-audit-entry.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit:read')
  findAll(@Query() query: QueryAuditDto) {
    return this.audit.findAll(query.page ?? 1, query.entityType);
  }

  @Get('entity-types')
  @RequirePermission('audit:read')
  entityTypes() {
    return this.audit.findEntityTypes();
  }

  /**
   * A bare audit write for an action with no domain-service mutation of its
   * own (login, review moderation). Open to every staff role — unlike the
   * reads above — because the actions that need it aren't director-only;
   * `userId` always comes from the caller's own token, never the body. No
   * `@RequirePermission` here on purpose: PermissionsGuard passes any
   * authenticated staff user through when a route sets no permission.
   */
  @Post()
  create(
    @Body() dto: CreateAuditEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.audit.record({
      userId: user.id,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      before: dto.before,
      after: dto.after,
    });
  }
}
