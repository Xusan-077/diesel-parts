import { IsOptional, IsString, MinLength } from 'class-validator';

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

  @IsOptional()
  @IsString()
  location?: string;
}
