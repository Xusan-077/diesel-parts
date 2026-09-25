import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ReturnRefundMethod,
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

  @IsIn([...Object.values(ReturnRefundMethod), 'ORIGINAL'])
  refundMethod: ReturnRefundMethod | 'ORIGINAL';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  refundAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInput)
  items: ReturnItemInput[];
}
