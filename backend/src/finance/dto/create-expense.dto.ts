import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ExpenseCategory } from '../../../generated/prisma/client';

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title: string;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  /** > 0, at most 2 decimal places. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  /** `YYYY-MM-DD` — stored at Tashkent (UTC+5) midnight. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'spentAt must be YYYY-MM-DD' })
  spentAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
