import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

/**
 * `email` stays out here, unlike everything else `CreateUserDto` has:
 * root's `userUpdateSchema` never collects it — an account's email is
 * immutable once created — so there is nothing to accidentally overwrite it
 * with a `PATCH` that has no field for it in the first place.
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'email'] as const),
) {}
