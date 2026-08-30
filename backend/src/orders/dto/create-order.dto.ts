import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class OrderItemInput {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  /** Unit price — only honoured for products priced on request (no catalog price). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}

export class CreateOrderDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items: OrderItemInput[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  /** CRM order comment. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** Set when the order was raised from a CRM board card. */
  @IsOptional()
  @IsString()
  inquiryId?: string;
}
