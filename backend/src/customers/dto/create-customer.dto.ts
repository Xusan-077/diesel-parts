import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  telegram?: string;
}
