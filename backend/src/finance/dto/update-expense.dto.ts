import { PartialType } from '@nestjs/mapped-types';
import { CreateExpenseDto } from './create-expense.dto';

/** Every field optional; an omitted field is left as it was. */
export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
