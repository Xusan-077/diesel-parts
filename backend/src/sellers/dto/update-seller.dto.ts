import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateSellerDto } from './create-seller.dto';

export class UpdateSellerDto extends PartialType(
  OmitType(CreateSellerDto, ['userId'] as const),
) {}
