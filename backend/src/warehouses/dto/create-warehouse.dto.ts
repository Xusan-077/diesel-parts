import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { WarehouseStatus } from '../../../generated/prisma/client';

export class CreateWarehouseDto {
  @IsString()
  @MinLength(1)
  name: string;

  /**
   * Short unique handle ("W1", "MARKAZ"). Optional on the wire — when omitted
   * the service assigns the next free `W<n>`. A duplicate is a 409.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  /** Loose label, kept for back-compat. `address` is the structured field. */
  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  address?: string;

  /** User id of the warehouse manager. Must reference an existing user (400). */
  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;
}
