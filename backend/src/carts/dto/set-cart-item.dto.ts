import { IsInt, IsString, Max, Min } from 'class-validator';

export class SetCartItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}
