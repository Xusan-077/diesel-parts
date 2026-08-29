import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AuditAction } from '../../../generated/prisma/client';

/**
 * `POST /audit` — a bare audit write for an action with no domain-service
 * mutation of its own (login, review moderation). `userId` is never taken
 * from the body: it is always the caller's own id, from the access token.
 */
export class CreateAuditEntryDto {
  @IsEnum(AuditAction)
  action: AuditAction;

  @IsString()
  entityType: string;

  @IsString()
  entityId: string;

  @IsOptional()
  before?: unknown;

  @IsOptional()
  after?: unknown;
}
