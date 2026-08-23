import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DIRECTOR_UP } from '../common/roles';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DIRECTOR_UP)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  findAll(@Query() query: QueryAuditDto) {
    return this.audit.findAll(query.page ?? 1, query.entityType);
  }

  @Get('entity-types')
  entityTypes() {
    return this.audit.findEntityTypes();
  }
}
