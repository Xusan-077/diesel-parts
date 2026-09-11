import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PaymentMethod,
  ReturnCondition,
  ReturnReason,
} from '../../../generated/prisma/client';

class ReturnItemInput {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  qty: number;

  @IsEnum(ReturnReason)
  reason: ReturnReason;

  @IsEnum(ReturnCondition)
  condition: ReturnCondition;
}

export class CreateReturnDto {
  @IsString()
  orderId: string;

  @IsEnum(PaymentMethod)
  refundMethod: PaymentMethod;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInput)
  items: ReturnItemInput[];
}
