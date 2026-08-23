import { IsOptional, IsString } from 'class-validator';

export class CreateSellerDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;
}
