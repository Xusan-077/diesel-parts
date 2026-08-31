import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { SetCartItemDto } from './set-cart-item.dto';

export class MergeCartDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SetCartItemDto)
  items: SetCartItemDto[];
}
