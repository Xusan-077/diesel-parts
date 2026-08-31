import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Role } from '../../../generated/prisma/client';

/**
 * `name`/`email`/`discountLimit` were never wired into this DTO despite the
 * schema comment on `User` anticipating it ("at least one of phone/email
 * must be set — enforced in CreateUserDto") -- ported from root's
 * `userCreateSchema` (Task 22). `phone` is optional for the same reason the
 * schema comment gives: an email-primary account (the migrated director,
 * `phone: null`) must stay creatable.
 */
export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsEmail()
  email: string;

  /**
   * `| null`, not just optional: on an update, root always resubmits the
   * whole form, and clearing this field has to reach backend/ as an explicit
   * `null` — an omitted (`undefined`) field in a PATCH body leaves the
   * existing value untouched instead of clearing it. `@IsOptional()` already
   * lets `null` through class-validator (it skips the rest of a property's
   * decorators for both `undefined` and `null`), so no extra decorator is
   * needed for that.
   */
  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
